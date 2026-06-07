import { describe, expect, it } from "vitest";
import {
  applyVisionSuggestion,
  type ItemDraftFields
} from "@/features/stow/ui/mobile/capture/applyVisionSuggestion";
import type { VisionSuggestion } from "@/types/llm";

const base: ItemDraftFields = { name: "", tags: [], notes: "", value: "" };

const suggestion: VisionSuggestion = {
  suggestedName: "Sony WH-1000XM5",
  tags: ["Tech", "Audio"],
  notes: "Over-ear headphones",
  confidence: 0.82
};

describe("applyVisionSuggestion", () => {
  it("fills name, tags, and notes from the suggestion", () => {
    const next = applyVisionSuggestion(base, suggestion);
    expect(next.name).toBe("Sony WH-1000XM5");
    expect(next.tags).toEqual(["Tech", "Audio"]);
    expect(next.notes).toBe("Over-ear headphones");
  });

  it("never touches value (value stays manual per contract 9.2)", () => {
    const next = applyVisionSuggestion({ ...base, value: "250" }, suggestion);
    expect(next.value).toBe("250");
  });

  it("does not overwrite a name the user already typed", () => {
    const next = applyVisionSuggestion({ ...base, name: "My headphones" }, suggestion);
    expect(next.name).toBe("My headphones");
  });

  it("merges suggested tags into existing tags without duplicates, preserving order", () => {
    const next = applyVisionSuggestion({ ...base, tags: ["Audio", "Gift"] }, suggestion);
    expect(next.tags).toEqual(["Audio", "Gift", "Tech"]);
  });

  it("does not overwrite notes the user already typed", () => {
    const next = applyVisionSuggestion({ ...base, notes: "bought 2024" }, suggestion);
    expect(next.notes).toBe("bought 2024");
  });

  it("treats a blank/whitespace suggested name as no suggestion", () => {
    const next = applyVisionSuggestion(base, { ...suggestion, suggestedName: "  " });
    expect(next.name).toBe("");
  });

  it("ignores missing notes on the suggestion", () => {
    const next = applyVisionSuggestion(base, {
      suggestedName: "Lamp",
      tags: [],
      confidence: 0.4
    });
    expect(next.notes).toBe("");
    expect(next.name).toBe("Lamp");
  });

  it("returns a new object and does not mutate the input", () => {
    const input = { ...base, tags: ["Audio"] };
    const next = applyVisionSuggestion(input, suggestion);
    expect(next).not.toBe(input);
    expect(input.tags).toEqual(["Audio"]);
  });
});
