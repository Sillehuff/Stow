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
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }]
    })
  } as Response;
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
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK" } as Response);

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
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, statusText: "Too Many Requests" } as Response);

    await expect(
      geminiAdapter.classifyImage({
        apiKey: "test-key",
        config,
        prompt: "Return JSON.",
        image
      })
    ).rejects.toMatchObject<HttpsError>({ code: "internal" });
  });
});
