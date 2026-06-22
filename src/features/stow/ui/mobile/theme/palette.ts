export interface PaletteInput {
  accent?: string;
  dark?: boolean;
  radius?: number;
}

export interface Palette {
  ink: string;
  inkSoft: string;
  inkMuted: string;
  warm: string;
  border: string;
  borderL: string;
  surface: string;
  canvas: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  shadow: string;
  shadowSoft: string;
  radius: number;
  radiusCard: number;
  radiusButton: number;
  radiusInput: number;
}

export const DEFAULT_ACCENT = "#E8652B";

export function makePalette(input: PaletteInput = {}): Palette {
  const accent = input.accent ?? DEFAULT_ACCENT;
  const dark = input.dark ?? false;
  const radius = input.radius ?? 12;

  const base = dark
    ? {
        ink: "#F4F4F8",
        inkSoft: "#D7D7E0",
        inkMuted: "#9A9AAE",
        warm: "#76768A",
        border: "#2C2C3C",
        borderL: "#23232F",
        surface: "#181822",
        canvas: "#101019",
        accentSoft: `color-mix(in srgb, ${accent} 22%, #181822)`,
        // Accent text reads on the dark accent-soft tint; the accent itself clears AA there.
        accentText: accent,
        success: "#34C088",
        successSoft: "color-mix(in srgb, #34C088 18%, #181822)",
        danger: "#F26060",
        dangerSoft: "color-mix(in srgb, #F26060 18%, #181822)",
        shadow: "0 2px 12px rgba(0,0,0,0.4)",
        shadowSoft: "0 1px 3px rgba(0,0,0,0.3)"
      }
    : {
        ink: "#1A1A2E",
        inkSoft: "#2D2D44",
        inkMuted: "#6B6B80",
        // Darkened from #9595A8 (2.75:1) to clear WCAG AA (4.5:1) for small secondary text on canvas.
        warm: "#6E6E84",
        border: "#E8E8EE",
        borderL: "#F0F0F5",
        surface: "#FFFFFF",
        canvas: "#F7F7FA",
        accentSoft: `color-mix(in srgb, ${accent} 12%, #FFFFFF)`,
        // Darker accent shade that clears AA (4.5:1) as text on the accent-soft tint.
        accentText: "#B5470F",
        success: "#2D9F6F",
        successSoft: "#EAFAF2",
        danger: "#E04545",
        dangerSoft: "#FFF0F0",
        shadow: "0 2px 10px rgba(0,0,0,0.05)",
        shadowSoft: "0 1px 3px rgba(0,0,0,0.04)"
      };

  return {
    ...base,
    accent,
    radius,
    radiusCard: radius + 8,
    radiusButton: radius + 6,
    radiusInput: radius + 2
  };
}

const VAR_MAP: Record<keyof Palette, string> = {
  ink: "--stow-ink",
  inkSoft: "--stow-ink-soft",
  inkMuted: "--stow-ink-muted",
  warm: "--stow-warm",
  border: "--stow-border",
  borderL: "--stow-border-l",
  surface: "--stow-surface",
  canvas: "--stow-canvas",
  accent: "--stow-accent",
  accentSoft: "--stow-accent-soft",
  accentText: "--stow-accent-text",
  success: "--stow-success",
  successSoft: "--stow-success-soft",
  danger: "--stow-danger",
  dangerSoft: "--stow-danger-soft",
  shadow: "--stow-shadow",
  shadowSoft: "--stow-shadow-soft",
  radius: "--stow-radius",
  radiusCard: "--stow-radius-card",
  radiusButton: "--stow-radius-button",
  radiusInput: "--stow-radius-input"
};

export function applyPalette(el: HTMLElement, palette: Palette): void {
  for (const [key, value] of Object.entries(palette)) {
    const cssVar = VAR_MAP[key as keyof Palette];
    if (!cssVar) continue;
    el.style.setProperty(cssVar, typeof value === "number" ? `${value}px` : value);
  }
}
