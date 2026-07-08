import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";
import { geminiAdapter } from "../src/providers/gemini.js";
import type { HouseholdLlmConfig } from "../src/shared/schemas.js";

const config: HouseholdLlmConfig = {
  enabled: true,
  providerType: "gemini",
  model: "gemini-2.5-flash",
  promptProfile: "default_inventory",
  temperature: 0.2,
  maxTokens: 400
};

const image = {
  mimeType: "image/png",
  bytes: Buffer.from("known-image-bytes")
};

function geminiResponse(text: string) {
  return geminiBodyResponse({
    candidates: [{ content: { parts: [{ text }] } }]
  });
}

function geminiBodyResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init
  });
}

describe("gemini vision adapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates the configured Gemini model with models.get", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(geminiBodyResponse({ name: "gemini-2.5-flash" }));

    const result = await geminiAdapter.validate({ apiKey: "test-key", config });

    expect(result).toEqual({ ok: true, message: "Connection successful" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash?key=test-key",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("sends model, prompt, generation config, and inline image data", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      geminiResponse('{"suggestedName":"Camera","tags":["Tech"],"notes":"Black camera","confidence":0.82}')
    );

    const suggestion = await geminiAdapter.classifyImage({
      apiKey: "test-key",
      config,
      prompt: "Return JSON for household inventory.",
      image
    });

    expect(suggestion.suggestedName).toBe("Camera");
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=test-key"
    );
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body.generationConfig).toEqual({ temperature: 0.2, maxOutputTokens: 400 });
    expect(body.contents[0].parts[0].text).toContain("Return JSON for household inventory.");
    expect(body.contents[0].parts[1].inlineData).toEqual({
      mimeType: "image/png",
      data: image.bytes.toString("base64")
    });
  });

  it("accepts prose-wrapped JSON responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      geminiResponse('Here is the draft:\n{"suggestedName":"Passport folder","tags":["Documents"],"confidence":0.61}\nDone.')
    );

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).resolves.toMatchObject({ suggestedName: "Passport folder", confidence: 0.61 });
  });

  it("rejects malformed JSON responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(geminiResponse("not json"));

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).rejects.toMatchObject<HttpsError>({ code: "internal" });
  });

  it("rejects schema-invalid JSON responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(geminiResponse('{"suggestedName":"","tags":[],"confidence":2}'));

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).rejects.toMatchObject<HttpsError>({ code: "internal" });
  });

  it("surfaces provider error responses", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response("rate limited", { status: 429, statusText: "Too Many Requests" }));

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).rejects.toMatchObject<HttpsError>({ code: "internal" });
  });

  it("surfaces promptFeedback blockReason as a provider error", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(geminiBodyResponse({ promptFeedback: { blockReason: "SAFETY" } }));

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).rejects.toMatchObject<HttpsError>({
      code: "internal",
      message: "Provider blocked the request (SAFETY)"
    });
  });

  it("surfaces MAX_TOKENS with unusable text as an incomplete provider response", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      geminiBodyResponse({
        candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "not json" }] } }]
      })
    );

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).rejects.toMatchObject<HttpsError>({
      code: "internal",
      message: "Provider response incomplete (MAX_TOKENS) — raise the max tokens setting"
    });
  });

  it("accepts parseable text even when Gemini reports a non-STOP finishReason", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      geminiBodyResponse({
        candidates: [
          {
            finishReason: "MAX_TOKENS",
            content: {
              parts: [
                {
                  text: '{"suggestedName":"Camera","tags":["Tech"],"notes":"Black camera","confidence":0.82}'
                }
              ]
            }
          }
        ]
      })
    );

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).resolves.toMatchObject({ suggestedName: "Camera", confidence: 0.82 });
  });

  it("uses at least 1024 output tokens for shelf detection even when household maxTokens is lower", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      geminiResponse(JSON.stringify([{ label: "Camera", confidence: 0.8, box_2d: [10, 20, 300, 420] }]))
    );

    await geminiAdapter.detectShelfItems!({
      apiKey: "test-key",
      config: { ...config, maxTokens: 400 },
      prompt: "Detect shelf items.",
      image
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.generationConfig.maxOutputTokens).toBe(1024);
  });
});
