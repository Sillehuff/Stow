import { describe, expect, it } from "vitest";
import { positionUpdatesFor } from "@/features/stow/services/repository";

describe("positionUpdatesFor", () => {
  it("maps each id to its zero-based index", () => {
    expect(positionUpdatesFor(["a", "b", "c"])).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 }
    ]);
  });

  it("produces a contiguous 0..n-1 sequence after a move", () => {
    const result = positionUpdatesFor(["c", "a", "b"]);
    expect(result.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(result.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });

  it("handles an empty list", () => {
    expect(positionUpdatesFor([])).toEqual([]);
  });
});
