import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { anthropicAdapter } from "../../src/providers/anthropic.js";
import type { HouseholdLlmConfig } from "../../src/shared/schemas.js";

const config: HouseholdLlmConfig = {
  enabled: true,
  providerType: "anthropic",
  model: "claude-3-5-sonnet-20241022",
  promptProfile: "default_inventory",
  temperature: 0.2,
  maxTokens: 300
};

const imageContext = {
  apiKey: "sk-ant-test-key",
  config,
  prompt: "categorize",
  image: { mimeType: "image/webp", bytes: Buffer.from("webpdata") }
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

describe("anthropicAdapter.classifyImage", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts messages with base64 image and normalizes the suggestion", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              suggestedName: "Winter Jacket",
              tags: ["Clothing", "Winter"],
              confidence: 0.82
            })
          }
        ]
      })
    );

    const suggestion = await anthropicAdapter.classifyImage(imageContext);
    expect(suggestion.suggestedName).toBe("Winter Jacket");
    expect(suggestion.tags).toEqual(["Clothing", "Winter"]);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.headers["x-api-key"]).toBe("sk-ant-test-key");
    expect(init.headers["anthropic-version"]).toBe("2023-06-01");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("claude-3-5-sonnet-20241022");
    const imgPart = body.messages[0].content[0];
    expect(imgPart.type).toBe("image");
    expect(imgPart.source.media_type).toBe("image/webp");
    expect(imgPart.source.data).toBe(Buffer.from("webpdata").toString("base64"));
  });

  it("surfaces error body on non-OK response", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }),
        { status: 401 }
      )
    );
    await expect(anthropicAdapter.classifyImage(imageContext)).rejects.toThrow(
      /Anthropic API request failed \(401\).*invalid x-api-key/
    );
  });
});

describe("anthropicAdapter.validate", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns ok:true on a successful response", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: "text", text: "OK" }] })
    );
    const result = await anthropicAdapter.validate({ apiKey: "sk", config });
    expect(result.ok).toBe(true);
  });

  it("returns ok:false with error body excerpt on 400", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ type: "error", error: { type: "not_found_error", message: "model: unknown" } }),
        { status: 400 }
      )
    );
    const result = await anthropicAdapter.validate({ apiKey: "sk", config });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/400/);
    expect(result.message).toContain("model: unknown");
  });
});
