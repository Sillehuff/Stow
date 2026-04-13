import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openaiCompatibleAdapter } from "../../src/providers/openaiCompatible.js";
import type { HouseholdLlmConfig } from "../../src/shared/schemas.js";

const config: HouseholdLlmConfig = {
  enabled: true,
  providerType: "openai_compatible",
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.test/v1",
  promptProfile: "default_inventory",
  temperature: 0.2,
  maxTokens: 300
};

const imageContext = {
  apiKey: "sk-test-key",
  config,
  prompt: "categorize",
  image: { mimeType: "image/jpeg", bytes: Buffer.from("imgdata") }
};

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers as Record<string, string> | undefined) }
  });
}

describe("openaiCompatibleAdapter.classifyImage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts chat/completions with image_url and normalizes the suggestion", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestedName: "Coffee Mug",
                tags: ["Kitchen", "Ceramic"],
                confidence: 0.88,
                rationale: "Visible handle and rim"
              })
            }
          }
        ]
      })
    );

    const suggestion = await openaiCompatibleAdapter.classifyImage(imageContext);
    expect(suggestion.suggestedName).toBe("Coffee Mug");
    expect(suggestion.tags).toEqual(["Kitchen", "Ceramic"]);
    expect(suggestion.confidence).toBeCloseTo(0.88);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.openai.test/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer sk-test-key");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("surfaces provider error body on non-OK response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ error: { message: "Invalid API key" } }),
        { status: 401, headers: { "content-type": "application/json" } }
      )
    );
    await expect(openaiCompatibleAdapter.classifyImage(imageContext)).rejects.toThrow(
      /OpenAI-compatible API request failed \(401\).*Invalid API key/
    );
  });

  it("throws clearly on malformed JSON content", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "not-json-at-all" } }] })
    );
    await expect(openaiCompatibleAdapter.classifyImage(imageContext)).rejects.toThrow(
      /Provider response was not valid JSON/
    );
  });
});

describe("openaiCompatibleAdapter.validate", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok:true when the configured model is listed", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ data: [{ id: "gpt-4o-mini" }, { id: "gpt-4o" }] })
    );
    const result = await openaiCompatibleAdapter.validate({ apiKey: "sk", config });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false when the configured model is missing from the list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: [{ id: "some-other-model" }] }));
    const result = await openaiCompatibleAdapter.validate({ apiKey: "sk", config });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("gpt-4o-mini");
  });

  it("returns ok:false with provider error body on 401", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 })
    );
    const result = await openaiCompatibleAdapter.validate({ apiKey: "sk", config });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/401/);
    expect(result.message).toContain("bad key");
  });
});
