import { describe, expect, it } from "vitest";
import { buildActivityEntry } from "@/features/stow/services/repository";

const actor = { actorUid: "u1", actorName: "Sam Rivera" };

describe("buildActivityEntry", () => {
  it("shapes an item_added entry", () => {
    const e = buildActivityEntry({
      type: "item_added",
      ...actor,
      itemName: "Drill",
      spaceName: "Garage",
      areaName: "Toolbox",
      spaceId: "s1",
      areaId: "a1",
      itemId: "i1"
    });
    expect(e).toEqual({
      type: "item_added",
      actorUid: "u1",
      actorName: "Sam Rivera",
      summary: "Sam added Drill to Garage › Toolbox",
      spaceId: "s1",
      areaId: "a1",
      itemId: "i1"
    });
  });

  it("shapes an items_added_batch entry with a count", () => {
    const e = buildActivityEntry({
      type: "items_added_batch",
      ...actor,
      count: 3,
      spaceName: "Garage",
      areaName: "Toolbox",
      spaceId: "s1",
      areaId: "a1"
    });
    expect(e.summary).toBe("Sam added 3 items to Garage › Toolbox");
    expect(e.count).toBe(3);
    expect(e.itemId).toBeUndefined();
  });

  it("singularizes a batch of one", () => {
    const e = buildActivityEntry({
      type: "items_added_batch",
      ...actor,
      count: 1,
      spaceName: "Garage",
      areaName: "Toolbox"
    });
    expect(e.summary).toBe("Sam added 1 item to Garage › Toolbox");
  });

  it("shapes an item_moved entry", () => {
    const e = buildActivityEntry({
      type: "item_moved",
      ...actor,
      itemName: "Drill",
      spaceName: "Garage",
      areaName: "Toolbox",
      spaceId: "s1",
      areaId: "a1",
      itemId: "i1"
    });
    expect(e.summary).toBe("Sam moved Drill to Garage › Toolbox");
  });

  it("shapes an item_deleted entry (no location)", () => {
    const e = buildActivityEntry({ type: "item_deleted", ...actor, itemName: "Drill" });
    expect(e.summary).toBe("Sam deleted Drill");
    expect(e.spaceId).toBeUndefined();
  });

  it("shapes an item_status_changed entry using the status label", () => {
    const lent = buildActivityEntry({
      type: "item_status_changed",
      ...actor,
      itemName: "Tent",
      status: "lent",
      loanTo: "Marcus",
      itemId: "i9"
    });
    expect(lent.summary).toBe("Sam marked Tent lent to Marcus");

    const repair = buildActivityEntry({
      type: "item_status_changed",
      ...actor,
      itemName: "Mic",
      status: "repair",
      itemId: "i8"
    });
    expect(repair.summary).toBe("Sam marked Mic in repair");

    const home = buildActivityEntry({
      type: "item_status_changed",
      ...actor,
      itemName: "Mic",
      status: "home",
      itemId: "i8"
    });
    expect(home.summary).toBe("Sam marked Mic back home");
  });

  it("shapes space_added / space_deleted entries", () => {
    expect(buildActivityEntry({ type: "space_added", ...actor, spaceName: "Garage", spaceId: "s1" }).summary).toBe(
      "Sam added the Garage space"
    );
    expect(buildActivityEntry({ type: "space_deleted", ...actor, spaceName: "Garage" }).summary).toBe(
      "Sam deleted the Garage space"
    );
  });

  it("uses the actor's first name only", () => {
    expect(
      buildActivityEntry({ type: "item_deleted", actorUid: "u2", actorName: "Jess Park", itemName: "X" }).summary
    ).toBe("Jess deleted X");
  });

  it("omits undefined optional id/count keys (so Firestore never sees undefined)", () => {
    const e = buildActivityEntry({ type: "item_deleted", ...actor, itemName: "Drill" });
    expect(Object.prototype.hasOwnProperty.call(e, "spaceId")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, "areaId")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, "itemId")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, "count")).toBe(false);
  });
});
