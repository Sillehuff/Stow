import { describe, expect, it } from "vitest";
import { parseMobileRoute, buildMobilePath } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";

const sp = (s = "") => new URLSearchParams(s);

describe("parseMobileRoute", () => {
  it("defaults to the spaces tab at the base path", () => {
    expect(parseMobileRoute("/app", sp(), "/app")).toEqual({
      tab: "spaces",
      spaceId: null,
      areaId: null,
      itemId: null
    });
    expect(parseMobileRoute("/app/", sp(), "/app")).toEqual({
      tab: "spaces",
      spaceId: null,
      areaId: null,
      itemId: null
    });
  });

  it("parses tab paths", () => {
    expect(parseMobileRoute("/app/search", sp(), "/app").tab).toBe("search");
    expect(parseMobileRoute("/app/packing", sp(), "/app").tab).toBe("packing");
    expect(parseMobileRoute("/app/settings", sp(), "/app").tab).toBe("settings");
  });

  it("parses space and area paths", () => {
    expect(parseMobileRoute("/app/spaces/s1", sp(), "/app")).toEqual({
      tab: "spaces",
      spaceId: "s1",
      areaId: null,
      itemId: null
    });
    expect(parseMobileRoute("/app/spaces/s1/areas/a1", sp(), "/app")).toEqual({
      tab: "spaces",
      spaceId: "s1",
      areaId: "a1",
      itemId: null
    });
  });

  it("parses item paths and recovers the origin tab from ?from", () => {
    expect(parseMobileRoute("/app/items/i1", sp("from=search"), "/app")).toEqual({
      tab: "search",
      spaceId: null,
      areaId: null,
      itemId: "i1"
    });
    expect(parseMobileRoute("/app/items/i1", sp(), "/app").tab).toBe("spaces");
  });

  it("is prefix-aware so cutover can use an empty base", () => {
    expect(parseMobileRoute("/spaces/s1", sp(), "").tab).toBe("spaces");
    expect(parseMobileRoute("/spaces/s1", sp(), "").spaceId).toBe("s1");
  });
});

describe("buildMobilePath", () => {
  it("builds tab, space, area, and item paths under the base", () => {
    expect(buildMobilePath("/app", { tab: "search" })).toBe("/app/search");
    expect(buildMobilePath("/app", { spaceId: "s1" })).toBe("/app/spaces/s1");
    expect(buildMobilePath("/app", { spaceId: "s1", areaId: "a1" })).toBe("/app/spaces/s1/areas/a1");
    expect(buildMobilePath("/app", { itemId: "i1" })).toBe("/app/items/i1");
  });

  it("collapses the base for cutover", () => {
    expect(buildMobilePath("", { tab: "settings" })).toBe("/settings");
  });
});
