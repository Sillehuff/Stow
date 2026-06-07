import { describe, expect, it } from "vitest";
import { buildInventoryCsv } from "@/features/stow/ui/mobile/screens/inventoryCsv";
import type { Item, SpaceWithAreas } from "@/types/domain";

const space = { id: "s1", name: "Garage", areas: [] } as unknown as SpaceWithAreas;
const baseItem = {
  id: "i1", spaceId: "s1", areaNameSnapshot: "Shelf A", name: "Drill",
  tags: ["Tools"], value: 90, notes: "DeWalt", isPacked: false, isPriceless: false, kind: "item",
} as unknown as Item;

describe("buildInventoryCsv", () => {
  it("emits a header row and one row per item", () => {
    const csv = buildInventoryCsv([baseItem], [space]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Space,Area,Tags,Value,Priceless,Packed,Notes");
    expect(lines[1]).toBe("Drill,Garage,Shelf A,Tools,90,No,No,DeWalt");
  });
  it("quotes and escapes fields containing commas, quotes, or newlines", () => {
    const tricky = { ...baseItem, name: 'Saw, "rusty"', notes: "line1\nline2" } as unknown as Item;
    const csv = buildInventoryCsv([tricky], [space]);
    const row = csv.split("\n").slice(1).join("\n");
    expect(row).toContain('"Saw, ""rusty"""');
    expect(row).toContain('"line1\nline2"');
  });
  it("joins multiple tags with a semicolon and marks priceless/packed", () => {
    const multi = { ...baseItem, tags: ["A", "B"], isPriceless: true, isPacked: true, value: undefined } as unknown as Item;
    const csv = buildInventoryCsv([multi], [space]);
    expect(csv.split("\n")[1]).toBe("Drill,Garage,Shelf A,A;B,,Yes,Yes,DeWalt");
  });
  it("uses an empty space name when the space is unknown", () => {
    const orphan = { ...baseItem, spaceId: "missing" } as unknown as Item;
    expect(buildInventoryCsv([orphan], [space]).split("\n")[1]).toBe("Drill,,Shelf A,Tools,90,No,No,DeWalt");
  });
});
