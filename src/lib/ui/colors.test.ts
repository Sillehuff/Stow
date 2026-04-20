import { describe, expect, it } from "vitest";
import { randomHexColor, withAlpha } from "@/lib/ui/colors";

describe("randomHexColor", () => {
  it("returns a hex value that works with color inputs", () => {
    expect(randomHexColor()).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe("withAlpha", () => {
  it("returns a CSS color-mix string for arbitrary colors", () => {
    expect(withAlpha("hsl(10 50% 50%)", 0.08)).toBe("color-mix(in srgb, hsl(10 50% 50%) 8%, transparent)");
  });
});
