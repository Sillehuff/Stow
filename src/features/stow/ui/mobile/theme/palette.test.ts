import { describe, expect, it } from "vitest";
import { makePalette, DEFAULT_ACCENT } from "@/features/stow/ui/mobile/theme/palette";

describe("makePalette", () => {
  it("defaults to the brand orange accent and light canvas", () => {
    const p = makePalette();
    expect(p.accent).toBe(DEFAULT_ACCENT);
    expect(p.accent).toBe("#E8652B");
    expect(p.canvas).toBe("#F7F7FA");
    expect(p.ink).toBe("#1A1A2E");
  });

  it("derives relative radii from the base radius", () => {
    const p = makePalette({ radius: 12 });
    expect(p.radius).toBe(12);
    expect(p.radiusCard).toBe(20);
    expect(p.radiusButton).toBe(18);
    expect(p.radiusInput).toBe(14);
  });

  it("builds accentSoft as a color-mix tint of the accent", () => {
    expect(makePalette({ accent: "#E8652B" }).accentSoft).toBe(
      "color-mix(in srgb, #E8652B 12%, #FFFFFF)"
    );
  });

  it("applies dark overrides", () => {
    const p = makePalette({ dark: true });
    expect(p.canvas).toBe("#101019");
    expect(p.ink).toBe("#F4F4F8");
    expect(p.surface).toBe("#181822");
    expect(p.accentSoft).toBe("color-mix(in srgb, #E8652B 22%, #181822)");
  });
});
