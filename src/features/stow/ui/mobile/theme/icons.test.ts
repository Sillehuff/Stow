import { describe, expect, it } from "vitest";
import { iconForKey, ICONS, FALLBACK_ICON, ICON_CATEGORIES } from "@/features/stow/ui/mobile/theme/icons";

describe("iconForKey", () => {
  it("returns the mapped glyph for a known key", () => {
    expect(iconForKey("home")).toBe(ICONS.home);
    expect(iconForKey("coffee")).toBe(ICONS.coffee);
  });

  it("falls back for unknown or empty keys", () => {
    expect(iconForKey("definitely-not-an-icon")).toBe(FALLBACK_ICON);
    expect(iconForKey(undefined)).toBe(FALLBACK_ICON);
    expect(iconForKey(null)).toBe(FALLBACK_ICON);
    expect(iconForKey("")).toBe(FALLBACK_ICON);
  });

  it("resolves the expanded room/kitchen/outdoor keys added in P1", () => {
    for (const key of ["tv", "door", "shirt", "book", "music", "heart", "gift", "key", "plug", "clock", "wash"]) {
      expect(iconForKey(key)).toBe(ICONS[key]);
    }
  });
});

describe("ICON_CATEGORIES", () => {
  it("exposes the four spec categories", () => {
    expect(ICON_CATEGORIES.map((c) => c.key)).toEqual(["rooms", "storage", "kitchen", "outdoor"]);
  });

  it("only references keys present in ICONS", () => {
    for (const category of ICON_CATEGORIES) {
      for (const key of category.icons) {
        expect(ICONS[key], `category ${category.key} key ${key}`).toBeDefined();
      }
    }
  });
});
