import { describe, expect, it } from "vitest";
import type { Item, SpaceWithAreas } from "@/types/domain";
import { getSearchScreenData } from "@/features/stow/ui/mobile/screens/SearchScreen";

const item = (overrides: Partial<Item> & Pick<Item, "id" | "name" | "spaceId" | "areaNameSnapshot">): Item =>
  ({
    householdId: "household-1",
    areaId: "area-1",
    kind: "item",
    tags: [],
    isPacked: false,
    photoStatus: "skipped",
    entryMode: "manual",
    createdBy: "user-1",
    updatedBy: "user-1",
    ...overrides
  }) as Item;

const space = (id: string, name: string): SpaceWithAreas =>
  ({
    id,
    householdId: "household-1",
    name,
    icon: "box",
    color: "#E8652B",
    position: 0,
    createdAt: {} as SpaceWithAreas["createdAt"],
    updatedAt: {} as SpaceWithAreas["updatedAt"],
    areas: []
  }) as SpaceWithAreas;

const spaces: SpaceWithAreas[] = [
  space("kitchen", "Kitchen"),
  space("garage", "Garage")
];

const items: Item[] = [
  item({ id: "mug", name: "Ceramic Mug", spaceId: "kitchen", areaNameSnapshot: "Upper Cabinet", tags: ["daily", "coffee"] }),
  item({ id: "drill", name: "Cordless Drill", spaceId: "garage", areaNameSnapshot: "Tool Wall", tags: ["tools", "daily"] }),
  item({ id: "blanket", name: "Wool Blanket", spaceId: "kitchen", areaNameSnapshot: "Bench", tags: ["winter"] })
];

describe("getSearchScreenData", () => {
  it("returns a de-duplicated tag union in first-seen order", () => {
    expect(getSearchScreenData({ items, spaces, query: "" }).allTags).toEqual(["daily", "coffee", "tools", "winter"]);
  });

  it("returns all items for an empty or whitespace query", () => {
    expect(getSearchScreenData({ items, spaces, query: "   " }).listToShow.map((result) => result.item.id)).toEqual([
      "mug",
      "drill",
      "blanket"
    ]);
  });

  it("matches by item name, tag, space name, and area snapshot using picker query semantics", () => {
    expect(getSearchScreenData({ items, spaces, query: "ceramic" }).listToShow.map((result) => result.item.id)).toEqual(["mug"]);
    expect(getSearchScreenData({ items, spaces, query: "TOOLS" }).listToShow.map((result) => result.item.id)).toEqual(["drill"]);
    expect(getSearchScreenData({ items, spaces, query: "GARAGE" }).listToShow.map((result) => result.item.id)).toEqual(["drill"]);
    expect(getSearchScreenData({ items, spaces, query: "upper cabinet" }).listToShow.map((result) => result.item.id)).toEqual([
      "mug"
    ]);
  });

  it("represents tag pill queries as plain query text", () => {
    expect(getSearchScreenData({ items, spaces, query: "daily" }).listToShow.map((result) => result.item.id)).toEqual([
      "mug",
      "drill"
    ]);
  });
});
