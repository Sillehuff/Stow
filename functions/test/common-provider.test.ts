import { describe, expect, it } from "vitest";
import { extractJsonObject, normalizeSuggestion } from "../src/providers/common.js";

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
