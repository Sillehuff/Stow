# Stow Mobile Redesign — P0 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a themed, navigable, data-wired empty shell of the new mobile Stow app at a dev route `/app`, without touching the legacy `/spaces` or desktop `/next` apps.

**Architecture:** A new module `src/features/stow/ui/mobile/` with a CSS-custom-property design-token system, a bottom-tab shell + scan FAB, a purpose-built **prefix-aware URL navigation** hook (so `/app` doesn't collide with legacy canonical paths; the parser is a pure, unit-tested function), wired to the existing shared `useWorkspaceData` data layer. Mounted via a new `StowMobileRoutePage` cloned from `StowNextRoutePage`.

**Tech Stack:** React 19 + TypeScript, react-router-dom v7, lucide-react, Vite, Vitest (node env, pure-function tests — repo has no jsdom/RTL).

**Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md` · **Roadmap:** `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md`

**Conventions:**
- Run a single test file with `npx vitest run <path>`; the full unit suite with `npm test`.
- There is **no `verify` script**; "verify" = `npm run typecheck && npm test && npm run build`.
- End every commit message with the repo trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Scope note: overlay primitives (Sheet/Confirm/ActionSheet) and base components (Card/Button/Chip/Field) are **not** built in P0 — they land in P1 when first consumed (YAGNI). P0 ships tokens, icons, BottomNav, Toast, nav, shell, route.

---

## Task 1: Design-token palette (`makePalette`)

**Files:**
- Create: `src/features/stow/ui/mobile/theme/palette.ts`
- Test: `src/features/stow/ui/mobile/theme/palette.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/features/stow/ui/mobile/theme/palette.test.ts
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
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/theme/palette.test.ts`
Expected: FAIL — "Failed to resolve import" / `makePalette is not a function`.

- [x] **Step 3: Write the implementation**

```ts
// src/features/stow/ui/mobile/theme/palette.ts
export interface PaletteInput {
  accent?: string;
  dark?: boolean;
  radius?: number;
}

export interface Palette {
  ink: string; inkSoft: string; inkMuted: string; warm: string;
  border: string; borderL: string; surface: string; canvas: string;
  accent: string; accentSoft: string;
  success: string; successSoft: string; danger: string; dangerSoft: string;
  shadow: string; shadowSoft: string;
  radius: number; radiusCard: number; radiusButton: number; radiusInput: number;
}

export const DEFAULT_ACCENT = "#E8652B";

export function makePalette(input: PaletteInput = {}): Palette {
  const accent = input.accent ?? DEFAULT_ACCENT;
  const dark = input.dark ?? false;
  const radius = input.radius ?? 12;

  const base = dark
    ? {
        ink: "#F4F4F8", inkSoft: "#D7D7E0", inkMuted: "#9A9AAE", warm: "#76768A",
        border: "#2C2C3C", borderL: "#23232F", surface: "#181822", canvas: "#101019",
        accentSoft: `color-mix(in srgb, ${accent} 22%, #181822)`,
        success: "#34C088", successSoft: `color-mix(in srgb, #34C088 18%, #181822)`,
        danger: "#F26060", dangerSoft: `color-mix(in srgb, #F26060 18%, #181822)`,
        shadow: "0 2px 12px rgba(0,0,0,0.4)", shadowSoft: "0 1px 3px rgba(0,0,0,0.3)",
      }
    : {
        ink: "#1A1A2E", inkSoft: "#2D2D44", inkMuted: "#6B6B80", warm: "#9595A8",
        border: "#E8E8EE", borderL: "#F0F0F5", surface: "#FFFFFF", canvas: "#F7F7FA",
        accentSoft: `color-mix(in srgb, ${accent} 12%, #FFFFFF)`,
        success: "#2D9F6F", successSoft: "#EAFAF2",
        danger: "#E04545", dangerSoft: "#FFF0F0",
        shadow: "0 2px 10px rgba(0,0,0,0.05)", shadowSoft: "0 1px 3px rgba(0,0,0,0.04)",
      };

  return {
    ...base,
    accent,
    radius,
    radiusCard: radius + 8,
    radiusButton: radius + 6,
    radiusInput: radius + 2,
  };
}

const VAR_MAP: Record<keyof Palette, string> = {
  ink: "--stow-ink", inkSoft: "--stow-ink-soft", inkMuted: "--stow-ink-muted", warm: "--stow-warm",
  border: "--stow-border", borderL: "--stow-border-l", surface: "--stow-surface", canvas: "--stow-canvas",
  accent: "--stow-accent", accentSoft: "--stow-accent-soft",
  success: "--stow-success", successSoft: "--stow-success-soft",
  danger: "--stow-danger", dangerSoft: "--stow-danger-soft",
  shadow: "--stow-shadow", shadowSoft: "--stow-shadow-soft",
  radius: "--stow-radius", radiusCard: "--stow-radius-card",
  radiusButton: "--stow-radius-button", radiusInput: "--stow-radius-input",
};

export function applyPalette(el: HTMLElement, palette: Palette): void {
  for (const [key, value] of Object.entries(palette)) {
    const cssVar = VAR_MAP[key as keyof Palette];
    if (!cssVar) continue;
    el.style.setProperty(cssVar, typeof value === "number" ? `${value}px` : value);
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/theme/palette.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/theme/palette.ts src/features/stow/ui/mobile/theme/palette.test.ts
git commit -m "feat(mobile): add makePalette design tokens"
```

---

## Task 2: Token CSS scaffolding + keyframes

**Files:**
- Create: `src/features/stow/ui/mobile/theme/tokens.css`

- [x] **Step 1: Create the stylesheet** (no test — CSS; verified by build + manual load)

```css
/* src/features/stow/ui/mobile/theme/tokens.css */
.stow-mobile {
  /* Fallback token defaults; overridden at runtime by applyPalette(). */
  --stow-ink: #1a1a2e; --stow-ink-soft: #2d2d44; --stow-ink-muted: #6b6b80; --stow-warm: #9595a8;
  --stow-border: #e8e8ee; --stow-border-l: #f0f0f5; --stow-surface: #ffffff; --stow-canvas: #f7f7fa;
  --stow-accent: #e8652b; --stow-accent-soft: color-mix(in srgb, #e8652b 12%, #ffffff);
  --stow-success: #2d9f6f; --stow-success-soft: #eafaf2; --stow-danger: #e04545; --stow-danger-soft: #fff0f0;
  --stow-shadow: 0 2px 10px rgba(0,0,0,0.05); --stow-shadow-soft: 0 1px 3px rgba(0,0,0,0.04);
  --stow-radius: 12px; --stow-radius-card: 20px; --stow-radius-button: 18px; --stow-radius-input: 14px;
  --stow-display: "Clash Display", "SF Pro Display", system-ui, sans-serif;
  --stow-body: "Inter Tight", -apple-system, system-ui, sans-serif;

  position: fixed; inset: 0;
  display: flex; align-items: stretch; justify-content: center;
  background: radial-gradient(120% 80% at 50% -10%, #20202c 0%, #14141c 55%, #0d0d13 100%);
  font-family: var(--stow-body);
  color: var(--stow-ink);
  -webkit-font-smoothing: antialiased;
}

.stow-mobile *, .stow-mobile *::before, .stow-mobile *::after { box-sizing: border-box; }

.stow-mobile__viewport {
  position: relative;
  width: 100%; max-width: 440px;
  background: var(--stow-canvas);
  display: flex; flex-direction: column;
  overflow: hidden;
}
@media (min-width: 700px) {
  .stow-mobile__viewport {
    margin: 24px 0; height: calc(100% - 48px);
    border-radius: 32px; box-shadow: 0 40px 80px rgba(0,0,0,0.35);
  }
}

.stow-mobile__screen {
  flex: 1; overflow-y: auto;
  padding-bottom: 150px; /* clear the floating nav */
}
.stow-mobile__screen::-webkit-scrollbar { width: 0; height: 0; }
.stow-mobile__screen { scrollbar-width: none; }

@keyframes stowUp { from { transform: translateY(18px); } to { transform: translateY(0); } }
@keyframes stowPop { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes stowToast { from { transform: translate(-50%, 10px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
@keyframes stowScan { 0% { top: 8px; } 50% { top: calc(100% - 11px); } 100% { top: 8px; } }
@keyframes capSweep { 0% { transform: translateY(-40px); opacity: 0; } 10% { opacity: .85; } 90% { opacity: .85; } 100% { transform: translateY(820px); opacity: 0; } }
@keyframes capPop { 0% { opacity: 0; transform: scale(.92); } 100% { opacity: 1; transform: scale(1); } }
@keyframes capDots { 0%, 20% { opacity: .25; } 50% { opacity: 1; } 80%, 100% { opacity: .25; } }
@media (prefers-reduced-motion: reduce) { .stow-mobile * { animation: none !important; } }
```

- [x] **Step 2: Commit**

```bash
git add src/features/stow/ui/mobile/theme/tokens.css
git commit -m "feat(mobile): add token CSS scaffolding and keyframes"
```

---

## Task 3: Font links

**Files:**
- Modify: `index.html` (head, after the `<title>` on line 11)

- [x] **Step 1: Add the font `<link>`s**

Find in `index.html`:
```html
    <title>Stow</title>
  </head>
```
Replace with:
```html
    <title>Stow</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    <link href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&display=swap" rel="stylesheet" />
  </head>
```

- [x] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat(mobile): load Clash Display + Inter Tight fonts"
```

---

## Task 4: Icon registry (`iconForKey`)

**Files:**
- Create: `src/features/stow/ui/mobile/theme/icons.tsx`
- Test: `src/features/stow/ui/mobile/theme/icons.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/features/stow/ui/mobile/theme/icons.test.ts
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
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/theme/icons.test.ts`
Expected: FAIL — import cannot be resolved.

- [x] **Step 3: Write the implementation**

> Note: every name below is a real lucide-react export, but versions drift. After writing, run `npm run typecheck`; if any import errors, swap that name for an existing one (`node -e "console.log(Object.keys(require('lucide-react')))"`).

```tsx
// src/features/stow/ui/mobile/theme/icons.tsx
import {
  Home, Search, Package, Settings, ScanLine, Plus, Bell, MapPin, Tag, Camera,
  Box, Folder, Coffee, Briefcase, Bed, Sofa, Bath, Car, Wrench, Leaf, Sun,
  Utensils, Wine, Refrigerator, Archive, ChevronRight, ChevronLeft, X, Check,
  MoreHorizontal, Trash2, Pencil,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Space/area icons addressable by a free-form string key (validated here). */
export const ICONS: Record<string, LucideIcon> = {
  home: Home, coffee: Coffee, briefcase: Briefcase, box: Box, folder: Folder,
  bed: Bed, sofa: Sofa, bath: Bath, car: Car, wrench: Wrench, leaf: Leaf, sun: Sun,
  utensils: Utensils, wine: Wine, fridge: Refrigerator, archive: Archive, package: Package,
};

export const FALLBACK_ICON: LucideIcon = Box;

export interface IconCategory { key: string; label: string; icons: string[]; }
export const ICON_CATEGORIES: IconCategory[] = [
  { key: "rooms", label: "Rooms", icons: ["home", "bed", "sofa", "bath"] },
  { key: "storage", label: "Storage", icons: ["box", "package", "folder", "archive"] },
  { key: "kitchen", label: "Kitchen", icons: ["coffee", "utensils", "wine", "fridge"] },
  { key: "outdoor", label: "Outdoor", icons: ["leaf", "car", "sun", "wrench"] },
];

export function iconForKey(key: string | undefined | null): LucideIcon {
  if (key && ICONS[key]) return ICONS[key];
  return FALLBACK_ICON;
}

// Shell/UI glyphs re-exported from one place.
export {
  Home, Search, Package, Settings, ScanLine, Plus, Bell, MapPin, Tag, Camera,
  ChevronRight, ChevronLeft, X, Check, MoreHorizontal, Trash2, Pencil,
};
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/theme/icons.test.ts`
Expected: PASS (2 tests).

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/theme/icons.tsx src/features/stow/ui/mobile/theme/icons.test.ts
git commit -m "feat(mobile): add icon registry with fallback + categories"
```

---

## Task 5: Prefix-aware navigation (pure parser + hook)

**Files:**
- Create: `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts`
- Test: `src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`

- [x] **Step 1: Write the failing test** (pure functions only)

```ts
// src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts
import { describe, expect, it } from "vitest";
import { parseMobileRoute, buildMobilePath } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";

const sp = (s = "") => new URLSearchParams(s);

describe("parseMobileRoute", () => {
  it("defaults to the spaces tab at the base path", () => {
    expect(parseMobileRoute("/app", sp(), "/app")).toEqual({ tab: "spaces", spaceId: null, areaId: null, itemId: null });
    expect(parseMobileRoute("/app/", sp(), "/app")).toEqual({ tab: "spaces", spaceId: null, areaId: null, itemId: null });
  });
  it("parses tab paths", () => {
    expect(parseMobileRoute("/app/search", sp(), "/app").tab).toBe("search");
    expect(parseMobileRoute("/app/packing", sp(), "/app").tab).toBe("packing");
    expect(parseMobileRoute("/app/settings", sp(), "/app").tab).toBe("settings");
  });
  it("parses space and area paths", () => {
    expect(parseMobileRoute("/app/spaces/s1", sp(), "/app")).toEqual({ tab: "spaces", spaceId: "s1", areaId: null, itemId: null });
    expect(parseMobileRoute("/app/spaces/s1/areas/a1", sp(), "/app")).toEqual({ tab: "spaces", spaceId: "s1", areaId: "a1", itemId: null });
  });
  it("parses item paths and recovers the origin tab from ?from", () => {
    expect(parseMobileRoute("/app/items/i1", sp("from=search"), "/app")).toEqual({ tab: "search", spaceId: null, areaId: null, itemId: "i1" });
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
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`
Expected: FAIL — import cannot be resolved.

- [x] **Step 3: Write the implementation**

```ts
// src/features/stow/ui/mobile/hooks/useMobileNavigation.ts
import { useMemo, useState } from "react";
import { matchPath, useLocation, useNavigate, useSearchParams } from "react-router-dom";

export type MobileTab = "spaces" | "search" | "packing" | "settings";

export interface MobileRoute {
  tab: MobileTab;
  spaceId: string | null;
  areaId: string | null;
  itemId: string | null;
}

export type OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace";
export interface OverlayState { kind: OverlayKind | null; payload?: Record<string, unknown>; }

function isTab(value: string | null): value is MobileTab {
  return value === "spaces" || value === "search" || value === "packing" || value === "settings";
}

function stripBase(pathname: string, basePath: string): string {
  if (!basePath || basePath === "/") return pathname || "/";
  if (pathname === basePath) return "/";
  if (pathname.startsWith(`${basePath}/`)) return pathname.slice(basePath.length) || "/";
  return pathname;
}

export function parseMobileRoute(pathname: string, params: URLSearchParams, basePath = "/app"): MobileRoute {
  const rel = stripBase(pathname, basePath);

  const item = matchPath("/items/:itemId", rel);
  if (item?.params.itemId) {
    const from = params.get("from");
    return {
      tab: isTab(from) ? from : "spaces",
      spaceId: params.get("spaceId"),
      areaId: params.get("areaId"),
      itemId: item.params.itemId,
    };
  }

  const area = matchPath("/spaces/:spaceId/areas/:areaId", rel);
  if (area?.params.spaceId && area.params.areaId) {
    return { tab: "spaces", spaceId: area.params.spaceId, areaId: area.params.areaId, itemId: null };
  }

  const space = matchPath("/spaces/:spaceId", rel);
  if (space?.params.spaceId) {
    return { tab: "spaces", spaceId: space.params.spaceId, areaId: null, itemId: null };
  }

  if (rel === "/search") return { tab: "search", spaceId: null, areaId: null, itemId: null };
  if (rel === "/packing") return { tab: "packing", spaceId: null, areaId: null, itemId: null };
  if (rel === "/settings") return { tab: "settings", spaceId: null, areaId: null, itemId: null };
  return { tab: "spaces", spaceId: null, areaId: null, itemId: null };
}

export function buildMobilePath(
  basePath: string,
  route: { tab?: MobileTab; spaceId?: string | null; areaId?: string | null; itemId?: string | null }
): string {
  const b = basePath === "/" ? "" : basePath;
  if (route.itemId) return `${b}/items/${route.itemId}`;
  if (route.spaceId && route.areaId) return `${b}/spaces/${route.spaceId}/areas/${route.areaId}`;
  if (route.spaceId) return `${b}/spaces/${route.spaceId}`;
  return `${b}/${route.tab ?? "spaces"}`;
}

export function useMobileNavigation(householdId: string, basePath = "/app") {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const route = useMemo(
    () => parseMobileRoute(location.pathname, params, basePath),
    [location.pathname, params, basePath]
  );
  const [overlay, setOverlay] = useState<OverlayState>({ kind: null });

  function navigateToTab(tab: MobileTab) {
    navigate(buildMobilePath(basePath, { tab }));
  }
  function openSpace(spaceId: string, areaId?: string | null) {
    navigate(buildMobilePath(basePath, { spaceId, areaId: areaId ?? null }));
  }
  function openItem(itemId: string) {
    const next = new URLSearchParams();
    next.set("from", route.tab);
    if (route.spaceId) next.set("spaceId", route.spaceId);
    if (route.areaId) next.set("areaId", route.areaId);
    navigate(`${buildMobilePath(basePath, { itemId })}?${next.toString()}`);
  }
  function back() {
    navigate(-1);
  }
  function openOverlay(kind: OverlayKind, payload?: Record<string, unknown>) {
    setOverlay({ kind, payload });
  }
  function closeOverlay() {
    setOverlay({ kind: null });
  }

  return {
    householdId,
    basePath,
    route,
    tab: route.tab,
    selectedSpaceId: route.spaceId,
    selectedAreaId: route.areaId,
    selectedItemId: route.itemId,
    overlay,
    navigateToTab,
    openSpace,
    openItem,
    back,
    openOverlay,
    closeOverlay,
  };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/hooks/useMobileNavigation.ts src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts
git commit -m "feat(mobile): add prefix-aware URL navigation"
```

---

## Task 6: Toast primitive

**Files:**
- Create: `src/features/stow/ui/mobile/shell/Toast.tsx`

- [ ] **Step 1: Write the component** (no unit test — UI; covered by manual + later Playwright)

```tsx
// src/features/stow/ui/mobile/shell/Toast.tsx
import { useEffect } from "react";
import { Check } from "@/features/stow/ui/mobile/theme/icons";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDone, 2000);
    return () => window.clearTimeout(timer);
  }, [message, onDone]);

  if (!message) return null;
  return (
    <div
      role="status"
      style={{
        position: "absolute", bottom: 110, left: "50%", transform: "translateX(-50%)",
        zIndex: 90, display: "flex", alignItems: "center", gap: 8,
        background: "#1A1A2E", color: "#fff", padding: "10px 16px", borderRadius: 99,
        fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)", animation: "stowToast .2s ease-out",
      }}
    >
      <Check size={16} color="var(--stow-accent)" />
      {message}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/stow/ui/mobile/shell/Toast.tsx
git commit -m "feat(mobile): add Toast primitive"
```

---

## Task 7: Bottom navigation + scan FAB

**Files:**
- Create: `src/features/stow/ui/mobile/shell/BottomNav.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/stow/ui/mobile/shell/BottomNav.tsx
import type { LucideIcon } from "lucide-react";
import type { MobileTab } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { Home, Search, Package, Settings, ScanLine } from "@/features/stow/ui/mobile/theme/icons";

interface BottomNavProps {
  tab: MobileTab;
  onTab: (tab: MobileTab) => void;
  onScan: () => void;
  packedCount?: number;
}

const TABS: { key: MobileTab; label: string; Icon: LucideIcon }[] = [
  { key: "spaces", label: "Spaces", Icon: Home },
  { key: "search", label: "Search", Icon: Search },
  { key: "packing", label: "Packing", Icon: Package },
  { key: "settings", label: "Settings", Icon: Settings },
];

export function BottomNav({ tab, onTab, onScan, packedCount = 0 }: BottomNavProps) {
  return (
    <nav
      style={{
        position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 30,
        display: "flex", alignItems: "center", justifyContent: "space-around",
        padding: "10px 14px calc(26px + env(safe-area-inset-bottom))",
        background: "color-mix(in srgb, var(--stow-surface) 95%, transparent)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderTop: "1px solid var(--stow-border-l)",
      }}
    >
      {TABS.slice(0, 2).map((t) => (
        <NavButton key={t.key} label={t.label} Icon={t.Icon} active={tab === t.key} onClick={() => onTab(t.key)} />
      ))}

      <button
        aria-label="Scan"
        onClick={onScan}
        style={{
          width: 56, height: 56, marginTop: -34, borderRadius: 20,
          border: "4px solid var(--stow-surface)", background: "var(--stow-accent)", color: "#fff",
          display: "grid", placeItems: "center", cursor: "pointer",
          boxShadow: "0 8px 20px color-mix(in srgb, var(--stow-accent) 50%, transparent)",
        }}
      >
        <ScanLine size={24} color="#fff" />
      </button>

      {TABS.slice(2).map((t) => (
        <NavButton
          key={t.key} label={t.label} Icon={t.Icon} active={tab === t.key}
          onClick={() => onTab(t.key)} badge={t.key === "packing" ? packedCount : 0}
        />
      ))}
    </nav>
  );
}

function NavButton({
  label, Icon, active, onClick, badge = 0,
}: { label: string; Icon: LucideIcon; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      aria-label={label}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      style={{
        position: "relative", flex: 1, padding: 6, background: "none", border: "none", cursor: "pointer",
        display: "grid", placeItems: "center", gap: 4,
        color: active ? "var(--stow-accent)" : "var(--stow-ink-muted)",
      }}
    >
      <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
        {active ? <span style={{ position: "absolute", inset: -6, borderRadius: 99, background: "var(--stow-accent-soft)" }} /> : null}
        <Icon size={22} strokeWidth={active ? 2.4 : 1.8} style={{ position: "relative" }} />
        {badge > 0 ? (
          <span
            style={{
              position: "absolute", top: -6, right: -8, minWidth: 17, height: 17, padding: "0 4px",
              borderRadius: 99, background: "var(--stow-accent)", color: "#fff", fontSize: 9, fontWeight: 900,
              display: "grid", placeItems: "center", border: "2px solid var(--stow-surface)",
            }}
          >
            {badge}
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/stow/ui/mobile/shell/BottomNav.tsx
git commit -m "feat(mobile): add bottom nav with scan FAB and packed badge"
```

---

## Task 8: App shell (`StowMobileApp`)

**Files:**
- Create: `src/features/stow/ui/mobile/StowMobileApp.tsx`

- [ ] **Step 1: Write the shell component**

```tsx
// src/features/stow/ui/mobile/StowMobileApp.tsx
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useWorkspaceData } from "@/features/stow/hooks/useWorkspaceData";
import { useMobileNavigation } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import type { MobileTab } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { makePalette, applyPalette } from "@/features/stow/ui/mobile/theme/palette";
import { BottomNav } from "@/features/stow/ui/mobile/shell/BottomNav";
import { Toast } from "@/features/stow/ui/mobile/shell/Toast";
import "@/features/stow/ui/mobile/theme/tokens.css";

interface StowMobileAppProps {
  householdId: string;
  user: User;
  onSignOut: () => void;
  online: boolean;
}

export function StowMobileApp({ householdId, user, onSignOut, online }: StowMobileAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useMobileNavigation(householdId);
  const data = useWorkspaceData(householdId, user);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (rootRef.current) applyPalette(rootRef.current, makePalette());
  }, []);

  const packedCount = data.packingLists.reduce(
    (sum, list) => sum + Math.max(0, list.itemIds.length - list.packedItemIds.length),
    0
  );

  return (
    <div className="stow-mobile" ref={rootRef}>
      <div className="stow-mobile__viewport">
        <div className="stow-mobile__screen">
          <PlaceholderScreen
            tab={nav.tab}
            householdName={data.household?.name ?? "Your household"}
            online={online}
            counts={{ items: data.items.length, spaces: data.spaces.length }}
            onSignOut={onSignOut}
          />
        </div>
        <BottomNav
          tab={nav.tab}
          onTab={(t: MobileTab) => nav.navigateToTab(t)}
          onScan={() => setToast("Capture arrives in P2")}
          packedCount={packedCount}
        />
        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    </div>
  );
}

function PlaceholderScreen({
  tab, householdName, online, counts, onSignOut,
}: {
  tab: MobileTab;
  householdName: string;
  online: boolean;
  counts: { items: number; spaces: number };
  onSignOut: () => void;
}) {
  return (
    <div style={{ padding: "calc(env(safe-area-inset-top) + 24px) 24px 24px" }}>
      <p style={{ fontFamily: "var(--stow-display)", fontSize: 30, fontWeight: 900, margin: 0 }}>
        Stow<span style={{ color: "var(--stow-accent)" }}>.</span>
      </p>
      <p style={{ color: "var(--stow-ink-muted)", marginTop: 4, fontSize: 14 }}>
        {householdName} · {counts.items} items · {counts.spaces} spaces{online ? "" : " · offline"}
      </p>
      <div
        style={{
          marginTop: 32, padding: 20, borderRadius: "var(--stow-radius-card)",
          background: "var(--stow-surface)", border: "1px solid var(--stow-border-l)",
          boxShadow: "var(--stow-shadow)",
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, textTransform: "capitalize" }}>{tab}</p>
        <p style={{ margin: "6px 0 0", color: "var(--stow-ink-muted)", fontSize: 14 }}>
          This screen is implemented in P1.
        </p>
      </div>
      {tab === "settings" ? (
        <button
          onClick={onSignOut}
          style={{ marginTop: 16, background: "none", border: "none", color: "var(--stow-danger)", fontWeight: 600, cursor: "pointer" }}
        >
          Sign out
        </button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). If `useWorkspaceData`'s returned `household` is possibly undefined, the `?.name` already guards it.

- [ ] **Step 3: Commit**

```bash
git add src/features/stow/ui/mobile/StowMobileApp.tsx
git commit -m "feat(mobile): add app shell with themed frame, nav, and data wiring"
```

---

## Task 9: Route page + route registration

**Files:**
- Create: `src/routes/StowMobileRoutePage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create the route page** (cloned from `StowNextRoutePage.tsx`, Stow naming)

```tsx
// src/routes/StowMobileRoutePage.tsx
import { lazy, Suspense, useEffect, useState } from "react";
import { AuthGate } from "@/features/auth/AuthGate";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { useHouseholdBootstrap } from "@/features/household/useHouseholdBootstrap";
import { useOnlineStatus } from "@/lib/network/useOnlineStatus";
import { usePwaInstall } from "@/lib/pwa/usePwaInstall";
import { signOutUser } from "@/lib/firebase/auth";
import { toUserErrorMessage } from "@/lib/firebase/errors";

const LazyStowMobileApp = lazy(async () => {
  const mod = await import("@/features/stow/ui/mobile/StowMobileApp");
  return { default: mod.StowMobileApp };
});

function MobileRouteLoading({ message }: { message: string }) {
  return (
    <div className="center-shell">
      <div className="panel auth-panel">
        <h1>Stow</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

function MobileWorkspaceRoute() {
  const { user } = useAuthContext();
  const bootstrap = useHouseholdBootstrap(user);
  const online = useOnlineStatus();
  const { canInstall, showIosInstallHint, promptInstall, needRefresh, updateServiceWorker } = usePwaInstall();
  const [showLongStartupHelp, setShowLongStartupHelp] = useState(false);

  useEffect(() => {
    if (!bootstrap.loading) {
      setShowLongStartupHelp(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLongStartupHelp(true), 6000);
    return () => window.clearTimeout(timer);
  }, [bootstrap.loading]);

  if (!user) return null;

  if (bootstrap.loading) {
    return <MobileRouteLoading message={showLongStartupHelp ? "Still starting your household..." : "Loading your household..."} />;
  }

  if (bootstrap.error || !bootstrap.householdId) {
    return (
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Stow</h1>
          <div className="banner error">{toUserErrorMessage(bootstrap.error, "No household available.")}</div>
          <div className="stack">
            <button className="btn" onClick={() => window.location.reload()}>Retry Startup</button>
            <button className="btn" onClick={() => void signOutUser()}>Sign Out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="global-banners" aria-live="polite">
        {!online ? <div className="banner warning passive">Offline mode: edits will sync when reconnected.</div> : null}
        {canInstall ? <button className="banner action" onClick={() => void promptInstall()}>Install Stow</button> : null}
        {showIosInstallHint ? <div className="banner passive">Install from Safari Share, then Add to Home Screen.</div> : null}
        {needRefresh ? <button className="banner action" onClick={() => void updateServiceWorker(true)}>Update available. Tap to refresh.</button> : null}
      </div>
      <Suspense fallback={<MobileRouteLoading message="Loading Stow..." />}>
        <LazyStowMobileApp
          householdId={bootstrap.householdId}
          user={user}
          onSignOut={() => void signOutUser()}
          online={online}
        />
      </Suspense>
    </>
  );
}

export default function StowMobileRoutePage() {
  return (
    <AuthGate unauthTitle="Stow" unauthSubtitle="Sign in to open your household inventory.">
      <MobileWorkspaceRoute />
    </AuthGate>
  );
}
```

- [ ] **Step 2: Register the lazy import in `src/App.tsx`**

Find (line 7):
```tsx
const StowNextRoutePage = lazy(() => import("@/routes/StowNextRoutePage"));
```
Add directly below it:
```tsx
const StowMobileRoutePage = lazy(() => import("@/routes/StowMobileRoutePage"));
```

- [ ] **Step 3: Add the `/app/*` route in `src/App.tsx`**

Find the `/next/*` route block and add the new block directly after it (before the `<Route path="/" ...>` line):
```tsx
      <Route
        path="/app/*"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/routes/StowMobileRoutePage.tsx
git commit -m "feat(mobile): mount new app at /app dev route"
```

---

## Task 10: Full verification + manual smoke

- [ ] **Step 1: Run the unit suite**

Run: `npm test`
Expected: PASS, including the new `palette.test.ts`, `icons.test.ts`, `useMobileNavigation.test.ts`.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both succeed (TS build + Vite production build with no errors).

- [ ] **Step 3: Manual smoke in dev**

Run: `npm run dev` (with `VITE_USE_FIREBASE_EMULATORS=true` if testing against emulators), then open `http://127.0.0.1:5173/app`.
Expected:
- Authenticated, you see the warm dark backdrop with a centered light "viewport" column (phone width; framed card on a wide window).
- The "Stow." wordmark renders in Clash Display with an orange period; household name + counts show real data.
- The floating bottom nav shows Spaces · Search · ⊕ scan FAB · Packing · Settings; tapping tabs changes the URL to `/app/search`, `/app/packing`, `/app/settings` and the placeholder header updates; browser Back works.
- Tapping the scan FAB shows the "Capture arrives in P2" toast for ~2s.
- The Packing tab shows an orange count badge when unpacked items exist.
- Legacy `/spaces` and desktop `/next` still load unchanged.

- [ ] **Step 4: Final commit (if any manual fixups were needed)**

```bash
git add -A
git commit -m "chore(mobile): P0 foundation verified"
```

---

## Self-review (P0 plan vs spec/roadmap)
- Spec §4.1 module skeleton → theme/ + shell/ + hooks/ + StowMobileApp created (subset; remaining files in P1). ✓
- Spec §4.2 dev `/app` route, legacy untouched → Task 9. ✓
- Spec §4.3 responsive centered column → tokens.css `@media (min-width:700px)`. ✓
- Spec §5.1 color tokens, §5.2 radii, §5.5 keyframes → Task 1–2. ✓
- Spec §5.3 fonts → Task 3. ✓
- Spec §5.6 icon registry + categories → Task 4. ✓
- Decision "URL-driven nav" → Task 5 (prefix-aware, tested). ✓
- Roadmap P0 acceptance (load `/app`, nav via URL, data loads, build green) → Task 10. ✓
- Type consistency: `MobileTab` defined in Task 5 and consumed in Tasks 7–8; `Palette`/`makePalette`/`applyPalette` defined in Task 1 and consumed in Task 8; `iconForKey`/glyph re-exports from Task 4 consumed in Tasks 6–7. ✓
