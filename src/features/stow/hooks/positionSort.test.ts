import { describe, expect, it } from "vitest";
import { byPosition } from "@/features/stow/hooks/positionSort";

describe("byPosition", () => {
  it("orders by position ascending", () => {
    const sorted = [
      { position: 2, name: "B" },
      { position: 0, name: "A" },
      { position: 1, name: "C" }
    ].sort(byPosition);
    expect(sorted.map((s) => s.name)).toEqual(["A", "C", "B"]);
  });

  it("falls back to name when position is missing (undefined sorts last, then localeCompare)", () => {
    const sorted = [{ name: "Zebra" }, { position: 0, name: "Anchor" }, { name: "Apple" }].sort(byPosition);
    expect(sorted.map((s) => s.name)).toEqual(["Anchor", "Apple", "Zebra"]);
  });

  it("breaks position ties by name", () => {
    const sorted = [
      { position: 1, name: "Beta" },
      { position: 1, name: "Alpha" }
    ].sort(byPosition);
    expect(sorted.map((s) => s.name)).toEqual(["Alpha", "Beta"]);
  });
});
