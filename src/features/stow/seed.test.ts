import { describe, expect, it } from "vitest";
import { buildStarterSpaces, seedSpaceTemplates } from "./seed";

describe("buildStarterSpaces", () => {
  it("produces one space per template with contiguous positions and no items/images", () => {
    const { spaces, areas } = buildStarterSpaces("h1");
    expect(spaces).toHaveLength(seedSpaceTemplates.length);
    spaces.forEach((space, index) => {
      expect(space.householdId).toBe("h1");
      expect(space.position).toBe(index);
      expect("image" in space && space.image !== undefined).toBe(false);
    });
  });

  it("produces areas linked to their space with per-space positions", () => {
    const { areas } = buildStarterSpaces("h1");
    const livingRoomAreas = areas.filter((area) => area.spaceId === "r1");
    expect(livingRoomAreas.map((area) => area.position)).toEqual([0, 1, 2]);
    areas.forEach((area) => expect(area.householdId).toBe("h1"));
  });
});
