# Stow Mobile Redesign — P5 Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is the final phase: it makes the new mobile app canonical and deletes the legacy + desktop-next apps.

**Goal:** Make `src/features/stow/ui/mobile/StowMobileApp` the **canonical** Stow UI — finish the deferred parity items (per-space QR + scan-to-navigate, persisted recent searches, delete-with-reassignment confirmation), migrate data (`Space.position`/`Area.position`, `Item.status`), repoint the canonical routes to the mobile app with `basePath=""`, delete the legacy (`StowApp.tsx`) and desktop-next (`StowNextApp.tsx`) apps and their now-orphaned styles, collapse to one design-token system, and retarget the Playwright smoke specs.

**Architecture:** The mobile module (`src/features/stow/ui/mobile/`, P0–P4) already drives the temporary `/app/*` route via `StowMobileRoutePage` → `StowMobileApp` → `useMobileNavigation(householdId, basePath="/app")`. Cutover swaps `basePath` to `""` so the **same pure `parseMobileRoute`/`buildMobilePath`** parser drives the canonical paths (`/`, `/spaces*`, `/items/:id`, `/search`, `/packing`, `/settings`), then removes the `/app`, `/spaces`-legacy and `/next` route wiring and the two old apps. QR + recent-searches are ported from legacy `StowApp.tsx` into the mobile module. Two idempotent, batched, dry-run-capable backfill scripts under `scripts/` materialize the fields the contract's normalization currently fills in at read time.

**Tech Stack:** React 19 + TypeScript, react-router-dom v7, lucide-react, Vite, Vitest (node env, pure-function tests — repo has no jsdom/RTL), Playwright (`tests/smoke/`), `firebase-admin` + `tsx` for backfill scripts, the `qrcode` package for QR generation.

**Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md` (esp. §4.2 cutover, §7.8 parity) · **Roadmap:** `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md` (P5) · **Contract:** `docs/superpowers/plans/2026-06-06-stow-redesign-shared-contract.md` (§3 basePath cutover, §4.1 backfills + normalization, §12 P5 index)

**Conventions (contract §0):**
- TDD bite-sized steps where there is testable logic: write failing test → run (expect fail) → minimal impl → run (expect pass) → commit. One action per step (2–5 min).
- Run a single test file with `npx vitest run <path>`; the full unit suite with `npm test` (it excludes `tests/firestore.rules.test.ts` and `tests/smoke/**`).
- There is **no `verify` script**; "verify" = `npm run typecheck && npm test && npm run build`. Rules: `npm run test:rules`. E2E: `npm run test:smoke`. Functions: `npm run functions:test`.
- Tests are pure-function / node-env only (Vitest). Test the QR helper, the recent-searches helper, and the two backfill scripts' pure planning functions. UI is validated by manual dev load + Playwright.
- Backfill scripts are **idempotent** (re-running is a no-op), **batched** (Firestore `writeBatch`, ≤450 writes/commit), and support a `--dry-run` flag that logs the plan without writing. They use `firebase-admin` + `tsx`, mirroring `scripts/seed-demo.ts`.
- End every commit message with the repo trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Precondition:** P1–P4 are complete and at parity behind `/app`. Do not start P5 until `/app` is feature-complete; this is the first phase permitted to touch legacy `StowApp.tsx`, desktop `next/StowNextApp.tsx`, and the canonical routes.

**Ordering rationale:** Parity ports (Tasks 1–3) land *while both apps still run* so they can be smoke-tested on `/app` before the old apps disappear. Migrations (Task 4) ship next so prod data has real `position`/`status` before — and independent of — the route swap. Only then do we repoint routes (Task 5), delete the old apps + styles (Tasks 6–7), retarget tests/docs (Task 8), and run final verification (Task 9).

---

## Task 1: Parity — per-space QR generation + QR-scan-to-navigate

Port the two QR behaviors from legacy `src/features/stow/ui/StowApp.tsx` into the mobile module: (a) generate a scannable QR image for a space's canonical deep link, surfaced behind the RoomScreen QR button (the button already exists from P1, spec §6.4 / roadmap P1 task 6 "real Camera + QR buttons"); (b) a "Scan QR" entry that parses a pasted/scanned Stow link and navigates to it. Reuse the `qrcode` package (already a dependency: `qrcode@^1.5.4`, `@types/qrcode@^1.5.5`).

Legacy reference (for behavior parity):
- QR generation — `StowApp.tsx` line 552: `const url = \`${window.location.origin}/spaces/${showQrForSpaceId}\`` then `module.toDataURL(url, { margin: 1, width: 220, color: { dark: "#1A1A2E", light: "#FFFFFF" } })`, lazy-loaded via `loadQrCodeModule()` (line 122).
- Scan-to-navigate — `StowApp.tsx` `openQrScanTarget()` (line 1207): trims input, builds a `URL` (absolute or relative to `window.location.origin`), rejects cross-origin (`"Use a Stow QR link for this app"`), otherwise `navigate(\`${url.pathname}${url.search}\`)`; on parse failure falls back to `navigate(\`/spaces/${encodeURIComponent(raw)}\`)`.

**Key cutover difference:** the QR link must encode the **canonical** path. After Task 5 the canonical space path *is* `/spaces/:id` (basePath `""`), which already matches the legacy QR URL — so generating `${origin}/spaces/${spaceId}` is correct post-cutover and the legacy color/size are reused verbatim. The helper takes the full URL so it has no basePath coupling.

**Files:**
- Create: `src/features/stow/ui/mobile/capture/qr.ts`
- Test: `src/features/stow/ui/mobile/capture/qr.test.ts`
- Create: `src/features/stow/ui/mobile/spaces/SpaceQrSheet.tsx`
- Create: `src/features/stow/ui/mobile/capture/ScanQrSheet.tsx`
- Modify: `src/features/stow/ui/mobile/screens/RoomScreen.tsx` (wire the QR button → open `SpaceQrSheet`)
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx` (overlay routing for the two sheets)
- Modify: `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts` (extend `OverlayKind` union)

- [x] **Step 1: Write the failing test for the pure QR helpers**

```ts
// src/features/stow/ui/mobile/capture/qr.test.ts
import { describe, expect, it } from "vitest";
import { spaceQrUrl, parseScannedStowTarget } from "@/features/stow/ui/mobile/capture/qr";

describe("spaceQrUrl", () => {
  it("builds the canonical space deep link from an origin + space id", () => {
    expect(spaceQrUrl("https://stow.app", "s1")).toBe("https://stow.app/spaces/s1");
    // trailing slash on origin is normalized
    expect(spaceQrUrl("https://stow.app/", "s1")).toBe("https://stow.app/spaces/s1");
  });
});

describe("parseScannedStowTarget", () => {
  const origin = "https://stow.app";

  it("returns the path+search for a same-origin absolute Stow link", () => {
    expect(parseScannedStowTarget("https://stow.app/spaces/s1", origin)).toEqual({
      ok: true,
      path: "/spaces/s1",
    });
    expect(parseScannedStowTarget("https://stow.app/items/i1?from=search", origin)).toEqual({
      ok: true,
      path: "/items/i1?from=search",
    });
  });

  it("resolves a relative path against the origin", () => {
    expect(parseScannedStowTarget("/spaces/s1", origin)).toEqual({ ok: true, path: "/spaces/s1" });
  });

  it("rejects a cross-origin link", () => {
    expect(parseScannedStowTarget("https://evil.example/spaces/s1", origin)).toEqual({
      ok: false,
      reason: "cross-origin",
    });
  });

  it("rejects empty input", () => {
    expect(parseScannedStowTarget("   ", origin)).toEqual({ ok: false, reason: "empty" });
  });

  it("falls back to a space deep link for a bare id that is not a URL", () => {
    expect(parseScannedStowTarget("s1", origin)).toEqual({ ok: true, path: "/spaces/s1" });
    // ids are encoded
    expect(parseScannedStowTarget("a b", origin)).toEqual({ ok: true, path: "/spaces/a%20b" });
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/capture/qr.test.ts`
Expected: FAIL — "Failed to resolve import" / `spaceQrUrl is not a function`.

- [x] **Step 3: Write the implementation**

```ts
// src/features/stow/ui/mobile/capture/qr.ts

/** Lazy-load the qrcode package (mirrors legacy StowApp.loadQrCodeModule). */
type QrCodeModule = typeof import("qrcode");
let qrCodeModulePromise: Promise<QrCodeModule> | null = null;
function loadQrCodeModule(): Promise<QrCodeModule> {
  if (!qrCodeModulePromise) qrCodeModulePromise = import("qrcode");
  return qrCodeModulePromise;
}

/** Canonical scannable deep link for a space (post-cutover `basePath=""`). */
export function spaceQrUrl(origin: string, spaceId: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/spaces/${spaceId}`;
}

export type ScannedTarget =
  | { ok: true; path: string }
  | { ok: false; reason: "empty" | "cross-origin" };

/**
 * Parse a pasted/scanned value into a same-origin navigation path.
 * Mirrors legacy StowApp.openQrScanTarget: absolute or relative URL resolved
 * against `origin`; cross-origin rejected; non-URL input treated as a bare
 * space id and turned into `/spaces/<encoded>`.
 */
export function parseScannedStowTarget(raw: string, origin: string): ScannedTarget {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "empty" };
  try {
    const url = value.startsWith("http") ? new URL(value) : new URL(value, origin);
    if (url.origin !== new URL(origin).origin) return { ok: false, reason: "cross-origin" };
    return { ok: true, path: `${url.pathname}${url.search}` };
  } catch {
    return { ok: true, path: `/spaces/${encodeURIComponent(value)}` };
  }
}

/** Render a space deep link to a PNG data URL (legacy color/size parity). */
export function generateSpaceQrDataUrl(url: string): Promise<string> {
  return loadQrCodeModule().then((module) =>
    module.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: "#1A1A2E", light: "#FFFFFF" },
    })
  );
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/capture/qr.test.ts`
Expected: PASS (3 `describe`s, 7 assertions across them).

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/capture/qr.ts src/features/stow/ui/mobile/capture/qr.test.ts
git commit -m "feat(mobile): add QR url + scan-target helpers ported from legacy"
```

- [ ] **Step 6: Extend the overlay union for the QR sheets**

In `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts`, find the `OverlayKind` union (contract §3 baseline plus P2/P3/P4 additions) and add the two QR overlay kinds:

Before:
```ts
export type OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace" | "captureFirst";
```
After:
```ts
export type OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace" | "captureFirst" | "spaceQr" | "scanQr";
```
*(If P2–P4 added other members, preserve them; append `"spaceQr"` and `"scanQr"`. The `OverlayState.payload` already carries `Record<string, unknown>`, so `spaceQr` passes `{ spaceId }`.)*

- [ ] **Step 7: Create `SpaceQrSheet` (QR generation UI)**

```tsx
// src/features/stow/ui/mobile/spaces/SpaceQrSheet.tsx
import { useEffect, useState } from "react";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { spaceQrUrl, generateSpaceQrDataUrl } from "@/features/stow/ui/mobile/capture/qr";

interface SpaceQrSheetProps {
  open: boolean;
  spaceId: string | null;
  spaceName: string;
  onClose: () => void;
  onCopied: (message: string) => void;
}

export function SpaceQrSheet({ open, spaceId, spaceName, onClose, onCopied }: SpaceQrSheetProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const url = spaceId ? spaceQrUrl(window.location.origin, spaceId) : "";

  useEffect(() => {
    if (!open || !spaceId) {
      setDataUrl(null);
      return;
    }
    let cancelled = false;
    void generateSpaceQrDataUrl(url)
      .then((value) => { if (!cancelled) setDataUrl(value); })
      .catch(() => { if (!cancelled) setDataUrl(null); });
    return () => { cancelled = true; };
  }, [open, spaceId, url]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      onCopied("Space link copied");
    } catch {
      onCopied("Couldn't copy link");
    }
  }

  async function shareLink() {
    try {
      if (!navigator.share) { await copyLink(); return; }
      await navigator.share({ title: "Stow space link", url });
    } catch {
      // user cancel / no-op
    }
  }

  function downloadPng() {
    if (!dataUrl || !spaceId) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `stow-space-${spaceId}.png`;
    anchor.click();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`${spaceName} · QR label`}>
      <div style={{ display: "grid", gap: 16, placeItems: "center", paddingBottom: 8 }}>
        <div
          style={{
            width: 240, height: 240, display: "grid", placeItems: "center",
            background: "var(--stow-surface)", borderRadius: "var(--stow-radius-card)",
            border: "1px solid var(--stow-border-l)",
          }}
        >
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code for ${spaceName}`} width={220} height={220} />
          ) : (
            <span style={{ color: "var(--stow-ink-muted)", fontSize: 14 }}>Generating QR…</span>
          )}
        </div>
        <p style={{ margin: 0, color: "var(--stow-ink-muted)", fontSize: 13, wordBreak: "break-all", textAlign: "center" }}>
          {url}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%" }}>
          <Button variant="neutral" onClick={() => void copyLink()}>Copy</Button>
          <Button variant="neutral" onClick={() => void shareLink()}>Share</Button>
          <Button variant="neutral" disabled={!dataUrl} onClick={downloadPng}>PNG</Button>
        </div>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 8: Create `ScanQrSheet` (paste/scan-to-navigate UI)**

```tsx
// src/features/stow/ui/mobile/capture/ScanQrSheet.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { parseScannedStowTarget } from "@/features/stow/ui/mobile/capture/qr";

interface ScanQrSheetProps {
  open: boolean;
  onClose: () => void;
  onError: (message: string) => void;
}

export function ScanQrSheet({ open, onClose, onError }: ScanQrSheetProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState("");

  function openTarget() {
    const result = parseScannedStowTarget(value, window.location.origin);
    if (!result.ok) {
      onError(result.reason === "empty" ? "Paste or scan a Stow QR link" : "Use a Stow QR link for this app");
      return;
    }
    setValue("");
    onClose();
    navigate(result.path);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Scan QR label">
      <div style={{ display: "grid", gap: 14 }}>
        <p style={{ margin: 0, color: "var(--stow-ink-muted)", fontSize: 14 }}>
          Paste a Stow QR link or space id to jump straight to it.
        </p>
        <Field
          label="QR link or space id"
          value={value}
          onChange={setValue}
          placeholder="/spaces/…"
        />
        <Button variant="primary" onClick={openTarget}>Open target</Button>
      </div>
    </Sheet>
  );
}
```

> Note: `Sheet`, `Field`, `Button` are the P1 primitives (contract §7). `Field`'s `onChange` is `(value: string) => void` per contract §7 (`components/Field.tsx`).

- [ ] **Step 9: Wire the RoomScreen QR button → `spaceQr` overlay**

In `src/features/stow/ui/mobile/screens/RoomScreen.tsx`, the header QR button (placeholder/no-op from P1) calls `openOverlay`. Find the QR button (it sits beside the Camera button in the room header) and set its handler:

Before (P1 placeholder — exact text may differ; it is the QR `<button>` in the room header):
```tsx
        <button aria-label="Space QR" onClick={() => { /* QR wired in P5 */ }}>
          <QrCode size={20} />
        </button>
```
After:
```tsx
        <button aria-label="Space QR" onClick={() => openOverlay("spaceQr", { spaceId })}>
          <QrCode size={20} />
        </button>
```
Ensure `QrCode` is imported from the icon registry (`@/features/stow/ui/mobile/theme/icons` — add `QrCode` to its re-export list if not already present) and `openOverlay`/`spaceId` are in scope (they come from the `useMobileNavigation` value passed into `RoomScreen`).

- [ ] **Step 10: Render the two sheets in `StowMobileApp` overlay router**

In `src/features/stow/ui/mobile/StowMobileApp.tsx`, in the overlay-rendering block (the `switch`/conditional on `nav.overlay.kind`), add the two cases. Resolve the space name from `data.spaces`:

```tsx
        {nav.overlay.kind === "spaceQr" ? (
          <SpaceQrSheet
            open
            spaceId={(nav.overlay.payload?.spaceId as string) ?? null}
            spaceName={
              data.spaces.find((s) => s.id === nav.overlay.payload?.spaceId)?.name ?? "Space"
            }
            onClose={nav.closeOverlay}
            onCopied={(message) => setToast(message)}
          />
        ) : null}
        {nav.overlay.kind === "scanQr" ? (
          <ScanQrSheet open onClose={nav.closeOverlay} onError={(message) => setToast(message)} />
        ) : null}
```
Add the imports at the top of `StowMobileApp.tsx`:
```tsx
import { SpaceQrSheet } from "@/features/stow/ui/mobile/spaces/SpaceQrSheet";
import { ScanQrSheet } from "@/features/stow/ui/mobile/capture/ScanQrSheet";
```

- [ ] **Step 11: Add a "Scan QR" affordance to the ScanOverlay mode strip**

The center Scan FAB opens `ScanOverlay` (contract §9). Add a small "Scan QR" text button below the One item / Whole shelf mode strip that closes the camera overlay and opens `scanQr`. In `src/features/stow/ui/mobile/capture/ScanOverlay.tsx`, the overlay receives navigation via props; add an `onScanQr` prop and a button:

```tsx
        <button
          onClick={onScanQr}
          style={{ marginTop: 12, background: "none", border: "none", color: "#fff", opacity: 0.85, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          Scan a Stow QR label
        </button>
```
Then in `StowMobileApp.tsx` where `ScanOverlay` is rendered, pass `onScanQr={() => { nav.closeOverlay(); nav.openOverlay("scanQr"); }}`.

- [ ] **Step 12: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 13: Manual smoke (still on `/app`, both apps alive)**

Run: `npm run dev`, open `http://127.0.0.1:5173/app`, open a room, tap the QR button → a 220px QR renders for `${origin}/spaces/<id>`, Copy/Share/PNG work. Open the Scan FAB → "Scan a Stow QR label" → paste `/spaces/<an existing id>` → it navigates to that room. Paste an off-origin URL → "Use a Stow QR link for this app" toast.

- [ ] **Step 14: Commit**

```bash
git add src/features/stow/ui/mobile/spaces/SpaceQrSheet.tsx src/features/stow/ui/mobile/capture/ScanQrSheet.tsx src/features/stow/ui/mobile/capture/ScanOverlay.tsx src/features/stow/ui/mobile/screens/RoomScreen.tsx src/features/stow/ui/mobile/StowMobileApp.tsx src/features/stow/ui/mobile/hooks/useMobileNavigation.ts src/features/stow/ui/mobile/theme/icons.tsx
git commit -m "feat(mobile): wire per-space QR sheet + scan-to-navigate parity"
```

---

## Task 2: Parity — persisted recent searches (localStorage)

Port the legacy recent-searches behavior into a pure, tested helper and wire it into `SearchScreen`. Legacy reference: `StowApp.tsx` reads at line 509 (`stow:${householdId}:recent-searches`, `JSON.parse`, `.filter(Boolean).slice(0, 6)`) and writes at line 674 (debounced 450ms when `searchQuery.trim().length >= 2`, dedupe case-insensitively, prepend, `.slice(0, 8)`). We keep the same storage key and semantics so a user's history carries across the cutover.

**Files:**
- Create: `src/features/stow/ui/mobile/screens/recentSearches.ts`
- Test: `src/features/stow/ui/mobile/screens/recentSearches.test.ts`
- Modify: `src/features/stow/ui/mobile/screens/SearchScreen.tsx`

- [ ] **Step 1: Write the failing test (pure helpers, in-memory storage stub)**

```ts
// src/features/stow/ui/mobile/screens/recentSearches.test.ts
import { beforeEach, describe, expect, it } from "vitest";
import {
  recentSearchKey,
  readRecentSearches,
  pushRecentSearch,
  MAX_RECENT,
} from "@/features/stow/ui/mobile/screens/recentSearches";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("recentSearches", () => {
  let store: Storage;
  beforeEach(() => { store = makeStorage(); });

  it("namespaces the key by household", () => {
    expect(recentSearchKey("h1")).toBe("stow:h1:recent-searches");
  });

  it("returns [] when nothing is stored or JSON is corrupt", () => {
    expect(readRecentSearches("h1", store)).toEqual([]);
    store.setItem(recentSearchKey("h1"), "{not json");
    expect(readRecentSearches("h1", store)).toEqual([]);
  });

  it("reads stored terms, dropping falsy entries, capped at MAX_RECENT", () => {
    store.setItem(recentSearchKey("h1"), JSON.stringify(["a", "", "b", "c", "d", "e", "f", "g", "h"]));
    expect(readRecentSearches("h1", store)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(readRecentSearches("h1", store).length).toBeLessThanOrEqual(MAX_RECENT);
  });

  it("prepends a new term, dedupes case-insensitively, caps at 8 on write", () => {
    pushRecentSearch("h1", "Drill", store);
    pushRecentSearch("h1", "Tent", store);
    pushRecentSearch("h1", "drill", store); // dedupe -> moves Drill to front (keeps newest casing)
    const raw = JSON.parse(store.getItem(recentSearchKey("h1")) as string) as string[];
    expect(raw[0]).toBe("drill");
    expect(raw.filter((t) => t.toLowerCase() === "drill")).toHaveLength(1);
    expect(raw).toEqual(["drill", "Tent"]);
  });

  it("ignores blank or 1-char queries on write", () => {
    pushRecentSearch("h1", " ", store);
    pushRecentSearch("h1", "x", store);
    expect(store.getItem(recentSearchKey("h1"))).toBeNull();
  });

  it("keeps at most 8 stored entries", () => {
    for (const t of ["a", "b", "c", "d", "e", "f", "g", "h", "i"]) pushRecentSearch("h1", t, store);
    const raw = JSON.parse(store.getItem(recentSearchKey("h1")) as string) as string[];
    expect(raw).toHaveLength(8);
    expect(raw[0]).toBe("i");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/screens/recentSearches.test.ts`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/stow/ui/mobile/screens/recentSearches.ts

/** How many recent searches we surface in the UI (legacy read cap). */
export const MAX_RECENT = 6;
/** How many we retain in storage (legacy write cap). */
const STORE_CAP = 8;
/** Minimum query length worth remembering (legacy threshold). */
const MIN_LENGTH = 2;

export function recentSearchKey(householdId: string): string {
  return `stow:${householdId}:recent-searches`;
}

function safeStorage(provided?: Storage): Storage | null {
  if (provided) return provided;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Read up to MAX_RECENT stored terms (dropping falsy), tolerant of corruption. */
export function readRecentSearches(householdId: string, storage?: Storage): string[] {
  const store = safeStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(recentSearchKey(householdId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => Boolean(entry) && typeof entry === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

/**
 * Persist a search term: prepend, dedupe case-insensitively, cap at STORE_CAP.
 * No-op for blank / <2-char queries or when storage is unavailable.
 */
export function pushRecentSearch(householdId: string, query: string, storage?: Storage): void {
  const q = query.trim();
  if (q.length < MIN_LENGTH) return;
  const store = safeStorage(storage);
  if (!store) return;
  try {
    const key = recentSearchKey(householdId);
    const raw = store.getItem(key);
    const current = raw ? (JSON.parse(raw) as unknown) : [];
    const list = Array.isArray(current) ? (current as string[]) : [];
    const next = [q, ...list.filter((entry) => entry.toLowerCase() !== q.toLowerCase())].slice(0, STORE_CAP);
    store.setItem(key, JSON.stringify(next));
  } catch {
    // ignore storage failures
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/screens/recentSearches.test.ts`
Expected: PASS (6 assertions/blocks).

- [ ] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/screens/recentSearches.ts src/features/stow/ui/mobile/screens/recentSearches.test.ts
git commit -m "feat(mobile): add persisted recent-searches helper ported from legacy"
```

- [ ] **Step 6: Wire recent searches into `SearchScreen`**

In `src/features/stow/ui/mobile/screens/SearchScreen.tsx`:

(a) Add imports:
```tsx
import { useEffect, useMemo, useState } from "react";
import { readRecentSearches, pushRecentSearch } from "@/features/stow/ui/mobile/screens/recentSearches";
```

(b) Compute the recent list (recomputed whenever the query settles — same dependency shape as legacy line 509):
```tsx
  const recent = useMemo(() => readRecentSearches(householdId), [householdId, query]);
```

(c) Persist on a 450ms debounce while the Search tab query is ≥2 chars (legacy line 674):
```tsx
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => pushRecentSearch(householdId, q), 450);
    return () => window.clearTimeout(timer);
  }, [householdId, query]);
```

(d) Render the recent chips in the **idle** state next to / above "Popular Tags" (spec §6.6). Each chip sets the query:
```tsx
        {query.trim() === "" && recent.length > 0 ? (
          <section style={{ marginTop: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--stow-ink-muted)", margin: "0 0 8px" }}>Recent</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {recent.map((term) => (
                <Chip key={term} label={term} onClick={() => setQuery(term)} />
              ))}
            </div>
          </section>
        ) : null}
```
Use the existing `Chip` primitive (contract §7) and the screen's existing `query`/`setQuery` state and `householdId` (already passed into `SearchScreen`). If `SearchScreen` does not yet own `query` state locally (e.g. it lifts it), adapt the handlers to the existing state setter — do not introduce a second source of truth.

- [ ] **Step 7: Typecheck + manual smoke**

Run: `npm run typecheck`. Then `npm run dev`, open `/app/search`, type a few searches (≥2 chars), return to the idle Search screen → the "Recent" chips show your terms newest-first; tapping one refills the query. Confirm history written by legacy `/spaces` (same key) also appears, proving carry-over.

- [ ] **Step 8: Commit**

```bash
git add src/features/stow/ui/mobile/screens/SearchScreen.tsx
git commit -m "feat(mobile): surface persisted recent searches in SearchScreen"
```

---

## Task 3: Parity — confirm delete-with-reassignment is wired everywhere

The repository already supports reassignment on delete: `inventoryRepository.deleteSpace`/`deleteArea` accept `reassignTo: { spaceId; areaId; areaNameSnapshot }` and **throw** when items exist and no destination is given (`repository.ts` line 303 `"Area contains items. Choose a destination first."`, line 336 `"Space contains items. Choose a destination space/area first."`). Contract §8 requires the EditSpace/area-delete UI to collect a destination picker and pass `reassignTo`; roadmap puts the *wiring* in P1. This task is a **P5 audit + gap-fill**: confirm both delete paths surface a confirm + destination picker, and add any missing confirm dialog so no delete can silently throw.

**Files (read to audit; modify only where a gap is found):**
- `src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx` (Delete Space + Areas list per-area delete)
- `src/features/stow/ui/mobile/spaces/SpaceActionSheet.tsx` (Delete action entry)
- `src/features/stow/ui/mobile/shell/Confirm.tsx` (the confirm dialog primitive, contract §7)

- [ ] **Step 1: Audit the space-delete path**

Read `EditSpaceSheet.tsx`. Confirm "Delete Space":
  1. Counts items in the space (from `useWorkspaceData` — items where `item.spaceId === space.id`).
  2. If count > 0, shows a **destination picker** (another space + area) and only enables delete once a destination is chosen; calls `deleteSpace({ householdId, spaceId, reassignTo: { spaceId, areaId, areaNameSnapshot } })`.
  3. If count === 0, shows a plain `Confirm` (danger) and calls `deleteSpace({ householdId, spaceId })`.
  4. On the repo throw (defensive — e.g. a race added items), surfaces the error message as a toast rather than failing silently.

Document the finding inline in the step checkbox (PASS, or the exact missing piece). If a `Confirm` is missing for the **empty-space** case, add it:

```tsx
        <Confirm
          open={confirmDeleteOpen}
          title="Delete space?"
          body={`"${space.name}" will be permanently removed.`}
          confirmLabel="Delete"
          danger
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => void handleDeleteSpace()}
        />
```

- [ ] **Step 2: Audit the area-delete path**

Read the Areas section of `EditSpaceSheet.tsx` (each area row's delete control). Confirm the same three-way logic against `deleteArea({ householdId, spaceId, areaId, reassignTo? })`: items-in-area → destination picker (an area within the same space, or another space); empty → `Confirm`; repo throw → toast. Add a missing `Confirm` if absent, mirroring Step 1.

- [ ] **Step 3: Verify reassignment destination snapshot correctness**

Confirm the destination picker passes `areaNameSnapshot` equal to the *chosen destination area's current name* (so moved items show the right "Room › Area" subtitle). This matches `repository.deleteSpace`/`deleteArea` writing `areaNameSnapshot: input.reassignTo.areaNameSnapshot` (lines 313/345). If the UI passes the source name or omits it, fix it to read the destination area's `name`.

- [ ] **Step 4: Manual smoke**

Run `npm run dev`. On `/app`: (a) create a space with an area, add 1 item; open Edit Space → Delete Space → it requires a destination → pick another space/area → delete succeeds and the item now lives in the destination (verify via search). (b) Repeat for area delete. (c) Delete an empty space → plain confirm, no picker.

- [ ] **Step 5: Commit (only if a gap was fixed)**

```bash
git add src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx src/features/stow/ui/mobile/spaces/SpaceActionSheet.tsx
git commit -m "fix(mobile): ensure delete-with-reassignment confirm is wired everywhere"
```
If the audit found everything already wired (P1 did its job), record that in the step and skip the commit.

---

## Task 4: Migrations — `backfill-positions.ts` + `backfill-status.ts`

Materialize the fields the contract's read-time normalization currently fills (contract §4.1): `Space.position`/`Area.position` (by current **name order**, per space and per area-within-space) and `Item.status` (`isPacked ? "packed" : "home"`). Both scripts mirror `scripts/seed-demo.ts` (`firebase-admin`, `tsx`, `parseArg`), are **idempotent** (skip docs that already have the target field), **batched** (≤450 writes/commit), and support `--dry-run`.

Data shape (from `src/types/domain.ts` + `paths.ts`): spaces are a subcollection `households/{h}/spaces`; areas are nested `households/{h}/spaces/{spaceId}/areas`; items are a **flat** subcollection `households/{h}/items` with `spaceId`/`areaId`/`isPacked` fields. Position is per-collection-scope: spaces ordered among themselves; areas ordered among siblings within one space.

The pure planning functions are unit-tested; the admin I/O wrapper is exercised via `--dry-run` against the emulator.

**Files:**
- Create: `scripts/backfill-positions.ts`
- Create: `scripts/backfill-status.ts`
- Test: `scripts/backfill.test.ts`
- Modify: `package.json` (two npm scripts)

### 4a — Pure planning helpers + tests

- [ ] **Step 1: Write the failing test for the pure planners**

```ts
// scripts/backfill.test.ts
import { describe, expect, it } from "vitest";
import { planPositions } from "../scripts/backfill-positions";
import { planStatus } from "../scripts/backfill-status";

describe("planPositions", () => {
  it("assigns 0-based positions by case-insensitive name order, skipping docs that already have a position", () => {
    const docs = [
      { id: "b", name: "Garage", position: undefined },
      { id: "a", name: "attic", position: undefined },
      { id: "c", name: "Kitchen", position: 5 }, // already set -> not rewritten
    ];
    expect(planPositions(docs)).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
  });

  it("is idempotent: a fully-positioned set yields no writes", () => {
    const docs = [
      { id: "a", name: "A", position: 0 },
      { id: "b", name: "B", position: 1 },
    ];
    expect(planPositions(docs)).toEqual([]);
  });

  it("orders by name first, so existing positions do not perturb the ranking of unset docs", () => {
    // 'c' already has position 0 but name 'Zed'; unset 'a','b' still rank by name among the full set
    const docs = [
      { id: "c", name: "Zed", position: 0 },
      { id: "b", name: "Beta", position: undefined },
      { id: "a", name: "Alpha", position: undefined },
    ];
    // full name order: Alpha(0), Beta(1), Zed(2); only unset ids are written
    expect(planPositions(docs)).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
    ]);
  });
});

describe("planStatus", () => {
  it("derives status from isPacked only for docs missing status", () => {
    const docs = [
      { id: "i1", isPacked: true, status: undefined },
      { id: "i2", isPacked: false, status: undefined },
      { id: "i3", isPacked: true, status: "lent" }, // already set -> skip
      { id: "i4", isPacked: undefined, status: undefined },
    ];
    expect(planStatus(docs)).toEqual([
      { id: "i1", status: "packed" },
      { id: "i2", status: "home" },
      { id: "i4", status: "home" },
    ]);
  });

  it("is idempotent: all-statused docs yield no writes", () => {
    expect(planStatus([{ id: "i1", isPacked: true, status: "packed" }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/backfill.test.ts`
Expected: FAIL — imports cannot be resolved.

> Note: `scripts/` is compiled/run by `tsx`, but the planner files must be importable by Vitest. Export the pure planners as named exports and guard the admin entrypoint behind a `main()` that only runs when invoked directly (see Step 4/5). The repo's Vitest config picks up `scripts/*.test.ts` (it excludes only `tests/firestore.rules.test.ts` and `tests/smoke/**`).

- [ ] **Step 3: Write `scripts/backfill-positions.ts` (planner + admin runner)**

```ts
// scripts/backfill-positions.ts
import admin from "firebase-admin";

export interface PositionDoc {
  id: string;
  name: string;
  position?: number;
}

/**
 * Pure planner: 0-based positions by case-insensitive name order (ties broken
 * by id for determinism). Only emits writes for docs missing `position`.
 */
export function planPositions(docs: PositionDoc[]): Array<{ id: string; position: number }> {
  const ordered = docs
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id));
  const writes: Array<{ id: string; position: number }> = [];
  ordered.forEach((doc, index) => {
    if (typeof doc.position !== "number") writes.push({ id: doc.id, position: index });
  });
  return writes;
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const BATCH_LIMIT = 450;

async function commitBatched(
  refsWithData: Array<{ ref: FirebaseFirestore.DocumentReference; position: number }>,
  dryRun: boolean
): Promise<number> {
  let written = 0;
  for (let i = 0; i < refsWithData.length; i += BATCH_LIMIT) {
    const slice = refsWithData.slice(i, i + BATCH_LIMIT);
    if (dryRun) {
      written += slice.length;
      continue;
    }
    const batch = admin.firestore().batch();
    for (const { ref, position } of slice) {
      batch.update(ref, { position, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    await batch.commit();
    written += slice.length;
  }
  return written;
}

async function main(): Promise<void> {
  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();
  const dryRun = hasFlag("dry-run");
  const onlyHousehold = parseArg("household");

  const householdRefs = onlyHousehold
    ? [db.doc(`households/${onlyHousehold}`)]
    : (await db.collection("households").get()).docs.map((d) => d.ref);

  let spaceWrites = 0;
  let areaWrites = 0;

  for (const householdRef of householdRefs) {
    const spacesSnap = await householdRef.collection("spaces").get();
    const spaceDocs: PositionDoc[] = spacesSnap.docs.map((d) => ({
      id: d.id,
      name: (d.get("name") as string) ?? "",
      position: d.get("position") as number | undefined,
    }));
    const spacePlan = planPositions(spaceDocs);
    spaceWrites += await commitBatched(
      spacePlan.map((w) => ({ ref: householdRef.collection("spaces").doc(w.id), position: w.position })),
      dryRun
    );

    // Areas are positioned among siblings within each space.
    for (const spaceSnap of spacesSnap.docs) {
      const areasSnap = await spaceSnap.ref.collection("areas").get();
      const areaDocs: PositionDoc[] = areasSnap.docs.map((d) => ({
        id: d.id,
        name: (d.get("name") as string) ?? "",
        position: d.get("position") as number | undefined,
      }));
      const areaPlan = planPositions(areaDocs);
      areaWrites += await commitBatched(
        areaPlan.map((w) => ({ ref: spaceSnap.ref.collection("areas").doc(w.id), position: w.position })),
        dryRun
      );
    }
  }

  console.log(
    JSON.stringify(
      { dryRun, households: householdRefs.length, spaceWrites, areaWrites },
      null,
      2
    )
  );
}

// Only run the admin path when invoked as a script, not when imported by tests.
const invokedDirectly = process.argv[1]?.includes("backfill-positions");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Write `scripts/backfill-status.ts` (planner + admin runner)**

```ts
// scripts/backfill-status.ts
import admin from "firebase-admin";

export interface StatusDoc {
  id: string;
  isPacked?: boolean;
  status?: string;
}

/**
 * Pure planner: derive `status` from `isPacked` (true -> "packed", else "home")
 * for docs that have no `status` yet. Idempotent.
 */
export function planStatus(docs: StatusDoc[]): Array<{ id: string; status: "packed" | "home" }> {
  const writes: Array<{ id: string; status: "packed" | "home" }> = [];
  for (const doc of docs) {
    if (typeof doc.status === "string" && doc.status.length > 0) continue;
    writes.push({ id: doc.id, status: doc.isPacked ? "packed" : "home" });
  }
  return writes;
}

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}
function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const BATCH_LIMIT = 450;

async function main(): Promise<void> {
  if (admin.apps.length === 0) admin.initializeApp();
  const db = admin.firestore();
  const dryRun = hasFlag("dry-run");
  const onlyHousehold = parseArg("household");

  const householdRefs = onlyHousehold
    ? [db.doc(`households/${onlyHousehold}`)]
    : (await db.collection("households").get()).docs.map((d) => d.ref);

  let itemWrites = 0;

  for (const householdRef of householdRefs) {
    const itemsSnap = await householdRef.collection("items").get();
    const docs: StatusDoc[] = itemsSnap.docs.map((d) => ({
      id: d.id,
      isPacked: d.get("isPacked") as boolean | undefined,
      status: d.get("status") as string | undefined,
    }));
    const plan = planStatus(docs);

    for (let i = 0; i < plan.length; i += BATCH_LIMIT) {
      const slice = plan.slice(i, i + BATCH_LIMIT);
      if (dryRun) {
        itemWrites += slice.length;
        continue;
      }
      const batch = db.batch();
      for (const { id, status } of slice) {
        batch.update(householdRef.collection("items").doc(id), {
          status,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      itemWrites += slice.length;
    }
  }

  console.log(JSON.stringify({ dryRun, households: householdRefs.length, itemWrites }, null, 2));
}

const invokedDirectly = process.argv[1]?.includes("backfill-status");
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 5: Run the planner test to verify it passes**

Run: `npx vitest run scripts/backfill.test.ts`
Expected: PASS. (The `invokedDirectly` guard prevents `main()` from running during import, so no admin init happens under Vitest.)

- [ ] **Step 6: Add npm scripts**

In `package.json`, find the `"seed:demo"` script:
```json
    "seed:demo": "tsx scripts/seed-demo.ts"
```
Replace with (add a trailing comma and the two backfill scripts):
```json
    "seed:demo": "tsx scripts/seed-demo.ts",
    "backfill:positions": "tsx scripts/backfill-positions.ts",
    "backfill:status": "tsx scripts/backfill-status.ts"
```

- [ ] **Step 7: Dry-run against the emulator, then write against the emulator**

Document + execute (text for the running engineer):

```bash
# 1. Seed/identify a household in the running emulator.
firebase emulators:start --only firestore   # in one terminal
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-stow npm run seed:demo -- --uid demo-owner --name "Demo Household"

# 2. DRY RUN — prints the write counts, mutates nothing.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-stow npm run backfill:positions -- --dry-run
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-stow npm run backfill:status -- --dry-run

# 3. APPLY against the emulator.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-stow npm run backfill:positions
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-stow npm run backfill:status

# 4. IDEMPOTENCY CHECK — re-run; both reports must show 0 writes.
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-stow npm run backfill:positions
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-stow npm run backfill:status
```
Expected: step 2 reports nonzero `spaceWrites`/`areaWrites`/`itemWrites`; step 3 applies them; step 4 reports `0` for all (proves idempotency). Optionally `--household <id>` to scope a single household.

- [ ] **Step 8: Production run procedure (document; do not execute here)**

Add this runbook to the plan; the engineer executes it during the production cutover window, **before** the route swap so the canonical app reads fully-materialized data:

```bash
# Authenticate admin with prod credentials (service account), no emulator host set.
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
export GCLOUD_PROJECT=stow-50f36   # production project id (see README "Functions Secret Encryption")

# 1. DRY RUN against prod — review counts.
npm run backfill:positions -- --dry-run
npm run backfill:status -- --dry-run

# 2. Apply.
npm run backfill:positions
npm run backfill:status

# 3. Re-run to confirm 0 writes (idempotent / safe to repeat).
npm run backfill:positions
npm run backfill:status
```
Safety notes to include: scripts only ever **add** missing fields (`planPositions`/`planStatus` skip docs that already have the target field), never delete or overwrite existing `position`/`status`; safe to re-run; safe to run while the old apps are live because read-time normalization (contract §4.1) already tolerates both the pre- and post-backfill states.

- [ ] **Step 9: Commit**

```bash
git add scripts/backfill-positions.ts scripts/backfill-status.ts scripts/backfill.test.ts package.json
git commit -m "feat(scripts): add idempotent dry-run backfills for position and status"
```

---

## Task 5: Repoint canonical routes to the mobile app (`basePath=""`)

Make the mobile app canonical. The mechanism (contract §3): `StowMobileApp` calls `useMobileNavigation(householdId, basePath)`; today that defaults to `"/app"`. Cutover threads `basePath=""` so the pure `parseMobileRoute`/`buildMobilePath` drive `/spaces*`, `/items/:id`, `/search`, `/packing`, `/settings` directly. `StowMobileRoutePage` keeps the auth/bootstrap/PWA shell; we point the canonical `<Route>`s at it and delete the temporary `/app/*` route and the legacy `/spaces*` → `SpacesRoutePage` wiring.

**Files:**
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx` (accept + pass `basePath`)
- Modify: `src/routes/StowMobileRoutePage.tsx` (pass `basePath=""`)
- Modify: `src/App.tsx` (repoint routes)

- [ ] **Step 1: Make `StowMobileApp` accept a `basePath` prop**

In `src/features/stow/ui/mobile/StowMobileApp.tsx`, extend the props and thread it into the nav hook.

Before:
```tsx
interface StowMobileAppProps {
  householdId: string;
  user: User;
  onSignOut: () => void;
  online: boolean;
}

export function StowMobileApp({ householdId, user, onSignOut, online }: StowMobileAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useMobileNavigation(householdId);
```
After:
```tsx
interface StowMobileAppProps {
  householdId: string;
  user: User;
  onSignOut: () => void;
  online: boolean;
  basePath?: string;
}

export function StowMobileApp({ householdId, user, onSignOut, online, basePath = "" }: StowMobileAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useMobileNavigation(householdId, basePath);
```
*(Default `""` makes canonical the default; the dev `/app` mount becomes explicit. `useMobileNavigation`'s own default stays `"/app"` per contract §3 — but every caller now passes a value, so behavior is unambiguous.)*

- [ ] **Step 2: Pass `basePath=""` from the route page**

In `src/routes/StowMobileRoutePage.tsx`, find the `<LazyStowMobileApp .../>` render and add `basePath=""`:

Before:
```tsx
        <LazyStowMobileApp
          householdId={bootstrap.householdId}
          user={user}
          onSignOut={() => void signOutUser()}
          online={online}
        />
```
After:
```tsx
        <LazyStowMobileApp
          householdId={bootstrap.householdId}
          user={user}
          onSignOut={() => void signOutUser()}
          online={online}
          basePath=""
        />
```

- [ ] **Step 3: Repoint the route table in `src/App.tsx`**

Replace the entire `<Routes>` body so every canonical inventory path renders `StowMobileRoutePage`, the `/` and `*` redirects land on `/spaces`, and the temporary `/app/*`, the legacy `/spaces*`/`/items`/`/search`/`/packing`/`/settings` → `SpacesRoutePage`, and the `/next/*` routes are removed.

Before (current body — see live file, lines 39–104): a block of `/spaces`, `/spaces/:spaceId`, `/spaces/:spaceId/areas/:areaId`, `/items/:itemId`, `/search`, `/packing`, `/settings` each rendering `SpacesRoutePage`, plus `/next/*` → `StowNextRoutePage`, plus the `/app/*` → `StowMobileRoutePage` added in P0, plus the two `Navigate` redirects.

After:
```tsx
export default function App() {
  return (
    <Routes>
      <Route
        path="/auth/finish"
        element={
          <Suspense fallback={<RouteLoading message="Loading sign-in…" />}>
            <AuthFinishPage />
          </Suspense>
        }
      />
      <Route
        path="/invite"
        element={
          <Suspense fallback={<RouteLoading message="Loading invite…" />}>
            <AcceptInvitePage />
          </Suspense>
        }
      />
      <Route
        path="/spaces"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/spaces/:spaceId"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/spaces/:spaceId/areas/:areaId"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/items/:itemId"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/search"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/packing"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/settings"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route
        path="/activity"
        element={
          <Suspense fallback={<RouteLoading message="Loading app…" />}>
            <StowMobileRoutePage />
          </Suspense>
        }
      />
      <Route path="/" element={<Navigate to="/spaces" replace />} />
      <Route path="*" element={<Navigate to="/spaces" replace />} />
    </Routes>
  );
}
```
> Notes:
> - The `/activity` route is added because P4's `ActivityScreen` is a routed full-screen view at `${basePath}/activity` (contract §3 P4); with `basePath=""` that is `/activity`. If P4 already added `/activity` under `/app`, this promotes it to canonical.
> - `StowMobileApp` renders the active screen and overlays internally based on `parseMobileRoute`, so a single `StowMobileRoutePage` element behind each path is sufficient (same pattern legacy used with `SpacesRoutePage`). React Router will re-render the element as the URL changes within these paths.

- [ ] **Step 4: Remove the now-unused lazy imports in `src/App.tsx`**

The legacy + next route pages are about to be deleted (Task 6). Remove their imports now so this commit type-checks against the still-present files but no longer references them in the table.

Before (lines 6–7):
```tsx
const SpacesRoutePage = lazy(() => import("@/routes/SpacesRoutePage"));
const StowNextRoutePage = lazy(() => import("@/routes/StowNextRoutePage"));
```
After:
```tsx
const StowMobileRoutePage = lazy(() => import("@/routes/StowMobileRoutePage"));
```
*(If P0 already added the `StowMobileRoutePage` lazy import below the `StowNextRoutePage` line, just delete the `SpacesRoutePage` and `StowNextRoutePage` lines and keep the single `StowMobileRoutePage` import — do not duplicate it.)*

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS. `SpacesRoutePage.tsx`/`StowNextRoutePage.tsx` still exist on disk (deleted in Task 6) but are no longer imported, which is fine.

- [ ] **Step 6: Manual smoke — canonical routes now serve the new app**

Run `npm run dev`, open `http://127.0.0.1:5173/` → redirects to `/spaces` → the **mobile** app renders (bottom nav + scan FAB over the warm backdrop). Navigate tabs: URL becomes `/search`, `/packing`, `/settings` (no `/app` prefix); open a space → `/spaces/:id`; open an item → `/items/:id?from=…`; browser Back works. Open `/app/spaces` → it now also resolves (the `/app/*` route was removed, so `*` redirects to `/spaces`). A previously-generated QR link `${origin}/spaces/<id>` opens the room.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/routes/StowMobileRoutePage.tsx src/features/stow/ui/mobile/StowMobileApp.tsx
git commit -m "feat: repoint canonical routes to the mobile app (basePath empty)"
```

---

## Task 6: Delete the legacy + desktop-next apps

With canonical routes on the mobile app, remove the two old UIs and their route pages, then prove nothing imports them. Per spec §1, legacy `StowApp.tsx` is ~2.7k lines and desktop `StowNextApp.tsx` ~3k lines; both consume the shared data layer, which **stays**.

**Files (delete):**
- `src/routes/SpacesRoutePage.tsx`
- `src/routes/StowNextRoutePage.tsx`
- `src/features/stow/ui/StowApp.tsx`
- `src/features/stow/ui/next/StowNextApp.tsx` (and the rest of `src/features/stow/ui/next/` if wholly unreferenced)
- Any of `src/features/stow/ui/tabs/`, `src/features/stow/ui/item/`, `src/features/stow/ui/packing/`, `src/features/stow/ui/shared/` that becomes unreferenced once `StowApp.tsx` is gone

- [ ] **Step 1: Inventory references before deleting**

Run a grep sweep to see who imports each target (run from repo root):
```bash
grep -rn "routes/SpacesRoutePage\|routes/StowNextRoutePage" src tests
grep -rn "ui/StowApp\|ui/next/StowNextApp" src tests
grep -rn "stow/ui/tabs\|stow/ui/item\b\|stow/ui/packing\|stow/ui/shared" src tests
```
Expected after Task 5: the only hits for the route pages are their own files; `ui/StowApp`/`ui/next/StowNextApp` hits are their own files plus the smoke specs (retargeted in Task 8). Record any *unexpected* importer and resolve it before deleting (e.g. a shared helper that actually belongs under `lib/` — move it, don't delete).

- [ ] **Step 2: Determine which `ui/*` legacy subfolders are safe to delete**

For each of `tabs/`, `item/`, `packing/`, `shared/` under `src/features/stow/ui/`, check whether anything **outside** the deletion set still imports it:
```bash
for dir in tabs item packing shared; do
  echo "== ui/$dir importers (excluding the dirs being deleted) =="
  grep -rn "stow/ui/$dir" src | grep -v "ui/StowApp" | grep -v "ui/$dir/" | grep -v "ui/tabs/" | grep -v "ui/item/" | grep -v "ui/packing/" | grep -v "ui/shared/"
done
```
Delete only the subfolders with **no** external importers. If the mobile module (`ui/mobile/`) imports something from `ui/shared/`, that file must instead live under `ui/mobile/` or `lib/` — relocate it in a prior commit rather than keeping the legacy folder alive. (Per contract §0.2 all new code is under `ui/mobile/`, so this should not happen; the grep confirms it.)

- [ ] **Step 3: Delete the files**

```bash
git rm src/routes/SpacesRoutePage.tsx src/routes/StowNextRoutePage.tsx
git rm src/features/stow/ui/StowApp.tsx
git rm -r src/features/stow/ui/next
# Delete only the subfolders Step 2 proved unreferenced, e.g.:
git rm -r src/features/stow/ui/tabs src/features/stow/ui/item src/features/stow/ui/packing src/features/stow/ui/shared
```
Adjust the last line to exactly the set Step 2 cleared.

- [ ] **Step 4: Prove nothing references the deleted modules**

```bash
grep -rn "SpacesRoutePage\|StowNextRoutePage\|ui/StowApp\|StowNextApp" src
grep -rn "stow/ui/tabs\|stow/ui/item\b\|stow/ui/packing\|stow/ui/shared" src
```
Expected: **no output** (empty) from both. If anything remains, it is a missed importer — fix it.

- [ ] **Step 5: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both PASS. The Vite bundle no longer includes the two large legacy chunks. (`grep -rn "qrcode" src` should now show only `ui/mobile/capture/qr.ts` — legacy's QR usage is gone, ours remains.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete legacy and desktop-next apps after cutover"
```

---

## Task 7: Token cleanup — collapse to one design system

Three token systems exist today (spec §3 "retire the 3 conflicting palettes at cutover"):
1. The mobile app's `--stow-*` tokens — `src/features/stow/ui/mobile/theme/tokens.css` + `makePalette` (P0). **Keep.**
2. The legacy `:root` hex tokens in `src/styles.css` lines 1–18 (`--ink`, `--accent`, `--accent-soft: #fff0ea`, …) — consumed by legacy `StowApp.tsx` **and** the shared auth/bootstrap chrome (`.center-shell`, `.panel`, `.banner`, `.btn`, `.muted`, `.stack`) that `StowMobileRoutePage` still renders. **Keep the `:root` block and the shared chrome; remove the legacy `.app-shell`-scoped UI rules that only StowApp used.**
3. The desktop-next `.stow-next` OKLCH token block + all `next-*` rules in `src/styles.css` — lines 2081→EOF (verified self-contained: every selector from line 2082 to EOF is `.stow-next`/`.next-*`). **Remove entirely.**

> Verified scope (do not assume): the `.stow-next` region is `src/styles.css` 2081–4086 and contains no non-`next` selectors. The shared chrome classes are defined at lines ~60–340 and are still used by route pages — **must not be deleted.** The legacy mid-file region (≈340–2080) is scoped to `.app-shell` and legacy component classes used only by the now-deleted `StowApp.tsx`.

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Remove the desktop-next `.stow-next` token + style region**

Delete `src/styles.css` from the comment marker `/* Stow Next: isolated redesign route */` (line 2081) through end-of-file (line 4086, the closing `}` of the final `@media (prefers-reduced-motion: reduce)` block). Confirm the deletion boundary first:
```bash
sed -n '2079,2083p' src/styles.css   # shows the marker + start
tail -3 src/styles.css               # shows the EOF block being removed
```
Then remove that contiguous range. Verify no `.stow-next`/`.next-` rules remain:
```bash
grep -n "\.stow-next\|\.next-\|oklch" src/styles.css
```
Expected: **no output**.

- [ ] **Step 2: Remove the legacy-only `.app-shell` UI rules**

The legacy phone-frame UI rules (scoped to `.app-shell`, `.phone-frame`, `.screen`, `.space-list-*`, `.area-card`, `.search-*`, `.pack-*`, `.command-*`, `.capture-*`, `.draft-*`, `.fab`, `.bottom-nav`, `.nav-btn`, `.delete-confirm-card`, etc.) are now dead — only `StowApp.tsx` used them and it is deleted. Identify the legacy region (it begins around the `.app-shell` selector, ~line 350 area, and runs up to the `/* Stow Next … */` marker that Step 1 removed) and delete the legacy-component rules within it.

**Keep** (do not delete) — the shared chrome at the top of the file used by `StowMobileRoutePage`/`AuthGate`:
- The `:root { … }` token block (lines 1–18).
- `html, body, #root`, `body` background.
- `.global-banners`, `.banner` (+ variants), `.center-shell`, `.panel`, `.auth-panel` (+ `h1`), `.muted`, `.stack`, `.stack-sm`, `.btn` (+ `.primary`/`.danger`/`.full`/`:disabled`/`:focus-visible`).

> Practical method: this is a large mechanical excision. Work selector-block by selector-block from just after the kept shared-chrome rules down to where Step 1's deletion began. For each block, grep its class against `src/` to confirm it is unused before removing:
> ```bash
> grep -rn "className=\"[^\"]*\bphone-frame\b" src   # repeat per class; empty => safe to delete
> ```
> Keep `.next-auth-panel`/`.next-auth-progress`? **No** — those were only rendered by the deleted `StowNextRoutePage`; remove them. (Verify: `grep -rn "next-auth" src` → empty after Task 6.)

- [ ] **Step 3: Note the `docs/mockups/capture-flow.html` divergence (do not edit non-plan files)**

`docs/mockups/capture-flow.html` is a static design mockup that carries its own inline/standalone token values, divergent from the live `--stow-*` system. It is **not** part of the app bundle and is not imported anywhere. Per the cutover scope it should be reconciled or retired separately; record this here as a known divergence and a follow-up (it is a documentation artifact, out of scope for this plan's single-file constraint). Verify it is not referenced by the app:
```bash
grep -rn "capture-flow.html\|docs/mockups" src index.html
```
Expected: **no output** (confirms it is inert).

- [ ] **Step 4: Verify token system is singular**

```bash
grep -n "color-scheme\|--stow-accent\|--accent:" src/styles.css
grep -rn "var(--accent" src        # legacy token usages — should only be shared chrome in styles.css
grep -rn "var(--stow-" src/features/stow/ui/mobile | head
```
Expected: `src/styles.css` retains exactly one `:root` token block (the shared one) for chrome; the app UI uses `--stow-*` exclusively (scoped to `.stow-mobile`); no `.stow-next`/OKLCH tokens remain.

- [ ] **Step 5: Build + manual smoke**

Run: `npm run build`. Then `npm run dev`: the auth/bootstrap shell (sign-in panel, offline/install banners, loading states) still renders correctly (proves shared chrome survived), and the mobile app renders with its `--stow-*` theme.

- [ ] **Step 6: Commit**

```bash
git add src/styles.css
git commit -m "chore: collapse to one token system, remove legacy + next styles"
```

---

## Task 8: Tests + docs — retarget smoke specs, update README

Retarget the Playwright smoke coverage to the canonical mobile app and remove the desktop-next spec, then refresh README.

**Files:**
- Modify: `tests/smoke/authenticated-smoke.spec.ts`
- Delete: `tests/smoke/next-redesign.spec.ts`
- Modify: `playwright.config.ts` (webServer readiness URL is already `/spaces` — confirm it still serves)
- Modify: `README.md`

- [ ] **Step 1: Remove the desktop-next smoke spec**

`tests/smoke/next-redesign.spec.ts` drives `/next` and `next-*` DOM (e.g. line 44 `page.goto("/next")`, line 55 heading `"Organize inventory"`, line 108 `Open legacy spaces` → `/spaces`). That app no longer exists.
```bash
git rm tests/smoke/next-redesign.spec.ts
```

- [ ] **Step 2: Retarget `authenticated-smoke.spec.ts` to the mobile app on canonical routes**

The existing spec (`tests/smoke/authenticated-smoke.spec.ts`) signs in at `/spaces` and drives legacy DOM: `"Your Spaces"` (line 69), the legacy add-space dialog `"New Space"` (line 74), `.fab` (line 102), legacy dialogs (`"Add Item"`, `"No Photo Item"`, `"Photo Draft"`, `"AI Photo Assist"`), `.picker-item`, `.delete-confirm-card`, and a "desktop capture workspace" describe block (lines 218–227). With the mobile app canonical, rewrite the flows against the **mobile** UI selectors. The sign-in helper (`waitForEmailLink`, the emulator OOB-code dance) and `mockCallable` are reusable as-is; the post-sign-in assertions change.

Rewrite the spec body to this shape (selectors must match the P1–P4 mobile components' accessible names/roles — adjust to the final implementation if labels differ, but keep the canonical routes and the assertions below):

```ts
import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "demo-stow";
const APP_BASE_URL = "http://127.0.0.1:4273";

type OobCodeRecord = { email?: string; oobCode?: string; oobLink?: string; requestType?: string };

async function waitForEmailLink(email: string) {
  // ...unchanged from the current spec (lines 17–51): poll the emulator OOB endpoint,
  // build an /auth/finish URL against APP_BASE_URL...
}

async function signIn(page: Page, prefix = "smoke") {
  const email = `${prefix}-${Date.now()}@example.com`;
  await page.goto("/spaces");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
  await expect(page.getByText(`Sign-in link sent to ${email}`)).toBeVisible();
  await page.goto(await waitForEmailLink(email));
  const finishSignInButton = page.getByRole("button", { name: "Finish Sign-In" });
  if (await finishSignInButton.isVisible()) {
    await page.getByPlaceholder("you@example.com").fill(email);
    await finishSignInButton.click();
  }
  // Canonical route is the mobile app now.
  await expect(page).toHaveURL(/\/spaces/);
  // Mobile Home: the "Stow." wordmark + Spaces managed list.
  await expect(page.getByRole("heading", { name: /Your Spaces/i })).toBeVisible({ timeout: 20_000 });
}

test("mobile canonical app: spaces, add item, search, packing, settings", async ({ page }) => {
  await signIn(page);

  // Bottom nav present (4 tabs + scan FAB).
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan" })).toBeVisible();

  // Add a space via AddSpaceSheet.
  await page.getByRole("button", { name: /Add Space/i }).click();
  await page.getByRole("dialog").getByLabel(/name/i).fill("Gear Closet");
  await page.getByRole("dialog").getByRole("button", { name: /Add Space|Create/i }).click();
  await expect(page.getByText("Gear Closet")).toBeVisible();

  // Open the space, add a no-photo item via AddItemSheet.
  await page.getByText("Gear Closet").click();
  await expect(page).toHaveURL(/\/spaces\//);
  await page.getByRole("button", { name: /Add Item/i }).click();
  await page.getByRole("dialog").getByLabel(/name/i).fill("Sensitive Documents");
  await page.getByRole("dialog").getByRole("button", { name: /Save|Add Item/i }).click();
  await expect(page.getByText("Sensitive Documents")).toBeVisible();

  // Search tab (canonical /search) finds it + persists a recent search.
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search/);
  await page.getByPlaceholder(/Find|Search/i).fill("Sensitive");
  await expect(page.getByText("Sensitive Documents")).toBeVisible();

  // Packing tab (canonical /packing).
  await page.getByRole("button", { name: "Packing" }).click();
  await expect(page).toHaveURL(/\/packing/);

  // Settings tab (canonical /settings).
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings/);
  await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();
});

test("mobile canonical app: per-space QR deep link round-trips", async ({ page }) => {
  await signIn(page, "qr-smoke");
  await page.getByRole("button", { name: /Add Space/i }).click();
  await page.getByRole("dialog").getByLabel(/name/i).fill("Garage");
  await page.getByRole("dialog").getByRole("button", { name: /Add Space|Create/i }).click();
  await page.getByText("Garage").click();
  await expect(page).toHaveURL(/\/spaces\/([^/]+)$/);
  const spaceUrl = page.url();
  // Open the QR sheet from the room header and assert the canonical link is shown.
  await page.getByRole("button", { name: /Space QR/i }).click();
  await expect(page.getByText(spaceUrl.replace(APP_BASE_URL, "").length ? new RegExp("/spaces/") : /\/spaces\//)).toBeVisible();
  // Navigating directly to the space deep link (what the QR encodes) opens the room.
  await page.goto(spaceUrl);
  await expect(page.getByRole("heading", { name: "Garage" })).toBeVisible();
});
```
> Notes for the implementer:
> - Drop the legacy "desktop capture workspace" describe block — there is no desktop variant anymore.
> - Replace placeholder/role names above with the **actual** accessible names from the shipped P1–P4 components if they differ (e.g. the AddSpace sheet's button label, the search input placeholder "Find anything…"). Keep: sign-in at `/spaces`, the canonical-URL assertions (`/search`, `/packing`, `/settings`, `/spaces/:id`), and at least one QR/recent-search assertion to cover P5 parity.
> - The vision callable mocks (`mockCallable(page, "visionCategorizeItemImage", …)`) from the current spec remain valid if you keep an AI-scan flow assertion; they are provider-shaped, not UI-shaped.

- [ ] **Step 3: Confirm Playwright webServer readiness**

`playwright.config.ts` `webServer.url` is `${BASE_URL}/spaces`. Post-cutover `/spaces` serves the mobile app behind auth (the route resolves and returns HTML), so readiness still works — no change required. Confirm by reading the config; if the team prefers, change the readiness URL to `${BASE_URL}/` (also valid; redirects to `/spaces`). Leave as-is unless the smoke run reports the server never became ready.

- [ ] **Step 4: Run the smoke suite**

Run: `npm run test:smoke`
Expected: PASS — the two retargeted tests drive the mobile app on canonical routes. Iterate selector names against the real components until green. (`test:smoke` boots emulators + the Vite dev server via the `webServer` config and runs everything except `@live-gemini`.)

- [ ] **Step 5: Update `README.md`**

Make the README reflect the single canonical app:
- "What Is Implemented" (line 12 block): change "Firestore-backed spaces/areas/items CRUD UI (core flows)" / "Packing flow, search, item edit/delete, local QR label generation" wording to describe the **mobile-first canonical app** (retrieval-first home, Spaces Option D management, camera + AI single + whole-shelf batch capture, activity feed, lending/status), and note that the legacy `/spaces` and desktop `/next` UIs were removed at cutover.
- Add a one-line "Data migrations" note under "Demo Seeding": after deploying P5, run `npm run backfill:positions` and `npm run backfill:status` (dry-run first) to materialize `position`/`status` on existing households; both are idempotent.
- If the README references screenshots of the old UI, replace/remove them. (There are currently none in `README.md`; if a future screenshot section is added, it should show the mobile app.) Record "no screenshots present" if that remains true.

- [ ] **Step 6: Commit**

```bash
git add tests/smoke/authenticated-smoke.spec.ts README.md
git rm tests/smoke/next-redesign.spec.ts 2>/dev/null || true
git commit -m "test+docs: retarget smoke specs to canonical mobile app; update README"
```

---

## Task 9: Final verification

Run every gate green and confirm the cutover invariants.

- [ ] **Step 1: Unit suite + typecheck + build**

Run: `npm run typecheck && npm test && npm run build`
Expected: all PASS, including the new `qr.test.ts`, `recentSearches.test.ts`, and `backfill.test.ts`; no references to deleted modules; the production bundle builds without the legacy/next chunks.

- [ ] **Step 2: Rules tests**

Run: `npm run test:rules`
Expected: PASS (the P4 `activity` rules test and existing rules tests are unaffected by cutover).

- [ ] **Step 3: Smoke (E2E)**

Run: `npm run test:smoke`
Expected: PASS — both retargeted specs drive the canonical mobile app; no `/next` spec remains.

- [ ] **Step 4: Functions tests**

Run: `npm run functions:test`
Expected: PASS (functions are untouched by P5; this confirms no incidental breakage).

- [ ] **Step 5: Confirm cutover invariants by inspection**

```bash
# Default route renders the new app: App.tsx has no SpacesRoutePage/StowNextRoutePage imports,
# and every canonical path points at StowMobileRoutePage.
grep -n "RoutePage" src/App.tsx

# One token system: no .stow-next / OKLCH tokens; --stow-* used by the app.
grep -rn "\.stow-next\|oklch" src ; echo "(expected: empty)"

# No dangling references to the deleted apps anywhere.
grep -rn "StowApp\|StowNextApp\|SpacesRoutePage\|StowNextRoutePage" src ; echo "(expected: empty)"

# QR comes only from the mobile module.
grep -rn "qrcode" src ; echo "(expected: only ui/mobile/capture/qr.ts)"
```
Expected outputs: `App.tsx` shows only `StowMobileRoutePage`; the three "expected: empty" greps are empty; `qrcode` appears only in `ui/mobile/capture/qr.ts`.

- [ ] **Step 6: Manual end-to-end sanity in dev**

Run `npm run dev`. Verify: `/` → `/spaces` renders the mobile app; tabs route to `/search`/`/packing`/`/settings`; a space deep link opens the room and its QR sheet generates a scannable code; the Scan FAB → "Scan a Stow QR label" navigates from a pasted link; recent searches persist across reloads; delete-with-reassignment requires a destination when items exist; an item shows `status` ("Away from home" strip for non-home). Legacy `/next` now redirects to `/spaces` (route removed).

- [ ] **Step 7: Final commit (if any fixups)**

```bash
git add -A
git commit -m "chore: P5 cutover verified — mobile app canonical, legacy removed"
```

---

## Self-review (P5 plan vs roadmap / spec §4.2 + §7.8 / contract §4.1 + §12)

**Roadmap P5 tasks (`2026-06-06-stow-mobile-redesign-roadmap.md` "P5 — Cutover"):**
- (1) Run/confirm migrations (`position`, `status`) one-time scripts against prod/emulator → **Task 4** (full code for `backfill-positions.ts` + `backfill-status.ts`, idempotent + dry-run, planner unit tests, emulator + prod runbooks). ✓
- (2) `App.tsx` repoint `/`, `/spaces*`, `/search`, `/packing`, `/settings`, `/items/:id` to the new app; remove `/app` temp prefix → **Task 5** (exact before/after route table; `basePath=""` threaded via `StowMobileApp` + `StowMobileRoutePage`; `/app/*` removed; `/activity` promoted). ✓
- (3) Delete `StowApp.tsx` (+ legacy `ui/tabs`/`ui/item`/`ui/packing`/`ui/shared` if unreferenced) and `next/StowNextApp.tsx` + `StowNextRoutePage.tsx` → **Task 6** (grep-gated deletion incl. `SpacesRoutePage.tsx`; proof greps return empty). ✓
- (4) Remove legacy `:root` hex tokens + JS palette and `.stow-next` OKLCH tokens; remove `docs/mockups` divergence note → **Task 7** (verified `.stow-next` region 2081–EOF self-contained; **keeps** shared chrome `:root` + `.center-shell`/`.panel`/`.banner`/`.btn` used by the surviving route page; notes `docs/mockups/capture-flow.html` divergence without editing it). ✓ *Refinement vs roadmap:* roadmap said "remove legacy `:root` … and JS palette" — corrected to **keep** the shared chrome `:root` block (route page still needs it) while removing legacy `.app-shell` UI rules + the next block; the legacy JS `makePalette`/`applyPalette` for the *legacy* app dies with `StowApp.tsx` (the **mobile** `makePalette` stays).
- (5) Update Playwright: retarget `authenticated-smoke.spec.ts` to canonical routes; replace `next-redesign.spec.ts` → **Task 8** (retargeted smoke to mobile DOM on canonical routes + QR round-trip; `next-redesign.spec.ts` deleted; webServer readiness confirmed). ✓
- (6) Update README screenshots/notes → **Task 8 Step 5** (rewrites "implemented" wording, adds migration note, handles screenshots/none). ✓

**Spec §4.2 (cutover):** repoint `/`, `/spaces`, `/search`, `/packing`, `/settings`, `/items/:id` to new app → Task 5; delete `StowApp.tsx` + `next/StowNextApp.tsx` → Task 6; remove legacy + desktop token sets + `docs/mockups` divergence → Task 7; update `App.tsx` default redirect + Playwright smoke specs → Tasks 5 + 8. ✓

**Spec §7.8 (parity items to carry over before cutover):**
- QR generation per space + QR-scan-to-navigate → **Task 1** (full ports: `spaceQrUrl`/`parseScannedStowTarget`/`generateSpaceQrDataUrl` with tests, `SpaceQrSheet`, `ScanQrSheet`, RoomScreen + ScanOverlay wiring; reuses the `qrcode` package as legacy does). ✓
- Image-orphan cleanup on replace/delete → handled in **P2** (`bestEffortDeleteImage`, contract §9.1); noted as already-done, not re-implemented here. ✓ (out of P5 scope by design)
- Delete space/area with item reassignment → **Task 3** (audit + gap-fill of P1 wiring; ensures confirm + destination picker everywhere; `reassignTo` snapshot correctness). ✓
- Persisted recent searches (localStorage) → **Task 2** (full port `recentSearches.ts` with tests; same `stow:${householdId}:recent-searches` key for carry-over; wired into `SearchScreen`). ✓

**Contract §4.1 (normalization & migration):**
- Backfill `position` by current name order, per space and per area-within-space → Task 4 `planPositions` + `backfill-positions.ts` (spaces collection + nested areas subcollection). ✓
- Backfill `status = isPacked ? "packed" : "home"` → Task 4 `planStatus` + `backfill-status.ts` (flat items collection). ✓
- "Until run, normalization keeps everything rendering" → scripts only add missing fields, never overwrite; safe to run while old/new apps coexist (documented in Task 4 Steps 7–8). ✓

**Contract §3 (basePath `""` cutover):** `useMobileNavigation(householdId, basePath)` driven with `""` so the same pure parser handles canonical routes; `parseMobileRoute`/`buildMobilePath` are prefix-aware (already unit-tested in P0) → Task 5. ✓

**Contract §12 (P5 index): "run §4.1 backfills; repoint routes (basePath `""`); delete legacy/desktop; remove old token sets; QR + recent-searches parity; smoke specs."** → Tasks 4, 5, 6, 7, 1+2, 8 respectively. All covered. ✓

**Conventions/format (contract §0, P0 template):** writing-plans header (Goal/Architecture/Tech Stack/Spec+Roadmap+Contract links + sub-skill note); `## Task N` sections with **Files** + bite-sized `- [ ]` steps; TDD (failing test → run → impl → run → commit) for the QR helper, recent-searches helper, and backfill planners; explicit before/after edit blocks + grep/verify for the mechanical route repoint, deletions, and token removal; every commit ends with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer; verification = `npm run typecheck && npm test && npm run build` (no `verify` script), plus `test:rules`/`test:smoke`/`functions:test` in Task 9. No placeholders — full code given for both backfill scripts, the QR port, and the recent-searches helper. ✓
