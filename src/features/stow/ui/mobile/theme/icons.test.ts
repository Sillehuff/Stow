import { describe, expect, it } from "vitest";
import { iconForKey, ICONS, FALLBACK_ICON } from "@/features/stow/ui/mobile/theme/icons";

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
});
