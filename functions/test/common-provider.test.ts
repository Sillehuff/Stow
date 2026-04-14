import { describe, expect, it } from "vitest";
import {
  extractJsonObject,
  normalizeSuggestion,
  readErrorBodyExcerpt,
  redactSecrets,
  requireOk
} from "../src/providers/common.js";

describe("provider common helpers", () => {
  it("extracts direct json", () => {
    const parsed = extractJsonObject('{"suggestedName":"Mug","tags":["Kitchen"],"confidence":0.5}');
    expect(parsed).toMatchObject({ suggestedName: "Mug" });
  });

  it("extracts json wrapped in prose", () => {
    const parsed = extractJsonObject(
      'Here is the result:\n{"suggestedName":"Camera","tags":["Tech","Photo"],"confidence":0.8}\nDone.'
    );
    expect(parsed).toMatchObject({ suggestedName: "Camera" });
  });

  it("normalizes schema-compliant suggestions", () => {
    const suggestion = normalizeSuggestion({
      suggestedName: "Scissors",
      tags: ["Tools", "Sharp"],
      confidence: 0.68
    });
    expect(suggestion.confidence).toBeCloseTo(0.68);
  });
});

describe("redactSecrets", () => {
  it("redacts bearer tokens", () => {
    expect(redactSecrets("Authorization: Bearer sk-abc123DEF456ghi789")).toMatch(
      /Authorization: Bearer \[REDACTED\]/
    );
  });

  it("redacts Gemini-style key query params in URLs", () => {
    const out = redactSecrets(
      "GET https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash?key=AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345 failed"
    );
    expect(out).not.toContain("AIzaSy");
    expect(out).toMatch(/\?key=\[REDACTED\]/);
  });

  it("redacts json key fields", () => {
    const out = redactSecrets('{"apiKey":"super-secret","other":"visible"}');
    expect(out).not.toContain("super-secret");
    expect(out).toContain('"other":"visible"');
  });

  it("redacts bare OpenAI-style sk- prefixed secrets", () => {
    const out = redactSecrets("error: invalid sk-proj-abcdefghijklmnopqrstuvwxyz01234 in request");
    expect(out).not.toContain("sk-proj-abcdef");
    expect(out).toContain("[REDACTED]");
  });

  it("redacts Anthropic-style sk-ant- secrets", () => {
    const out = redactSecrets("key sk-ant-api01-abcdefghijklmnopqr bad");
    expect(out).not.toContain("sk-ant-api01");
  });

  it("leaves non-secret text untouched", () => {
    expect(redactSecrets("Request failed: model not found")).toBe("Request failed: model not found");
  });
});

describe("readErrorBodyExcerpt", () => {
  it("collapses whitespace", async () => {
    const response = new Response("one  two\n\tthree\r\nfour", { status: 400 });
    const excerpt = await readErrorBodyExcerpt(response);
    expect(excerpt).toBe("one two three four");
  });

  it("truncates to 500 chars and appends an ellipsis", async () => {
    const body = "x".repeat(1200);
    const response = new Response(body, { status: 500 });
    const excerpt = await readErrorBodyExcerpt(response);
    expect(excerpt.endsWith("…")).toBe(true);
    // 500 chars + 1 ellipsis
    expect(Array.from(excerpt).length).toBe(501);
  });

  it("returns an empty string when the body is empty", async () => {
    const response = new Response("", { status: 500 });
    expect(await readErrorBodyExcerpt(response)).toBe("");
  });

  it("redacts secrets inside the body", async () => {
    const body = 'Upstream error: {"apiKey":"SECRET_TOKEN_12345"}';
    const response = new Response(body, { status: 500 });
    const excerpt = await readErrorBodyExcerpt(response);
    expect(excerpt).not.toContain("SECRET_TOKEN_12345");
    expect(excerpt).toContain("[REDACTED]");
  });

  it("never throws if the body has already been consumed", async () => {
    const response = new Response("oops", { status: 500 });
    await response.text(); // consume the body stream
    await expect(readErrorBodyExcerpt(response)).resolves.toBe("");
  });
});

describe("requireOk", () => {
  it("is a no-op on successful responses", async () => {
    await expect(requireOk(new Response("{}", { status: 200 }), "Test")).resolves.toBeUndefined();
  });

  it("throws an HttpsError that includes the redacted body excerpt", async () => {
    const body = 'Authorization: Bearer sk-proj-abcdefghijklmnopqrstuvwxyz01234 denied';
    const response = new Response(body, { status: 401 });
    await expect(requireOk(response, "Test")).rejects.toThrow(
      /Test API request failed \(401\).*Bearer \[REDACTED\]/
    );
  });

  it("falls back to statusText when the body is unreadable", async () => {
    const response = new Response("", { status: 502, statusText: "Bad Gateway" });
    await expect(requireOk(response, "Test")).rejects.toThrow(/Test API request failed \(502\): Bad Gateway/);
  });
});
