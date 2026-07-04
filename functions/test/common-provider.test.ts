import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJsonObject, normalizeSuggestion, providerFetch } from "../src/providers/common.js";

describe("providerFetch timeout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("aborts provider requests after the timeout with deadline-exceeded", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        })
      )
    );
    try {
      const pending = providerFetch("https://example.com", { method: "POST" });
      const assertion = expect(pending).rejects.toMatchObject({ code: "deadline-exceeded" });
      await vi.advanceTimersByTimeAsync(30_001);
      await assertion;
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });

  it("passes through a successful response and forwards an abort signal", async () => {
    const response = { ok: true, status: 200 } as Response;
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await providerFetch("https://example.com", { method: "POST" });

    expect(result).toBe(response);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("https://example.com");
    expect((init as RequestInit | undefined)?.method).toBe("POST");
    expect((init as RequestInit | undefined)?.signal).toBeInstanceOf(AbortSignal);
  });
});

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

  it("throws an HttpsError (not a raw SyntaxError) when the extracted block is still invalid json", () => {
    expect(() => extractJsonObject("prefix {suggestedName: {broken} trailing garbage")).toThrowError(
      /Provider response was not valid JSON/
    );
  });

  it("throws an HttpsError when there is no json object at all", () => {
    expect(() => extractJsonObject("absolutely no json here")).toThrowError(
      /Provider response was not valid JSON/
    );
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
