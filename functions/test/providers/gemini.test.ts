import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { geminiAdapter } from "../../src/providers/gemini.js";
import type { HouseholdLlmConfig } from "../../src/shared/schemas.js";

const config: HouseholdLlmConfig = {
  enabled: true,
  providerType: "gemini",
  model: "gemini-1.5-flash",
  promptProfile: "default_inventory",
  temperature: 0.2,
  maxTokens: 300
};

const imageContext = {
  apiKey: "AIza-test-key",
  config,
  prompt: "categorize",
  image: { mimeType: "image/png", bytes: Buffer.from("pngbytes") }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("geminiAdapter.classifyImage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts generateContent with inline image data and normalizes", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    suggestedName: "USB Cable",
                    tags: ["Tech", "Cable"],
                    confidence: 0.7
                  })
                }
              ]
            }
          }
        ]
      })
    );

    const suggestion = await geminiAdapter.classifyImage(imageContext);
    expect(suggestion.suggestedName).toBe("USB Cable");
    expect(suggestion.confidence).toBeCloseTo(0.7);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain("gemini-1.5-flash:generateContent");
    expect(url).toContain("key=AIza-test-key");
    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[1].inlineData.mimeType).toBe("image/png");
    expect(body.contents[0].parts[1].inlineData.data).toBe(Buffer.from("pngbytes").toString("base64"));
    expect(body.generationConfig.maxOutputTokens).toBe(300);
  });

  it("surfaces error body on 400 response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 400, message: "API key not valid" } }),
        { status: 400 }
      )
    );
    await expect(geminiAdapter.classifyImage(imageContext)).rejects.toThrow(
      /Gemini API request failed \(400\).*API key not valid/
    );
  });
});

describe("geminiAdapter.validate", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok:true when the model lookup succeeds", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ name: "models/gemini-1.5-flash" }));
    const result = await geminiAdapter.validate({ apiKey: "AIza", config });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false with error excerpt on failure", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "model not found" } }),
        { status: 404 }
      )
    );
    const result = await geminiAdapter.validate({ apiKey: "AIza", config });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/404/);
    expect(result.message).toContain("model not found");
  });
});
