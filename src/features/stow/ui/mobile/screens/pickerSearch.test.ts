import { describe, expect, it } from "vitest";
import { matchesPackingItemPickerQuery, normalizePackingItemPickerQuery } from "@/features/stow/ui/mobile/screens/pickerSearch";

describe("normalizePackingItemPickerQuery", () => {
  it("collapses repeated whitespace", () => {
    expect(normalizePackingItemPickerQuery("  Travel   Gear ")).toBe("travel gear");
  });
});

describe("matchesPackingItemPickerQuery", () => {
  it("matches an empty query", () => {
    expect(matchesPackingItemPickerQuery("", ["Space Heater", "Main", "Travel Gear"])).toBe(true);
  });

  it("matches by item name", () => {
    expect(matchesPackingItemPickerQuery("heater", ["Space Heater", "Main", "Travel Gear"])).toBe(true);
  });

  it("matches by area name", () => {
    expect(matchesPackingItemPickerQuery("main", ["Space Heater", "Main", "Travel Gear"])).toBe(true);
  });

  it("matches by space name", () => {
    expect(matchesPackingItemPickerQuery("travel", ["Space Heater", "Main", "Travel Gear"])).toBe(true);
  });

  it("matches with extra spaces in the query", () => {
    expect(matchesPackingItemPickerQuery("travel   gear", ["Space Heater", "Main", "Travel Gear"])).toBe(true);
  });
});
