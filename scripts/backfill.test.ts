import { describe, expect, it } from "vitest";
import { planPositions } from "../scripts/backfill-positions";
import { planStatus } from "../scripts/backfill-status";

describe("planPositions", () => {
  it("assigns 0-based positions by case-insensitive name order, skipping docs that already have a position", () => {
    const docs = [
      { id: "b", name: "Garage", position: undefined },
      { id: "a", name: "attic", position: undefined },
      { id: "c", name: "Kitchen", position: 5 }, // already set -> not rewritten
    ];
    expect(planPositions(docs)).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
  });

  it("is idempotent: a fully-positioned set yields no writes", () => {
    const docs = [
      { id: "a", name: "A", position: 0 },
      { id: "b", name: "B", position: 1 },
    ];
    expect(planPositions(docs)).toEqual([]);
  });

  it("orders by name first, so existing positions do not perturb the ranking of unset docs", () => {
    // 'c' already has position 0 but name 'Zed'; unset 'a','b' still rank by name among the full set
    const docs = [
      { id: "c", name: "Zed", position: 0 },
      { id: "b", name: "Beta", position: undefined },
      { id: "a", name: "Alpha", position: undefined },
    ];
    // full name order: Alpha(0), Beta(1), Zed(2); only unset ids are written
    expect(planPositions(docs)).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
  });
});

describe("planStatus", () => {
  it("derives status from isPacked only for docs missing status", () => {
    const docs = [
      { id: "i1", isPacked: true, status: undefined },
      { id: "i2", isPacked: false, status: undefined },
      { id: "i3", isPacked: true, status: "lent" }, // already set -> skip
      { id: "i4", isPacked: undefined, status: undefined },
    ];
    expect(planStatus(docs)).toEqual([
      { id: "i1", status: "packed" },
      { id: "i2", status: "home" },
      { id: "i4", status: "home" },
    ]);
  });

  it("is idempotent: all-statused docs yield no writes", () => {
    expect(planStatus([{ id: "i1", isPacked: true, status: "packed" }])).toEqual([]);
  });
});
