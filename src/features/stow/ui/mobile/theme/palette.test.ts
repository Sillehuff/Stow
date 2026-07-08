import { describe, expect, it } from "vitest";
import { makePalette, DEFAULT_ACCENT } from "@/features/stow/ui/mobile/theme/palette";

function luminance(hex: string) {
  const parts = hex
    .replace("#", "")
    .match(/.{2}/g)
    ?.map((part) => parseInt(part, 16) / 255);
  if (!parts) throw new Error(`Invalid hex color: ${hex}`);
  const [r, g, b] = parts.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: string, background: string) {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

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

  it("keeps small text and filled controls at AA contrast in the light palette", () => {
    const p = makePalette();
    expect(contrastRatio(p.accentText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.accentText, "#FCEDE6")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#FFFFFF", p.accentStrong)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.dangerText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.dangerText, p.dangerSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.successText, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.successText, p.successSoft)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.packedText, "#ECEEF8")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(p.repairText, "#F8F0E2")).toBeGreaterThanOrEqual(4.5);
  });

  it("applies dark overrides", () => {
    const p = makePalette({ dark: true });
    expect(p.canvas).toBe("#101019");
    expect(p.ink).toBe("#F4F4F8");
    expect(p.surface).toBe("#181822");
    expect(p.accentSoft).toBe("color-mix(in srgb, #E8652B 22%, #181822)");
  });
});
