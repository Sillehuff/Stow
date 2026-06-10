import { describe, expect, it } from "vitest";
import { packingProgress } from "./PackingScreen";
import type { PackingList } from "@/types/domain";

const list = {
  itemIds: ["a", "b", "ghost"],
  packedItemIds: ["a", "ghost"]
} as unknown as PackingList;

describe("packingProgress", () => {
  it("ignores ids that no longer resolve to items", () => {
    const result = packingProgress(list, new Set(["a", "b"]));
    expect(result).toEqual({ done: 1, total: 2, pct: 50 });
  });

  it("returns zeros for an empty effective list", () => {
    expect(packingProgress(list, new Set())).toEqual({ done: 0, total: 0, pct: 0 });
  });
});
