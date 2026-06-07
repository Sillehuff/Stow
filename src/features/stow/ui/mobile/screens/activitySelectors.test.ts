import { describe, expect, it } from "vitest";
import { formatRelativeTime, selectAwayItems } from "@/features/stow/ui/mobile/screens/activitySelectors";
import type { Item } from "@/types/domain";

const NOW = 1_700_000_000_000;

describe("formatRelativeTime", () => {
  it("returns 'just now' under a minute", () => {
    expect(formatRelativeTime(NOW - 5_000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW + 60_000, NOW)).toBe("just now");
  });

  it("formats minutes, hours, days, weeks", () => {
    expect(formatRelativeTime(NOW - 3 * 60_000, NOW)).toBe("3m ago");
    expect(formatRelativeTime(NOW - 2 * 3_600_000, NOW)).toBe("2h ago");
    expect(formatRelativeTime(NOW - 1 * 3_600_000, NOW)).toBe("1h ago");
    expect(formatRelativeTime(NOW - 3 * 86_400_000, NOW)).toBe("3d ago");
    expect(formatRelativeTime(NOW - 14 * 86_400_000, NOW)).toBe("2w ago");
  });

  it("accepts a Timestamp-like value with toMillis()", () => {
    const ts = { toMillis: () => NOW - 60_000 };
    expect(formatRelativeTime(ts, NOW)).toBe("1m ago");
  });

  it("accepts a Date", () => {
    expect(formatRelativeTime(new Date(NOW - 86_400_000), NOW)).toBe("1d ago");
  });

  it("guards null/undefined/un-coercible input", () => {
    expect(formatRelativeTime(null, NOW)).toBe("");
    expect(formatRelativeTime(undefined, NOW)).toBe("");
    expect(formatRelativeTime({} as unknown, NOW)).toBe("");
    expect(formatRelativeTime(new Date("invalid"), NOW)).toBe("");
    expect(formatRelativeTime({ toMillis: () => Number.NaN }, NOW)).toBe("");
  });
});

function item(partial: Partial<Item> & Pick<Item, "id" | "status">): Item {
  return {
    householdId: "h1",
    spaceId: "s1",
    areaId: "a1",
    areaNameSnapshot: "Shelf",
    name: partial.name ?? partial.id,
    kind: "item",
    tags: [],
    isPacked: false,
    photoStatus: "later",
    entryMode: "manual",
    createdBy: "u1",
    updatedBy: "u1",
    createdAt: { toMillis: () => 0 } as unknown as Item["createdAt"],
    updatedAt: { toMillis: () => 0 } as unknown as Item["updatedAt"],
    ...partial
  } as Item;
}

describe("selectAwayItems", () => {
  it("keeps only items whose status is not home", () => {
    const items = [
      item({ id: "a", status: "home" }),
      item({ id: "b", status: "lent" }),
      item({ id: "c", status: "packed" }),
      item({ id: "d", status: "repair" }),
      item({ id: "e", status: "lost" })
    ];
    expect(selectAwayItems(items).map((i) => i.id)).toEqual(["b", "c", "d", "e"]);
  });

  it("treats a missing status as home (excluded)", () => {
    const stray = item({ id: "x", status: undefined as unknown as Item["status"] });
    expect(selectAwayItems([stray])).toEqual([]);
  });

  it("returns a new array and does not mutate the input", () => {
    const items = [item({ id: "a", status: "lent" })];
    const out = selectAwayItems(items);
    expect(out).not.toBe(items);
  });
});
