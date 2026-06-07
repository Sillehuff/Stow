import { describe, expect, it } from "vitest";
import { defaultItemStatus } from "@/features/stow/services/itemMetadata";

describe("defaultItemStatus", () => {
  it("preserves an explicit valid status", () => {
    expect(defaultItemStatus({ status: "lent" })).toBe("lent");
    expect(defaultItemStatus({ status: "repair", isPacked: false })).toBe("repair");
    expect(defaultItemStatus({ status: "lost" })).toBe("lost");
    expect(defaultItemStatus({ status: "home" })).toBe("home");
    expect(defaultItemStatus({ status: "packed" })).toBe("packed");
  });

  it("derives a missing status from isPacked", () => {
    expect(defaultItemStatus({ isPacked: true })).toBe("packed");
    expect(defaultItemStatus({ isPacked: false })).toBe("home");
    expect(defaultItemStatus({})).toBe("home");
  });

  it("ignores an unrecognized status value and falls back to the isPacked derivation", () => {
    expect(defaultItemStatus({ status: "bogus", isPacked: true })).toBe("packed");
    expect(defaultItemStatus({ status: 7 as unknown, isPacked: false })).toBe("home");
  });
});
