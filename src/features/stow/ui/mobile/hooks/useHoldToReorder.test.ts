import { describe, expect, it } from "vitest";
import { reorderIndex } from "@/features/stow/ui/mobile/hooks/useHoldToReorder";

// rows of height 50 starting at y=100: tops = [100,150,200,250]
const TOPS = [100, 150, 200, 250];

describe("reorderIndex", () => {
  it("keeps the index when the pointer is over the original slot", () => {
    expect(reorderIndex(TOPS, 0, 110)).toBe(0);
    expect(reorderIndex(TOPS, 2, 205)).toBe(2);
  });

  it("moves down when the pointer crosses into a lower slot", () => {
    // dragging row 0 (grab offset ~ at its top); pointer near row 2's center
    expect(reorderIndex(TOPS, 0, 210)).toBe(2);
  });

  it("moves up when the pointer crosses into a higher slot", () => {
    expect(reorderIndex(TOPS, 3, 105)).toBe(0);
  });

  it("clamps to the first index above the list", () => {
    expect(reorderIndex(TOPS, 1, -500)).toBe(0);
  });

  it("clamps to the last index below the list", () => {
    expect(reorderIndex(TOPS, 1, 99999)).toBe(3);
  });

  it("returns from unchanged for a single-row list", () => {
    expect(reorderIndex([100], 0, 130)).toBe(0);
  });
});
