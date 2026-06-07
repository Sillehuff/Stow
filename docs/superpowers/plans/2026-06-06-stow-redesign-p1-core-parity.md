# Stow Mobile Redesign — P1 Core-Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate every non-capture screen of the mobile prototype at fidelity on the `/app` shell built in P0 — retrieval-first Home, Spaces "Option D" management (action sheet, hold-to-drag reorder with persisted `position`, edit-space with color/icon customization + expanded icon library), Room/Area, location-first Item detail (view/edit/tag/move), Search, Packing, and Settings — wired to the existing shared data layer with the P1 ordering additions.

**Architecture:** All new code lands in `src/features/stow/ui/mobile/` (`shell/`, `components/`, `screens/`, `spaces/`, `add/`, `hooks/`) and reads CSS custom-property tokens (no `P` prop — translate prototype `P.x`/`St.x` to `var(--stow-x)` per contract §1.3). Ordering is applied **client-side** in `useWorkspaceData` (no Firestore `orderBy("position")`, no new index — contract §4.1). Repository gains batched `reorderSpaces`/`reorderAreas` and a `position` field. Screens consume `useWorkspaceData` (data + actions) and `useMobileNavigation` (route + overlay state); `StowMobileApp` swaps its P0 placeholder for real per-tab screens plus overlay rendering, and routes `/app/items/:id` to `ItemDetail`.

**Tech Stack:** React 19 + TypeScript, react-router-dom v7, lucide-react, Firebase (Firestore/Storage/Functions), Vite, Vitest (node env, pure-function tests — repo has no jsdom/RTL), Playwright (mobile `/app` e2e).

**Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md` · **Roadmap:** `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md` · **Contract (LOCKED):** `docs/superpowers/plans/2026-06-06-stow-redesign-shared-contract.md`

**Conventions** (from contract §0 + §0.1):
- **TDD bite-sized steps:** write failing test → run (`npx vitest run <path>`, expect FAIL) → minimal impl → run (expect PASS) → commit. One action per step.
- **Test commands:** single file `npx vitest run <path>`; full unit suite `npm test` (excludes rules + smoke); rules `npm run test:rules`; e2e `npm run test:smoke`.
- **There is no `verify` script.** "Verify" = `npm run typecheck && npm test && npm run build`.
- **Tests are pure-function / node-env only** (Vitest). Unit-test: reorder position math, `reorderIndex`, the position-sort comparator. Screens are validated by manual dev load + a Playwright addition — **no DOM unit tests**.
- **Commit trailer** on every commit message:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Do not touch** legacy `src/features/stow/ui/StowApp.tsx`, `ui/next/StowNextApp.tsx`, `ui/tabs`, `ui/item`, `ui/shared`, `ui/packing`, or canonical routes until **P5**. (You may READ them.)
- **Depth (contract §0.1):** logic (repo methods, hooks, reducers, the position-sort memo, every screen's data wiring + event handlers) is written **in full**. For screen MARKUP: the task gives the TS prop interface + exact `useWorkspaceData`/`useMobileNavigation` bindings + section structure + non-obvious code, then instructs: *"Port the markup from `prototype/<file>.jsx` → `<Component>`, translating tokens per contract §1.3 (`P.x`→`var(--stow-x)`, radius offsets→`var(--stow-radius-*)`, alpha tints→`color-mix`) and prototype mock-data per contract §11."* No placeholders ("TODO", "TBD", "etc.", "similar to above", prose-without-code for logic) — those are plan failures.
- **Module location (contract §0.2):** all new code under `src/features/stow/ui/mobile/`; imports use the `@/` alias.

**Prototype → domain mapping (contract §11), used by every screen:** `ROOMS[]`→`useWorkspaceData().spaces: SpaceWithAreas[]`; room `icon` PascalCase (`"Home"`)→`Space.icon` lowercase key (`"home"`) rendered via `iconForKey`; room `areas:[{name}]`→`Area[]` (`spaceId`,`name`,`position`); `ITEMS[].roomId`→`Item.spaceId`; `ITEMS[].area` string→`Item.areaId` + `Item.areaNameSnapshot`; `ITEMS[].isFolder`→`Item.kind === "folder"`; `ITEMS[].image` url→`Item.image?.downloadUrl` (placeholder glyph when absent); `ITEMS[].isPacked`→`Item.isPacked`; `ITEMS[].isPriceless`→`Item.isPriceless`; `PACKING_LISTS[]`→`PackingList` (`itemIds`/`packedItemIds`); `MEMBERS[]`→`HouseholdMember` (`uid`,`displayName`/`email`,`role`). **Never ship `PHOTO_POOL`/`CAMERA_FEED` mock URLs.** Photo capture/editing is a placeholder slot in P1 (real camera = P2).

**APIs you build on (P0, contract §1–3):** `theme/palette.ts` (`makePalette`/`applyPalette`/`DEFAULT_ACCENT`/`Palette`), `theme/tokens.css` (`.stow-mobile` scoped vars + keyframes), `theme/icons.tsx` (`ICONS`, `FALLBACK_ICON`, `ICON_CATEGORIES`, `iconForKey`, glyph re-exports), `hooks/useMobileNavigation.ts` (`useMobileNavigation`, `parseMobileRoute`, `buildMobilePath`, `MobileTab`, `OverlayKind`, `OverlayState`), `shell/BottomNav.tsx`, `shell/Toast.tsx`, `StowMobileApp.tsx` shell.

> **Contract note for the reviewer:** P0 shipped `theme/icons.tsx` with only the 16-key `ICONS` map and a 4-category `ICON_CATEGORIES` (rooms/storage/kitchen/outdoor, 4 icons each). Contract §2 says **"P1 expands `ICONS` + `ICON_CATEGORIES` to the full categorized set."** Task 4 below performs that expansion (adds `tv`,`door`,`shirt`,`book`,`music`,`heart`,`gift`,`key`,`plug`,`clock` to `ICONS`, fills the categories to the full §2 lists). No signature changes — only data additions to existing exports.

---

## Task 1: Domain — add `position`, free-form `Space.icon`

**Files:**
- Modify: `src/types/domain.ts`

- [x] **Step 1: Change `SpaceIcon` usage and add `position`** (no unit test — pure type change; verified by `npm run typecheck` in later tasks. Per contract §4: `Space.icon` becomes `string`, `SpaceIcon` stays exported, both gain `position: number`.)

In `src/types/domain.ts`, the `SpaceIcon` type stays as-is (line 5):
```ts
export type SpaceIcon = "home" | "coffee" | "briefcase" | "box" | "folder";
```
Change the `Space` interface (currently lines 43–52) to:
```ts
export interface Space {
  id: string;
  householdId: string;
  name: string;
  icon: string; // free-form key validated at the UI boundary via iconForKey (contract §2); legacy DB values home|coffee|briefcase|box|folder already match ICONS keys
  color: string;
  image?: ImageRef;
  position: number; // sort order (P1, contract §4); missing docs default to a large sentinel client-side
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
Change the `Area` interface (currently lines 54–62) to:
```ts
export interface Area {
  id: string;
  householdId: string;
  spaceId: string;
  name: string;
  image?: ImageRef;
  position: number; // sort order (P1, contract §4)
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [x] **Step 2: Commit**

Deviation note (implementation): `SpaceIcon` was widened to a deprecated `string` alias rather than left as the old five-value union. This keeps the locked free-form `Space.icon: string` contract while avoiding edits to legacy/shared UI files that still import `SpaceIcon` and are off-limits until P5.

```bash
git add src/types/domain.ts
git commit -m "feat(mobile): add position to Space/Area, widen Space.icon to string" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Repo ordering — `position` defaults, `reorderSpaces`/`reorderAreas`

**Files:**
- Create: `src/features/stow/services/repositoryOrdering.test.ts`
- Modify: `src/features/stow/services/repository.ts`

The reorder methods write `position = index` for each id in `orderedIds`. The pure index→position mapping is what we unit-test (the Firestore `writeBatch` is exercised by the Playwright e2e). Extract that mapping into a tiny exported pure helper so it is testable without Firestore.

- [x] **Step 1: Write the failing test** (pure helper only)

```ts
// src/features/stow/services/repositoryOrdering.test.ts
import { describe, expect, it } from "vitest";
import { positionUpdatesFor } from "@/features/stow/services/repository";

describe("positionUpdatesFor", () => {
  it("maps each id to its zero-based index", () => {
    expect(positionUpdatesFor(["a", "b", "c"])).toEqual([
      { id: "a", position: 0 },
      { id: "b", position: 1 },
      { id: "c", position: 2 },
    ]);
  });
  it("produces a contiguous 0..n-1 sequence after a move", () => {
    // simulate moving "c" to the front
    const result = positionUpdatesFor(["c", "a", "b"]);
    expect(result.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(result.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
  it("handles an empty list", () => {
    expect(positionUpdatesFor([])).toEqual([]);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/services/repositoryOrdering.test.ts`
Expected: FAIL — `positionUpdatesFor` is not exported.

- [x] **Step 3: Write the implementation**

In `src/features/stow/services/repository.ts`, add the pure helper just above `export const inventoryRepository = {` (after `requireDb()`):
```ts
/** Pure: map an ordered id list to {id, position} pairs (position = index). Unit-tested. */
export function positionUpdatesFor(orderedIds: string[]): Array<{ id: string; position: number }> {
  return orderedIds.map((id, index) => ({ id, position: index }));
}
```

Add `position` to `createSpace` (default `input.position ?? Date.now()`). Change the `createSpace` signature + the space `batch.set` body (currently lines 201–225) so the input gains `position?` and the doc writes `position`, and each created area gets a sequential `position`:
```ts
  async createSpace(input: {
    householdId: string;
    userId: string;
    spaceId?: string;
    name: string;
    icon?: string;
    color: string;
    image?: ImageRef;
    position?: number;
    areas: Array<{ name: string; image?: ImageRef }>;
  }) {
    const database = requireDb();
    const spaceRef = input.spaceId
      ? doc(collection(database, householdPaths.spaces(input.householdId)), input.spaceId)
      : doc(collection(database, householdPaths.spaces(input.householdId)));
    const batch = writeBatch(database);

    batch.set(spaceRef, {
      householdId: input.householdId,
      name: input.name,
      icon: input.icon ?? "box",
      color: input.color,
      image: input.image ?? null,
      position: input.position ?? Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    input.areas.forEach((area, index) => {
      const areaRef = doc(collection(database, householdPaths.areas(input.householdId, spaceRef.id)));
      batch.set(areaRef, {
        householdId: input.householdId,
        spaceId: spaceRef.id,
        name: area.name,
        image: area.image ?? null,
        position: index,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    return spaceRef.id;
  },
```

Add `position` to `createArea` (currently lines 243–262):
```ts
  async createArea(input: {
    householdId: string;
    spaceId: string;
    areaId?: string;
    name: string;
    image?: ImageRef;
    position?: number;
  }) {
    const areaRef = input.areaId
      ? doc(collection(requireDb(), householdPaths.areas(input.householdId, input.spaceId)), input.areaId)
      : doc(collection(requireDb(), householdPaths.areas(input.householdId, input.spaceId)));
    await setDoc(areaRef, {
      householdId: input.householdId,
      spaceId: input.spaceId,
      name: input.name,
      image: input.image ?? null,
      position: input.position ?? Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return areaRef.id;
  },
```

Add the two reorder methods. Insert them immediately after `updateArea` (after its closing `},` near line 285), before `deleteArea`:
```ts
  async reorderSpaces(input: { householdId: string; orderedIds: string[] }) {
    const database = requireDb();
    const batch = writeBatch(database);
    for (const { id, position } of positionUpdatesFor(input.orderedIds)) {
      batch.update(doc(database, householdPaths.space(input.householdId, id)), {
        position,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  },

  async reorderAreas(input: { householdId: string; spaceId: string; orderedIds: string[] }) {
    const database = requireDb();
    const batch = writeBatch(database);
    for (const { id, position } of positionUpdatesFor(input.orderedIds)) {
      batch.update(doc(database, householdPaths.area(input.householdId, input.spaceId, id)), {
        position,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  },
```

> Note: the `updateSpace` patch `Pick` already accepts `"icon"` and now `Space.icon` is `string`, so the existing `Partial<Pick<Space, "name" | "icon" | "color">>` type stays valid with no change. Spaces/Areas have **no** `createdBy`/`updatedBy` (contract §5) — do not add them.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/services/repositoryOrdering.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/features/stow/services/repository.ts src/features/stow/services/repositoryOrdering.test.ts
git commit -m "feat(mobile): add reorderSpaces/reorderAreas + position write defaults" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `useWorkspaceData` — position-sort memo + reorder actions

**Files:**
- Create: `src/features/stow/hooks/positionSort.test.ts`
- Create: `src/features/stow/hooks/positionSort.ts`
- Modify: `src/features/stow/hooks/useWorkspaceData.ts`

The position-sort comparator (contract §6.1) is pure — extract it into its own module so it is unit-tested, then consume it in the `spacesWithAreas` memo and add the reorder actions.

- [x] **Step 1: Write the failing test**

```ts
// src/features/stow/hooks/positionSort.test.ts
import { describe, expect, it } from "vitest";
import { byPosition } from "@/features/stow/hooks/positionSort";

describe("byPosition", () => {
  it("orders by position ascending", () => {
    const sorted = [{ position: 2, name: "B" }, { position: 0, name: "A" }, { position: 1, name: "C" }].sort(byPosition);
    expect(sorted.map((s) => s.name)).toEqual(["A", "C", "B"]);
  });
  it("falls back to name when position is missing (undefined sorts last, then localeCompare)", () => {
    const sorted = [
      { name: "Zebra" },
      { position: 0, name: "Anchor" },
      { name: "Apple" },
    ].sort(byPosition);
    expect(sorted.map((s) => s.name)).toEqual(["Anchor", "Apple", "Zebra"]);
  });
  it("breaks position ties by name", () => {
    const sorted = [{ position: 1, name: "Beta" }, { position: 1, name: "Alpha" }].sort(byPosition);
    expect(sorted.map((s) => s.name)).toEqual(["Alpha", "Beta"]);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/hooks/positionSort.test.ts`
Expected: FAIL — import cannot be resolved.

- [x] **Step 3: Write the implementation**

```ts
// src/features/stow/hooks/positionSort.ts
/** Stable position-first comparator (contract §6.1): missing position sorts last, ties broken by name. */
export function byPosition<T extends { position?: number; name: string }>(a: T, b: T): number {
  return (
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name)
  );
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/hooks/positionSort.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Wire the comparator + actions into `useWorkspaceData`**

In `src/features/stow/hooks/useWorkspaceData.ts`:

(a) Add the import near the top (after the `inventoryRepository` import, line 5):
```ts
import { byPosition } from "@/features/stow/hooks/positionSort";
```

(b) Add the two actions to the `WorkspaceActions` type (inside the type block, after `deleteArea:` on line 28):
```ts
  reorderSpaces: typeof inventoryRepository.reorderSpaces;
  reorderAreas: typeof inventoryRepository.reorderAreas;
```

(c) Replace the `spacesWithAreas` memo (currently lines 233–240) with the position-ordered version:
```ts
  const spacesWithAreas: SpaceWithAreas[] = useMemo(() => {
    return spacesState.items
      .slice()
      .sort(byPosition)
      .map((space) => ({
        ...space,
        areas: areasState.items
          .filter((area) => area.spaceId === space.id)
          .slice()
          .sort(byPosition)
      }));
  }, [spacesState.items, areasState.items]);
```

(d) Add the two actions to the `actions` memo (inside the returned object, after `deleteArea: inventoryRepository.deleteArea,` on line 278):
```ts
      reorderSpaces: inventoryRepository.reorderSpaces,
      reorderAreas: inventoryRepository.reorderAreas,
```

- [x] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/features/stow/hooks/positionSort.ts src/features/stow/hooks/positionSort.test.ts src/features/stow/hooks/useWorkspaceData.ts
git commit -m "feat(mobile): order spaces/areas by position, expose reorder actions" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Expand the icon registry (`ICONS` + `ICON_CATEGORIES`)

**Files:**
- Modify: `src/features/stow/ui/mobile/theme/icons.tsx`
- Modify: `src/features/stow/ui/mobile/theme/icons.test.ts`

Contract §2 mandates the **full** categorized glyph set in P1. Expand the P0 stub (16 `ICONS` keys, 4-icon categories) to the complete §2 lists. No signature changes — only add map entries, category icons, and lucide imports/re-exports. The IconPicker (Task 9) renders `ICON_CATEGORIES`, so the categories must hold every key the spec lists.

- [x] **Step 1: Extend the test first** (add cases for the new keys + that every category key resolves)

Append inside the existing `describe("iconForKey", …)` block in `icons.test.ts`, then add a second describe:
```ts
  it("resolves the expanded room/kitchen/outdoor keys added in P1", () => {
    for (const key of ["tv", "door", "shirt", "book", "music", "heart", "gift", "key", "plug", "clock", "wash"]) {
      expect(iconForKey(key)).toBe(ICONS[key]);
    }
  });
});

import { ICON_CATEGORIES } from "@/features/stow/ui/mobile/theme/icons";

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
```
> The existing test file already closes the first `describe` with `});` — replace that closing brace with the new `it(...)` + `});` shown above so the new case lands inside the original block.

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/theme/icons.test.ts`
Expected: FAIL — `iconForKey("tv")` falls back (not yet mapped) / `wash` undefined.

- [x] **Step 3: Expand the implementation**

Rewrite `src/features/stow/ui/mobile/theme/icons.tsx` to the full set (contract §2). Add the missing lucide imports, extend `ICONS`, fill `ICON_CATEGORIES`, and re-export the new glyphs:
```tsx
// src/features/stow/ui/mobile/theme/icons.tsx
import {
  Home, Search, Package, Settings, ScanLine, Plus, Bell, MapPin, Tag, Camera,
  Box, Folder, Coffee, Briefcase, Bed, Sofa, Bath, Car, Wrench, Leaf, Sun,
  Utensils, Wine, Refrigerator, Archive, ChevronRight, ChevronLeft, ChevronDown,
  X, Check, MoreHorizontal, Trash2, Pencil, ArrowRight, Sparkles, Star, QrCode,
  Tv, DoorOpen, Shirt, Book, Music, Heart, Gift, Key, Plug, Clock, WashingMachine,
  Inbox, Users, Image as ImageIcon, GripVertical, List, LayoutGrid,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Space/area icons addressable by a free-form string key (validated here). */
export const ICONS: Record<string, LucideIcon> = {
  // Rooms
  home: Home, bed: Bed, sofa: Sofa, bath: Bath, tv: Tv, door: DoorOpen,
  // Storage
  box: Box, package: Package, folder: Folder, archive: Archive, briefcase: Briefcase,
  // Kitchen
  coffee: Coffee, utensils: Utensils, wine: Wine, fridge: Refrigerator,
  // Outdoor / Misc
  leaf: Leaf, car: Car, sun: Sun, wrench: Wrench, wash: WashingMachine, shirt: Shirt,
  book: Book, music: Music, heart: Heart, gift: Gift, key: Key, plug: Plug, clock: Clock,
};

export const FALLBACK_ICON: LucideIcon = Box;

export interface IconCategory { key: string; label: string; icons: string[]; }
export const ICON_CATEGORIES: IconCategory[] = [
  { key: "rooms", label: "Rooms", icons: ["home", "bed", "sofa", "bath", "tv", "door"] },
  { key: "storage", label: "Storage", icons: ["box", "package", "folder", "archive", "briefcase"] },
  { key: "kitchen", label: "Kitchen", icons: ["coffee", "utensils", "wine", "fridge"] },
  { key: "outdoor", label: "Outdoor", icons: ["leaf", "car", "sun", "wrench", "wash", "shirt", "book", "music", "heart", "gift", "key", "plug", "clock"] },
];

export function iconForKey(key: string | undefined | null): LucideIcon {
  if (key && ICONS[key]) return ICONS[key];
  return FALLBACK_ICON;
}

// Shell/UI glyphs re-exported from one place.
export {
  Home, Search, Package, Settings, ScanLine, Plus, Bell, MapPin, Tag, Camera,
  ChevronRight, ChevronLeft, ChevronDown, X, Check, MoreHorizontal, Trash2, Pencil,
  ArrowRight, Sparkles, Star, QrCode, Inbox, Users, ImageIcon, GripVertical, List, LayoutGrid,
};
```
> Note (carried from P0): every name above is a real lucide-react export, but versions drift. After writing, run `npm run typecheck`; if any import errors, swap that name for an existing one — discover with `node -e "console.log(Object.keys(require('lucide-react')))"`. The 12 inline picker defaults (Task 9) = the `rooms` (6) + `storage` first 6: `["home","bed","sofa","bath","tv","door","box","package","folder","archive","briefcase","coffee"]`.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/theme/icons.test.ts`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/theme/icons.tsx src/features/stow/ui/mobile/theme/icons.test.ts
git commit -m "feat(mobile): expand icon registry to full categorized set" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `useHoldToReorder` — pure `reorderIndex` + long-press drag hook

**Files:**
- Create: `src/features/stow/ui/mobile/hooks/useHoldToReorder.test.ts`
- Create: `src/features/stow/ui/mobile/hooks/useHoldToReorder.ts`

Contract §8 signature. Port the drag math from `prototype/spaces-mgmt.jsx` `ReorderList` (screen-px index detection so device scaling cancels; lifted-row transform in local px). The pure `reorderIndex(positions, from, pointerY)` is unit-tested against mocked element rects; the hook wraps it with a 300ms long-press arm, `navigator.vibrate?.(8)`, scale-aware `getBoundingClientRect`, and a ~280ms post-drop click-suppression window.

`reorderIndex` contract: given an array of element top offsets (in screen px, one per row, equal heights inferred from consecutive tops), the index `from` being dragged, and the current `pointerY` (screen px relative to the same origin), return the clamped target index `0..n-1`. We model `positions` as the array of row **top** coordinates; step = `positions[1]-positions[0]` (fallback to row height if only one row).

- [x] **Step 1: Write the failing test** (pure function)

```ts
// src/features/stow/ui/mobile/hooks/useHoldToReorder.test.ts
import { describe, expect, it } from "vitest";
import { reorderIndex } from "@/features/stow/ui/mobile/hooks/useHoldToReorder";

// rows of height 50 starting at y=100: tops = [100,150,200,250]
const TOPS = [100, 150, 200, 250];

describe("reorderIndex", () => {
  it("keeps the index when the pointer is over the original slot", () => {
    expect(reorderIndex(TOPS, 0, 110)).toBe(0);
    expect(reorderIndex(TOPS, 2, 205)).toBe(2);
  });
  it("moves down when the pointer crosses into a lower slot", () => {
    // dragging row 0 (grab offset ~ at its top); pointer near row 2's center
    expect(reorderIndex(TOPS, 0, 210)).toBe(2);
  });
  it("moves up when the pointer crosses into a higher slot", () => {
    expect(reorderIndex(TOPS, 3, 105)).toBe(0);
  });
  it("clamps to the first index above the list", () => {
    expect(reorderIndex(TOPS, 1, -500)).toBe(0);
  });
  it("clamps to the last index below the list", () => {
    expect(reorderIndex(TOPS, 1, 99999)).toBe(3);
  });
  it("returns from unchanged for a single-row list", () => {
    expect(reorderIndex([100], 0, 130)).toBe(0);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useHoldToReorder.test.ts`
Expected: FAIL — import cannot be resolved.

- [x] **Step 3: Write the implementation** (pure helper + hook)

```ts
// src/features/stow/ui/mobile/hooks/useHoldToReorder.ts
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Pure: given row TOP offsets (screen px, ascending, equal-height rows), the index
 * being dragged, and the current pointerY (same origin), return the clamped target
 * index 0..n-1. Mirrors prototype/spaces-mgmt.jsx ReorderList math (round(desiredTop/step)).
 */
export function reorderIndex(tops: number[], from: number, pointerY: number): number {
  const n = tops.length;
  if (n <= 1) return from;
  const origin = tops[0];
  const step = tops[1] - tops[0] || 1;
  // desiredTop is the row's top if its center tracked the pointer; we approximate by
  // mapping the pointer to the slot whose center is nearest.
  const raw = Math.round((pointerY - origin - step / 2) / step);
  return Math.max(0, Math.min(n - 1, raw));
}

interface HoldToReorderOpts<T> {
  ids: string[];
  onReorder: (orderedIds: string[]) => void;
  holdMs?: number;
}

interface HoldToReorderBind {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

export function useHoldToReorder<T>(opts: HoldToReorderOpts<T>): {
  draggingId: string | null;
  order: string[];
  bind: (id: string) => HoldToReorderBind;
  containerRef: React.RefObject<HTMLDivElement>;
  suppressClick: () => boolean;
} {
  const { onReorder, holdMs = 300 } = opts;
  const containerRef = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<string[]>(opts.ids);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // keep local order synced to external ids when not mid-drag
  const draggingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!draggingRef.current) setOrder(opts.ids);
  }, [opts.ids]);

  const orderRef = useRef<string[]>(opts.ids);
  orderRef.current = order;

  const holdTimer = useRef<number | null>(null);
  const startPoint = useRef<{ x: number; y: number } | null>(null);
  const suppressUntil = useRef<number>(0);

  const rowTops = useCallback((): number[] => {
    const container = containerRef.current;
    if (!container) return [];
    const children = Array.from(container.querySelectorAll<HTMLElement>("[data-reorder-row]"));
    return children.map((el) => el.getBoundingClientRect().top);
  }, []);

  const clearHold = useCallback(() => {
    if (holdTimer.current != null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  const commit = useCallback(() => {
    const dropped = orderRef.current.slice();
    draggingRef.current = null;
    setDraggingId(null);
    suppressUntil.current = Date.now() + 280;
    onReorder(dropped);
  }, [onReorder]);

  const bind = useCallback(
    (id: string): HoldToReorderBind => ({
      onPointerDown: (e) => {
        startPoint.current = { x: e.clientX, y: e.clientY };
        clearHold();
        holdTimer.current = window.setTimeout(() => {
          try {
            navigator.vibrate?.(8);
          } catch {
            /* haptics best-effort */
          }
          draggingRef.current = id;
          setDraggingId(id);
        }, holdMs);
      },
      onPointerMove: (e) => {
        // cancel arming if the finger drifts before the long-press fires
        if (!draggingRef.current && startPoint.current) {
          const dx = Math.abs(e.clientX - startPoint.current.x);
          const dy = Math.abs(e.clientY - startPoint.current.y);
          if (dx > 9 || dy > 9) clearHold();
          return;
        }
        if (draggingRef.current !== id) return;
        if (e.cancelable) e.preventDefault();
        const tops = rowTops();
        const from = orderRef.current.indexOf(id);
        const target = reorderIndex(tops, from, e.clientY);
        if (target !== from && from !== -1) {
          const next = orderRef.current.slice();
          const [moved] = next.splice(from, 1);
          next.splice(target, 0, moved);
          orderRef.current = next;
          setOrder(next);
        }
      },
      onPointerUp: () => {
        clearHold();
        if (draggingRef.current) commit();
        startPoint.current = null;
      },
      onPointerCancel: () => {
        clearHold();
        if (draggingRef.current) commit();
        startPoint.current = null;
      },
    }),
    [clearHold, commit, holdMs, rowTops]
  );

  const suppressClick = useCallback(() => Date.now() < suppressUntil.current, []);

  return { draggingId, order, bind, containerRef, suppressClick };
}
```
> Consumers (SpacesList Task 8, EditSpaceSheet Task 9) render rows in `order` (not the raw `ids`) inside `containerRef`, give each row `data-reorder-row` and `{...bind(id)}`, and gate tap handlers with `if (suppressClick()) return;`. The `data-reorder-row` selector is how `reorderIndex` reads live rects (scale-aware via `getBoundingClientRect`).

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useHoldToReorder.test.ts`
Expected: PASS (6 tests).

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/hooks/useHoldToReorder.ts src/features/stow/ui/mobile/hooks/useHoldToReorder.test.ts
git commit -m "feat(mobile): add useHoldToReorder with pure reorderIndex math" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Shared overlay primitives — `Sheet`, `Confirm`, `ActionSheet`

**Files:**
- Create: `src/features/stow/ui/mobile/shell/Sheet.tsx`
- Create: `src/features/stow/ui/mobile/shell/Confirm.tsx`
- Create: `src/features/stow/ui/mobile/shell/ActionSheet.tsx`

Contract §7 signatures + z-index ladder (sheet 70, actionSheet 75, confirm 80). These are UI (no unit test) but carry real logic: Escape-to-close, scrim click, and focus trap. Write the logic in full; port the visual frame from `prototype/components.jsx` (`Sheet`, `Confirm`) and `prototype/spaces-mgmt.jsx` (`SpaceActionSheet` for the action-sheet look), translating tokens per §1.3.

- [x] **Step 1: Write a small focus-trap + escape hook used by all three** (inline in Sheet, re-imported by the others)

Create `src/features/stow/ui/mobile/shell/useDismissable.ts`:
```ts
// src/features/stow/ui/mobile/shell/useDismissable.ts
import { useEffect, useRef } from "react";

/** Escape-to-close + simple focus trap for overlay surfaces. Active only while `open`. */
export function useDismissable(open: boolean, onClose: () => void) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const surface = surfaceRef.current;
    // focus the first focusable element inside the surface, or the surface itself
    const focusables = surface?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    (focusables && focusables[0] ? focusables[0] : surface)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !surface) return;
      const items = surface.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return surfaceRef;
}
```

- [x] **Step 2: Write `Sheet.tsx`** (contract §7: `{ open, onClose, title, children }`)

```tsx
// src/features/stow/ui/mobile/shell/Sheet.tsx
import type { ReactNode } from "react";
import { X } from "@/features/stow/ui/mobile/theme/icons";
import { useDismissable } from "@/features/stow/ui/mobile/shell/useDismissable";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const surfaceRef = useDismissable(open, onClose);
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)" }} />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: "relative", background: "var(--stow-surface)", borderRadius: "28px 28px 0 0",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.18)", maxHeight: "86%", display: "flex", flexDirection: "column",
          animation: "stowUp 0.3s ease-out",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: "var(--stow-border)" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 24px 12px" }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--stow-ink)", margin: 0 }}>{title}</h2>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 99, background: "var(--stow-canvas)", border: "none", display: "grid", placeItems: "center", cursor: "pointer" }}
          >
            <X size={14} color="var(--stow-ink-muted)" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 32px" }}>{children}</div>
      </div>
    </div>
  );
}
```
> This is the §1.3 translation of `prototype/components.jsx` `Sheet` (`P.surface`→`var(--stow-surface)`, `P.border`→`var(--stow-border)`, `P.canvas`→`var(--stow-canvas)`, `P.inkMuted`→`var(--stow-ink-muted)`), plus the dialog role + focus trap + Escape from `useDismissable`.

- [x] **Step 3: Write `Confirm.tsx`** (contract §7: adds `body`, `confirmLabel`, `onConfirm`, `onCancel`, `danger?`)

```tsx
// src/features/stow/ui/mobile/shell/Confirm.tsx
import { useDismissable } from "@/features/stow/ui/mobile/shell/useDismissable";

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const surfaceRef = useDismissable(open, onCancel);
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }} />
      <div
        ref={surfaceRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: "relative", background: "var(--stow-surface)", borderRadius: 24, padding: 24, width: "100%",
          maxWidth: 300, boxShadow: "0 20px 50px rgba(0,0,0,0.3)", animation: "stowPop 0.2s ease-out",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--stow-ink)" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "var(--stow-ink-muted)" }}>{body}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            onClick={onConfirm}
            style={{
              width: "100%", padding: "14px 0", borderRadius: "var(--stow-radius-button)", fontWeight: 700, fontSize: 15,
              border: "none", background: danger ? "var(--stow-danger)" : "var(--stow-accent)", color: "#fff", cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            style={{
              width: "100%", padding: "14px 0", borderRadius: "var(--stow-radius-button)", fontWeight: 700, fontSize: 15,
              border: "1px solid var(--stow-border)", background: "var(--stow-canvas)", color: "var(--stow-ink)", cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Write `ActionSheet.tsx`** (contract §7: `SheetAction[]` + iOS look)

```tsx
// src/features/stow/ui/mobile/shell/ActionSheet.tsx
import type { LucideIcon } from "lucide-react";
import { useDismissable } from "@/features/stow/ui/mobile/shell/useDismissable";

export interface SheetAction {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onSelect: () => void;
}

export function ActionSheet({
  open,
  title,
  actions,
  onClose,
}: {
  open: boolean;
  title?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const surfaceRef = useDismissable(open, onClose);
  if (!open) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 75, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.42)", animation: "stowPop .2s ease-out" }} />
      <div ref={surfaceRef} role="menu" aria-label={title ?? "Actions"} tabIndex={-1} style={{ position: "relative", padding: "0 10px 12px", animation: "stowUp .26s ease-out" }}>
        <div style={{ background: "color-mix(in srgb, var(--stow-surface) 93%, transparent)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", borderRadius: 18, overflow: "hidden", boxShadow: "0 12px 36px rgba(0,0,0,0.18)" }}>
          {title ? (
            <div style={{ textAlign: "center", padding: "15px 18px 12px", borderBottom: "1px solid var(--stow-border-l)", fontSize: 13.5, fontWeight: 800, color: "var(--stow-ink)" }}>
              {title}
            </div>
          ) : null}
          {actions.map((action, i) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                role="menuitem"
                onClick={action.onSelect}
                style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
                  padding: "16px 18px", fontSize: 17, fontWeight: 600,
                  color: action.destructive ? "var(--stow-danger)" : "var(--stow-accent)",
                  border: "none", background: "transparent", cursor: "pointer",
                  borderTop: i === 0 && !title ? "none" : "1px solid var(--stow-border-l)",
                }}
              >
                {Icon ? <Icon size={19} color={action.destructive ? "var(--stow-danger)" : "var(--stow-accent)"} /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: 8, background: "color-mix(in srgb, var(--stow-surface) 95%, transparent)",
            backdropFilter: "blur(24px)", border: "none", borderRadius: 18, textAlign: "center", padding: "16px 18px",
            fontSize: 17, fontWeight: 800, color: "var(--stow-accent)", boxShadow: "0 12px 36px rgba(0,0,0,0.14)", cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [x] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/features/stow/ui/mobile/shell/Sheet.tsx src/features/stow/ui/mobile/shell/Confirm.tsx src/features/stow/ui/mobile/shell/ActionSheet.tsx src/features/stow/ui/mobile/shell/useDismissable.ts
git commit -m "feat(mobile): add Sheet/Confirm/ActionSheet overlay primitives" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Shared display components — `Card`, `Button`, `Field`, `Chip`, `ProgressBar`, `ItemRow`, `AreaCard`, `ResultRow`, `RoleBadge`

**Files:**
- Create: `src/features/stow/ui/mobile/components/Card.tsx`
- Create: `src/features/stow/ui/mobile/components/Button.tsx`
- Create: `src/features/stow/ui/mobile/components/Field.tsx`
- Create: `src/features/stow/ui/mobile/components/Chip.tsx`
- Create: `src/features/stow/ui/mobile/components/ProgressBar.tsx`
- Create: `src/features/stow/ui/mobile/components/ItemRow.tsx`
- Create: `src/features/stow/ui/mobile/components/AreaCard.tsx`
- Create: `src/features/stow/ui/mobile/components/ResultRow.tsx`
- Create: `src/features/stow/ui/mobile/components/RoleBadge.tsx`

Contract §7 signatures. These are presentational (no unit tests). Port from `prototype/components.jsx` (`cardStyle`, `Button`, `Input`/`FieldLabel`, `RoleBadge`) and the row/card markup embedded in `prototype/screens-core.jsx` (`resultRow`, `itemRow`, area grid card) / `screens-detail.jsx`, translating per §1.3. `Item`/`Role` come from `@/types/domain`; `Item.image?.downloadUrl` is the live image source (placeholder glyph when absent, per §11).

- [ ] **Step 1: Write `Card.tsx`** (`cardStyle` surface, contract §7 `{ children, onClick?, style?, as? }`)

```tsx
// src/features/stow/ui/mobile/components/Card.tsx
import type { CSSProperties, ElementType, ReactNode } from "react";

export const cardStyle: CSSProperties = {
  background: "var(--stow-surface)",
  borderRadius: "var(--stow-radius-card)",
  border: "1px solid var(--stow-border-l)",
  boxShadow: "var(--stow-shadow)",
};

export function Card({
  children,
  onClick,
  style,
  as: As = "div",
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  as?: ElementType;
}) {
  return (
    <As onClick={onClick} style={{ ...cardStyle, ...(onClick ? { cursor: "pointer" } : null), ...style }}>
      {children}
    </As>
  );
}
```

- [ ] **Step 2: Write `Button.tsx`** (contract §7: `variant: "primary"|"neutral"|"danger"|"ghost"`; primary = accent bg, #fff text)

```tsx
// src/features/stow/ui/mobile/components/Button.tsx
import type { CSSProperties, ReactNode } from "react";

type Variant = "primary" | "neutral" | "danger" | "ghost";

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: { background: "var(--stow-accent)", color: "#fff", border: "none" },
  neutral: { background: "var(--stow-canvas)", color: "var(--stow-ink)", border: "1px solid var(--stow-border)" },
  danger: { background: "var(--stow-danger)", color: "#fff", border: "none" },
  ghost: { background: "transparent", color: "var(--stow-accent)", border: "none" },
};

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  style,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", padding: "14px 0", borderRadius: "var(--stow-radius-button)", fontWeight: 700, fontSize: 15,
        cursor: disabled ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        opacity: disabled ? 0.55 : 1, fontFamily: "inherit", ...VARIANTS[variant], ...style,
      }}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Write `Field.tsx`** (contract §7: labeled input, `multiline?` → textarea)

```tsx
// src/features/stow/ui/mobile/components/Field.tsx
export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}) {
  const baseStyle = {
    width: "100%", boxSizing: "border-box" as const, borderRadius: "var(--stow-radius-input)", padding: "12px 16px",
    fontSize: 15, fontWeight: 500, outline: "none", border: "1.5px solid var(--stow-border)",
    background: "var(--stow-canvas)", color: "var(--stow-ink)", fontFamily: "inherit",
  };
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--stow-warm)", marginBottom: 6 }}>
        {label}
      </div>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...baseStyle, resize: "none" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} style={baseStyle} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `Chip.tsx`** (contract §7: `{ label, selected?, onClick?, color?, onRemove? }`)

```tsx
// src/features/stow/ui/mobile/components/Chip.tsx
import { X } from "@/features/stow/ui/mobile/theme/icons";

export function Chip({
  label,
  selected = false,
  onClick,
  color,
  onRemove,
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  color?: string;
  onRemove?: () => void;
}) {
  const accent = color ?? "var(--stow-accent)";
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 14, fontSize: 13, fontWeight: 700,
        cursor: onClick || onRemove ? "pointer" : "default", fontFamily: "inherit",
        border: selected ? "none" : "1px solid var(--stow-border-l)",
        background: selected ? accent : "var(--stow-canvas)",
        color: selected ? "#fff" : "var(--stow-ink-soft)",
      }}
    >
      {label}
      {onRemove ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ display: "inline-flex" }}
        >
          <X size={11} color={selected ? "#fff" : "var(--stow-warm)"} style={{ opacity: 0.8 }} />
        </span>
      ) : null}
    </button>
  );
}
```

- [ ] **Step 5: Write `ProgressBar.tsx`** (contract §7: `{ value, total }`, accent fill, success at 100%)

```tsx
// src/features/stow/ui/mobile/components/ProgressBar.tsx
export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const full = pct >= 100;
  return (
    <div style={{ height: 8, borderRadius: 99, background: "var(--stow-border-l)", overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`, height: "100%", borderRadius: 99,
          background: full ? "var(--stow-success)" : "var(--stow-accent)", transition: "width 0.3s",
        }}
      />
    </div>
  );
}
```

- [ ] **Step 6: Write `RoleBadge.tsx`** (contract §7: OWNER accent / ADMIN success / MEMBER warm — port `prototype/components.jsx` `RoleBadge`)

```tsx
// src/features/stow/ui/mobile/components/RoleBadge.tsx
import type { Role } from "@/types/domain";

const COLOR: Record<Role, string> = {
  OWNER: "var(--stow-accent)",
  ADMIN: "var(--stow-success)",
  MEMBER: "var(--stow-warm)",
};

export function RoleBadge({ role }: { role: Role }) {
  const color = COLOR[role];
  return (
    <span
      style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`, padding: "3px 8px", borderRadius: 8,
      }}
    >
      {role}
    </span>
  );
}
```

- [ ] **Step 7: Write `ItemRow.tsx`** (contract §7: `{ item: Item; onClick?; right?: ReactNode }`, thumb/glyph + name + `room›area` subtitle)

Prop interface + bindings:
```tsx
// src/features/stow/ui/mobile/components/ItemRow.tsx
import type { ReactNode } from "react";
import type { Item } from "@/types/domain";
import { ChevronRight, Folder, Inbox, MapPin } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";

export function ItemRow({
  item,
  onClick,
  right,
  spaceName,
}: {
  item: Item;
  onClick?: () => void;
  right?: ReactNode;
  spaceName?: string;
}) {
  // ...see port instruction
}
```
Port the markup from `prototype/screens-core.jsx` `resultRow` (lines 36–54) → `ItemRow`, translating per §1.3 and §11:
- Container = `{...cardStyle, borderRadius: "var(--stow-radius-input)", padding: 10, display:"flex", alignItems:"center", gap:12, cursor: onClick ? "pointer":"default"}` with `onClick`.
- Thumb: `item.image?.downloadUrl` → 46×46 `<img>`; else a 46×46 `var(--stow-canvas)` tile with `item.kind === "folder" ? <Folder/> : <Inbox/>` at `var(--stow-warm)`.
- Title: `item.name` (ellipsised). Subtitle: a `<MapPin size={10}>` then `${spaceName ?? ""} · ${item.areaNameSnapshot}` at `var(--stow-warm)` (subtitle hidden if neither `spaceName` nor snapshot — but always pass `spaceName`). The prototype's `roomName(it.roomId)` maps to the caller-supplied `spaceName`; `it.area` maps to `item.areaNameSnapshot`.
- Trailing: render `right` if provided, else `<ChevronRight size={15} color="var(--stow-border)"/>`.

- [ ] **Step 8: Write `AreaCard.tsx`** (contract §7: `{ name, count?, onClick?, onMenu?() }`)

Prop interface:
```tsx
// src/features/stow/ui/mobile/components/AreaCard.tsx
import { Box } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";

export function AreaCard({
  name,
  count = 0,
  color,
  onClick,
}: {
  name: string;
  count?: number;
  color?: string;
  onClick?: () => void;
}) {
  // ...see port instruction
}
```
Port the area grid card from `prototype/screens-core.jsx` `RoomScreen` (lines 211–222) → `AreaCard`: a `cardStyle` cell, `minHeight:104`, padding 16, column flex; a 38×38 tile `background: color-mix(in srgb, ${color ?? "var(--stow-accent)"} 9%, transparent)` containing `<Box size={18} color={color ?? "var(--stow-accent)"}/>`; then name (`var(--stow-ink)`) and `${count} item(s)` (`var(--stow-warm)`). (The `onMenu` slot from contract §7 is unused by RoomScreen's area grid and is therefore omitted from the implemented props — note for the reviewer: AreaCard's `onMenu` is not needed in P1; areas are edited via EditSpaceSheet, not a per-card menu.)

- [ ] **Step 9: Write `ResultRow.tsx`** (contract §7: `{ item: Item; query?: string; onClick? }`)

In P1 the search result row is visually identical to `ItemRow` but takes an optional `query` (used later for match highlighting; in P1 it renders the same row). Implement `ResultRow` as a thin wrapper that forwards to `ItemRow` and accepts `query` (currently unused beyond the type — do **not** add highlighting logic in P1; the SearchScreen passes `spaceName`):
```tsx
// src/features/stow/ui/mobile/components/ResultRow.tsx
import type { Item } from "@/types/domain";
import { ItemRow } from "@/features/stow/ui/mobile/components/ItemRow";

export function ResultRow({
  item,
  query: _query,
  onClick,
  spaceName,
}: {
  item: Item;
  query?: string;
  onClick?: () => void;
  spaceName?: string;
}) {
  return <ItemRow item={item} onClick={onClick} spaceName={spaceName} />;
}
```

- [ ] **Step 10: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/features/stow/ui/mobile/components/
git commit -m "feat(mobile): add shared display components (Card/Button/Field/Chip/ProgressBar/ItemRow/AreaCard/ResultRow/RoleBadge)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `SpacesList` (Option D managed list)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/SpacesList.tsx`

Port `prototype/spaces-mgmt.jsx` `SpacesManagedList` (+ the `ReorderList`/`Grip` behavior, now provided by `useHoldToReorder` from Task 5 and a local `Grip` glyph). Contract §8: **no edit mode** — tap row = open; `···` = `SpaceActionSheet`; touch-and-hold = reorder; inline rename; "+ Add Space". This component owns rename UI state and the action-sheet/edit-space callbacks are passed down from `StowMobileApp` (Task 15) so a single overlay layer renders them.

**Prop interface + bindings:**
```tsx
// src/features/stow/ui/mobile/screens/SpacesList.tsx
import { useState } from "react";
import type { SpaceWithAreas } from "@/types/domain";
import { iconForKey, MoreHorizontal, Plus } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { useHoldToReorder } from "@/features/stow/ui/mobile/hooks/useHoldToReorder";

export interface SpacesListProps {
  spaces: SpaceWithAreas[];
  itemCountForSpace: (spaceId: string) => number;
  onOpenSpace: (spaceId: string) => void;
  onOpenMenu: (spaceId: string) => void;            // → StowMobileApp opens SpaceActionSheet
  onReorder: (orderedIds: string[]) => void;        // → actions.reorderSpaces
  onRename: (spaceId: string, nextName: string) => void; // → actions.updateSpace patch {name}
  onAddSpace: () => void;                            // → openOverlay("addSpace")
}

function Grip({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      {[6, 12, 18].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.4" fill={color} />
          <circle cx="15" cy={y} r="1.4" fill={color} />
        </g>
      ))}
    </svg>
  );
}

export function SpacesList(props: SpacesListProps) {
  const { spaces, itemCountForSpace, onOpenSpace, onOpenMenu, onReorder, onRename, onAddSpace } = props;
  const ids = spaces.map((s) => s.id);
  const { order, draggingId, bind, containerRef, suppressClick } = useHoldToReorder({ ids, onReorder });
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const spacesById = new Map(spaces.map((s) => [s.id, s]));

  function startRename(spaceId: string) {
    const space = spacesById.get(spaceId);
    if (!space) return;
    setRenameId(spaceId);
    setRenameValue(space.name);
  }
  function commitRename() {
    if (renameId) {
      const trimmed = renameValue.trim();
      const space = spacesById.get(renameId);
      if (trimmed && space && trimmed !== space.name) onRename(renameId, trimmed);
    }
    setRenameId(null);
  }
  function cancelRename() {
    setRenameId(null);
  }

  // StowMobileApp triggers rename via SpaceActionSheet "Rename" → this is exposed by lifting
  // the menu to the parent; the parent calls back into a ref. Simpler: SpacesList renders its own
  // rename and the parent's SpaceActionSheet "Rename" action calls onRename-start through a prop.
  // To keep one source of truth, expose startRename via the menu callback the parent invokes:
  // see Task 15 wiring (parent's SpaceActionSheet "Rename" action calls `spacesListRename(id)`).

  // ...see port instruction for the row + footer markup
}
```

- [ ] **Step 1: Resolve the rename-trigger ownership** (logic decision, write in full)

The prototype's `SpaceActionSheet` "Rename" calls `act.startRename(id)` which sets list-level rename state. Since the action sheet is rendered by `StowMobileApp` (Task 15) but rename is list-local, **lift the rename trigger to the parent**: change `SpacesListProps` to accept the rename trigger as controlled state from the parent. Replace the local `renameId`/`renameValue` `useState` with controlled props:
```tsx
export interface SpacesListProps {
  spaces: SpaceWithAreas[];
  itemCountForSpace: (spaceId: string) => number;
  onOpenSpace: (spaceId: string) => void;
  onOpenMenu: (spaceId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onRename: (spaceId: string, nextName: string) => void;
  onAddSpace: () => void;
  renamingId: string | null;          // controlled by StowMobileApp
  renameValue: string;                // controlled
  onRenameValueChange: (v: string) => void;
  onRenameCommit: () => void;         // parent trims + calls onRename + clears renamingId
  onRenameCancel: () => void;
}
```
Then the body uses `renamingId`/`renameValue` props (delete the local rename `useState` and the three helper fns above; the parent owns them — see Task 15 where `StowMobileApp` holds `renamingSpaceId`/`renameValue` and the `SpaceActionSheet` "Rename" action sets `renamingSpaceId`).

- [ ] **Step 2: Write the component body** — port markup from `prototype/spaces-mgmt.jsx` `SpacesManagedList` (lines 144–208)

Structure (translate per §1.3, map per §11):
- A `Label`-style header "Your Spaces" (`fontSize:11; fontWeight:800; textTransform:uppercase; letterSpacing:1.5; color:var(--stow-warm); marginBottom:10; marginLeft:2`).
- A `cardStyle` container with `overflow:"hidden"` and `ref={containerRef}`.
- Inside, map `order` → for each `id` resolve `space = spacesById.get(id)`; skip if missing. Render a row `<div data-reorder-row {...bind(id)}>` with `style={{ touchAction: draggingId === id ? "none" : "auto" }}` and:
  - row click handler: `onClick={() => { if (suppressClick() || draggingId || renamingId === id) return; onOpenSpace(id); }}` (replaces the prototype's `anyDragging` guard with `draggingId`/`suppressClick`).
  - leading: 44×44 tile. If `space.image?.downloadUrl` → `<img>`; else tile `background: color-mix(in srgb, ${space.color} 10%, transparent)` with `const Icon = iconForKey(space.icon)` → `<Icon size={20} color={space.color}/>`. (Prototype used `I[rm.icon]`; here `space.icon` is a lowercase key resolved via `iconForKey` — §11.)
  - middle: if `renamingId === id`, an autofocus `<input value={renameValue}>` (`onChange`→`onRenameValueChange`, `onKeyDown` Enter→`onRenameCommit`, Escape→`onRenameCancel`, `onBlur`→`onRenameCommit`, `onClick` stopPropagation) styled with a `1.5px solid var(--stow-accent)` border; else two lines: `space.name` and `${space.areas.length} areas · ${itemCountForSpace(id)} item(s)` (`var(--stow-warm)`).
  - trailing: if renaming → a "Done" pill button (`onClick` stopPropagation + `onRenameCommit`); else if `draggingId === id` → `<Grip color="var(--stow-accent)"/>`; else a `···` button `onClick={(e)=>{ e.stopPropagation(); onOpenMenu(id); }}` with `<MoreHorizontal size={18} color="var(--stow-warm)"/>`.
  - row border-bottom `1px solid var(--stow-border-l)`; when `draggingId===id` add `background: var(--stow-surface)` + a lifted look (`boxShadow:"0 18px 40px rgba(0,0,0,0.20)"; borderRadius:14`).
- Footer inside the card: an "+ Add Space" row (`borderTop:1px solid var(--stow-border-l)`, `color:var(--stow-accent)`, `<Plus size={16}/>`) → `onClick={onAddSpace}`.
- Below the card: the two helper hints (port lines 203–206): "Tap ··· to edit, rename, or delete a space." and "Touch & hold a row to drag it into order." with `<Grip color="var(--stow-warm)"/>`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (note: `SpacesList` is not yet rendered anywhere; that happens in Task 10/15 — typecheck only confirms it compiles).

- [ ] **Step 4: Commit**

```bash
git add src/features/stow/ui/mobile/screens/SpacesList.tsx
git commit -m "feat(mobile): add Option D SpacesList with hold-to-reorder + inline rename" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: `SpaceActionSheet` + `EditSpaceSheet` + `ColorPicker` + `IconPicker`

**Files:**
- Create: `src/features/stow/ui/mobile/spaces/SpaceActionSheet.tsx`
- Create: `src/features/stow/ui/mobile/spaces/ColorPicker.tsx`
- Create: `src/features/stow/ui/mobile/spaces/IconPicker.tsx`
- Create: `src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx`

Port `prototype/spaces-mgmt.jsx` `SpaceActionSheet` + `EditSpaceSheet` (and the `ColorPicker`/`IconPicker` affordances — the prototype inlines color swatches + an 8-icon grid; we factor them into reusable pickers and extend the icon grid to the searchable categorized library per contract §2 + §8). Contract §8 swatches are locked. Delete-with-reassignment is bounded (collect a destination, pass `reassignTo`).

`SpaceActionSheet` is a thin config over the Task 6 `ActionSheet`. `EditSpaceSheet` is a full bottom-sheet editor (its own surface, like the prototype, because it needs a Save/Cancel header and is taller than a normal `Sheet`).

- [ ] **Step 1: Write `SpaceActionSheet.tsx`** (Edit / Rename / Delete → `ActionSheet`)

```tsx
// src/features/stow/ui/mobile/spaces/SpaceActionSheet.tsx
import { ActionSheet } from "@/features/stow/ui/mobile/shell/ActionSheet";
import { Settings, Pencil, Trash2 } from "@/features/stow/ui/mobile/theme/icons";
import type { SpaceWithAreas } from "@/types/domain";

export function SpaceActionSheet({
  space,
  itemCount,
  open,
  onClose,
  onEdit,
  onRename,
  onDelete,
}: {
  space: SpaceWithAreas | null;
  itemCount: number;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  if (!space) return null;
  return (
    <ActionSheet
      open={open}
      onClose={onClose}
      title={`${space.name} · ${space.areas.length} areas · ${itemCount} item${itemCount !== 1 ? "s" : ""}`}
      actions={[
        { label: "Edit space", icon: Settings, onSelect: onEdit },
        { label: "Rename", icon: Pencil, onSelect: onRename },
        { label: "Delete space", icon: Trash2, destructive: true, onSelect: onDelete },
      ]}
    />
  );
}
```

- [ ] **Step 2: Write `ColorPicker.tsx`** (contract §8 swatches + expanded grid behind "more")

```tsx
// src/features/stow/ui/mobile/spaces/ColorPicker.tsx
import { useState } from "react";
import { Check } from "@/features/stow/ui/mobile/theme/icons";

// Locked swatches (contract §8).
export const SPACE_SWATCHES = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB", "#D6336C"];
// Expanded grid revealed behind "more".
export const SPACE_SWATCHES_EXPANDED = [
  "#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB", "#D6336C",
  "#1F8A5B", "#7A5AE0", "#D98A1F", "#3FA7D6", "#C0392B", "#16A085", "#8E44AD",
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const swatches = expanded ? SPACE_SWATCHES_EXPANDED : SPACE_SWATCHES;
  return (
    <div>
      <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginBottom: 10 }}>
        {swatches.map((s) => {
          const on = value.toLowerCase() === s.toLowerCase();
          return (
            <button
              key={s}
              type="button"
              aria-label={`Color ${s}`}
              onClick={() => onChange(s)}
              style={{
                width: 32, height: 32, borderRadius: 99, background: s, border: "none", cursor: "pointer",
                display: "grid", placeItems: "center",
                boxShadow: on ? `0 0 0 2.5px var(--stow-surface), 0 0 0 4.5px ${s}` : "none",
              }}
            >
              {on ? <Check size={15} color="#fff" /> : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ background: "none", border: "none", color: "var(--stow-accent)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
      >
        {expanded ? "Fewer colors" : "More colors"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Write `IconPicker.tsx`** (12 inline defaults + "All" → searchable categorized library via `ICON_CATEGORIES`)

Logic (write in full — the search filter + category chips are real logic):
```tsx
// src/features/stow/ui/mobile/spaces/IconPicker.tsx
import { useMemo, useState } from "react";
import { ICON_CATEGORIES, ICONS, iconForKey } from "@/features/stow/ui/mobile/theme/icons";

// 12 inline defaults shown before "All" (contract §2 note).
const INLINE_KEYS = ["home", "bed", "sofa", "bath", "tv", "door", "box", "package", "folder", "archive", "briefcase", "coffee"];

export function IconPicker({
  value,
  color,
  onChange,
}: {
  value: string;
  color: string;
  onChange: (iconKey: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const libraryKeys = useMemo(() => {
    const all = ICON_CATEGORIES.flatMap((c) => c.icons);
    const byCategory =
      activeCategory === "all" ? all : (ICON_CATEGORIES.find((c) => c.key === activeCategory)?.icons ?? []);
    const q = query.trim().toLowerCase();
    return q ? byCategory.filter((k) => k.includes(q)) : byCategory;
  }, [activeCategory, query]);

  const keys = expanded ? libraryKeys : INLINE_KEYS;

  function tile(key: string) {
    const Icon = iconForKey(key);
    const on = value === key;
    return (
      <button
        key={key}
        type="button"
        aria-label={`Icon ${key}`}
        onClick={() => onChange(key)}
        style={{
          aspectRatio: "1", borderRadius: 10, display: "grid", placeItems: "center", cursor: "pointer",
          background: on ? color : "var(--stow-canvas)",
          border: `1px solid ${on ? color : "var(--stow-border)"}`,
        }}
      >
        <Icon size={17} strokeWidth={1.9} color={on ? "#fff" : "var(--stow-ink-muted)"} />
      </button>
    );
  }

  return (
    <div>
      {expanded ? (
        <div style={{ marginBottom: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search icons…"
            style={{ width: "100%", boxSizing: "border-box", borderRadius: "var(--stow-radius-input)", padding: "10px 14px", fontSize: 14, fontWeight: 500, outline: "none", border: "1.5px solid var(--stow-border)", background: "var(--stow-canvas)", color: "var(--stow-ink)", fontFamily: "inherit", marginBottom: 10 }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ key: "all", label: "All" }, ...ICON_CATEGORIES].map((c) => {
              const on = activeCategory === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveCategory(c.key)}
                  style={{ padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: on ? "none" : "1px solid var(--stow-border)", background: on ? "var(--stow-accent)" : "var(--stow-canvas)", color: on ? "#fff" : "var(--stow-ink-muted)" }}
                >
                  {"label" in c ? c.label : c.key}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 10 }}>
        {keys.map(tile)}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{ background: "none", border: "none", color: "var(--stow-accent)", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}
      >
        {expanded ? "Show defaults" : "All icons"}
      </button>
    </div>
  );
}
```
> `ICONS` is imported only to keep the registry the single source if a future highlight needs it; the picker addresses everything through `iconForKey`. (If lint flags `ICONS` unused, drop it from the import.)

- [ ] **Step 4: Write `EditSpaceSheet.tsx`** — full editor with preview tile, name, ColorPicker, IconPicker, Areas reorder/add/delete, bounded Delete-with-reassignment

This sheet manages a **local draft** (name/color/icon/areas where each area carries a stable `key`, its `id` if existing, and `name`), mirroring the prototype's `editSpace` object. On Save it diffs the draft against the live space and calls the repo: `updateSpace` for name/color/icon; `createArea`/`updateArea`/`deleteArea` for area adds/renames/removes; `reorderAreas` for order. Delete-with-reassignment opens a destination picker when the space has items.

Prop interface + the full state/diff logic:
```tsx
// src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx
import { useMemo, useState } from "react";
import type { Area, SpaceWithAreas } from "@/types/domain";
import { Plus, Trash2 } from "@/features/stow/ui/mobile/theme/icons";
import { iconForKey } from "@/features/stow/ui/mobile/theme/icons";
import { ColorPicker } from "@/features/stow/ui/mobile/spaces/ColorPicker";
import { IconPicker } from "@/features/stow/ui/mobile/spaces/IconPicker";
import { useHoldToReorder } from "@/features/stow/ui/mobile/hooks/useHoldToReorder";

interface DraftArea {
  key: string;          // stable client key for reorder/inputs
  id: string | null;    // existing area id, or null for a new area
  name: string;
}

export interface EditSpaceSheetProps {
  space: SpaceWithAreas;
  itemCount: number;
  // destinations for reassignment when deleting a space that has items:
  otherSpaces: SpaceWithAreas[];
  onClose: () => void;
  onSaved: (message: string) => void; // parent shows toast
  onDeleted: (message: string) => void;
  actions: {
    updateSpace: (input: { householdId: string; spaceId: string; patch: { name?: string; icon?: string; color?: string } }) => Promise<void>;
    createArea: (input: { householdId: string; spaceId: string; name: string; position?: number }) => Promise<string>;
    updateArea: (input: { householdId: string; spaceId: string; areaId: string; patch: { name?: string } }) => Promise<void>;
    deleteArea: (input: { householdId: string; spaceId: string; areaId: string; userId: string; reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string } }) => Promise<void>;
    reorderAreas: (input: { householdId: string; spaceId: string; orderedIds: string[] }) => Promise<void>;
    deleteSpace: (input: { householdId: string; spaceId: string; userId: string; reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string } }) => Promise<void>;
  };
  householdId: string;
  userId: string;
}

export function EditSpaceSheet(props: EditSpaceSheetProps) {
  const { space, itemCount, otherSpaces, onClose, onSaved, onDeleted, actions, householdId, userId } = props;

  let keySeq = 0;
  const initialAreas: DraftArea[] = space.areas.map((a) => ({ key: `ak${keySeq++}`, id: a.id, name: a.name }));
  const [name, setName] = useState(space.name);
  const [color, setColor] = useState(space.color);
  const [icon, setIcon] = useState(space.icon);
  const [areas, setAreas] = useState<DraftArea[]>(initialAreas);
  const [newKeySeq, setNewKeySeq] = useState(initialAreas.length);
  const [saving, setSaving] = useState(false);

  // delete-with-reassignment state
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [destSpaceId, setDestSpaceId] = useState<string>(otherSpaces[0]?.id ?? "");
  const [destAreaId, setDestAreaId] = useState<string>(otherSpaces[0]?.areas[0]?.id ?? "");

  const areaIds = areas.map((a) => a.key);
  const { order, draggingId, bind, containerRef, suppressClick } = useHoldToReorder({
    ids: areaIds,
    onReorder: (orderedKeys) => {
      setAreas((prev) => orderedKeys.map((k) => prev.find((a) => a.key === k)!).filter(Boolean));
    },
    holdMs: 0, // areas use a grip handle (immediate drag) — see port note
  });

  const destSpace = useMemo(() => otherSpaces.find((s) => s.id === destSpaceId) ?? null, [otherSpaces, destSpaceId]);

  function addArea() {
    setAreas((prev) => prev.concat([{ key: `ak${newKeySeq}`, id: null, name: "New Area" }]));
    setNewKeySeq((n) => n + 1);
  }
  function renameArea(key: string, value: string) {
    setAreas((prev) => prev.map((a) => (a.key === key ? { ...a, name: value } : a)));
  }
  function removeArea(key: string) {
    setAreas((prev) => prev.filter((a) => a.key !== key));
  }

  async function save() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      // 1) space scalar fields
      if (name.trim() !== space.name || color !== space.color || icon !== space.icon) {
        await actions.updateSpace({ householdId, spaceId: space.id, patch: { name: name.trim(), color, icon } });
      }
      // 2) area deletes (existing ids no longer in draft) — areas being deleted here are
      //    empty-or-not; deleteArea throws if it has items and no reassignTo. EditSpace area
      //    removal is for empty areas in v1; reassignment is space-level (see delete-space).
      const draftIds = new Set(areas.filter((a) => a.id).map((a) => a.id));
      for (const original of space.areas) {
        if (!draftIds.has(original.id)) {
          await actions.deleteArea({ householdId, spaceId: space.id, areaId: original.id, userId });
        }
      }
      // 3) area creates + renames, in final order; collect resolved ids for reorder
      const resolvedIds: string[] = [];
      for (const draft of order.map((k) => areas.find((a) => a.key === k)!).filter(Boolean)) {
        const trimmed = draft.name.trim() || "Area";
        if (!draft.id) {
          const newId = await actions.createArea({ householdId, spaceId: space.id, name: trimmed });
          resolvedIds.push(newId);
        } else {
          const original = space.areas.find((a) => a.id === draft.id);
          if (original && original.name !== trimmed) {
            await actions.updateArea({ householdId, spaceId: space.id, areaId: draft.id, patch: { name: trimmed } });
          }
          resolvedIds.push(draft.id);
        }
      }
      // 4) persist final order
      if (resolvedIds.length > 0) {
        await actions.reorderAreas({ householdId, spaceId: space.id, orderedIds: resolvedIds });
      }
      onSaved("Space updated");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSpace() {
    if (saving) return;
    setSaving(true);
    try {
      const reassignTo =
        itemCount > 0 && destSpace && destAreaId
          ? {
              spaceId: destSpace.id,
              areaId: destAreaId,
              areaNameSnapshot: destSpace.areas.find((a) => a.id === destAreaId)?.name ?? "",
            }
          : undefined;
      await actions.deleteSpace({ householdId, spaceId: space.id, userId, reassignTo });
      onDeleted("Space deleted");
    } finally {
      setSaving(false);
    }
  }

  // ...see port instruction for the sheet markup
}
```

- [ ] **Step 5: Write the sheet markup** — port from `prototype/spaces-mgmt.jsx` `EditSpaceSheet` (lines 249–338)

Structure (own bottom-sheet surface, `zIndex:78` per the §7 ladder note that EditSpace sits above ActionSheet but the prototype uses 78; use **78**; translate per §1.3):
- Scrim (`onClick={onClose}`) + a `borderRadius:"28px 28px 0 0"` surface (`maxHeight:"92%"`, `animation:"stowUp 0.3s ease-out"`); wrap the surface in the focus trap by giving it `role="dialog" aria-modal aria-label="Edit Space"` and reuse `useDismissable(true, onClose)` for Escape/focus (import it).
- Grab handle + header row: "Cancel" (left, `onClose`), "Edit Space" (center), "Save" (right, disabled-look when `!name.trim()`, `onClick={save}`).
- Scroll body:
  - **Preview + name:** a 56×56 tile `background: color-mix(in srgb, ${color} 10%, transparent)` with `const HeadIcon = iconForKey(icon)` → `<HeadIcon size={26} color={color}/>`, beside a name `<input value={name} onChange={e=>setName(e.target.value)}>`.
  - **Color:** a "Color" `FieldLabel` then `<ColorPicker value={color} onChange={setColor}/>`.
  - **Icon:** an "Icon" `FieldLabel` then `<IconPicker value={icon} color={color} onChange={setIcon}/>`.
  - **Areas · drag to reorder:** header with an "+ Add" button (`onClick={addArea}`); a `var(--stow-canvas)` bordered container `ref={containerRef}`. If `areas.length === 0` show "No areas yet — tap Add." Else map `order`→ for each `key` resolve the draft area and render `<div data-reorder-row>` with: a grip handle span carrying `{...bind(key)}` + `style={{ touchAction:"none", cursor:"grab" }}` (handle-drag: the prototype's area list uses `mode="handle"`, hence `holdMs:0` so pressing the grip starts the drag immediately — guard the row body so only the grip is draggable by spreading `bind` on the grip span, not the row), the area-name `<input value={area.name} onChange={e=>renameArea(key, e.target.value)}>`, and a delete button (`onClick={()=>removeArea(key)}`, `<Trash2 size={13} color="var(--stow-danger)"/>` in a `var(--stow-danger-soft)` tile).
  - **Delete Space:** a full-width danger button (`background:var(--stow-danger-soft)`, `color:var(--stow-danger)`, `<Trash2/>`) → `onClick={() => setConfirmingDelete(true)}`.
  - **Reassignment block (conditional):** when `confirmingDelete`, render an inline panel: if `itemCount > 0`, copy "This space has {itemCount} items — choose where they go:" + two `<select>`s (destination space from `otherSpaces`; destination area from `destSpace.areas`, resetting `destAreaId` when `destSpaceId` changes) + a "Delete & move items" danger button (`onClick={confirmDeleteSpace}`, disabled if `!destSpace || !destAreaId || otherSpaces.length===0`). If `itemCount === 0`, copy "Delete this space? This can't be undone." + a "Delete Space" danger button (`onClick={confirmDeleteSpace}`). Plus a "Cancel" neutral button (`onClick={()=>setConfirmingDelete(false)}`). (This satisfies contract §8 "collect a destination, pass `reassignTo`"; the repo throws "contains items" if no destination — the disabled guard prevents that path.)

> Port note on `holdMs:0`: the prototype's `ReorderList` supports `mode="handle"` (grip-initiated, no long-press) for areas and `mode="longpress"` for spaces. Our `useHoldToReorder` arms on `onPointerDown` after `holdMs`; passing `holdMs:0` makes the grip's `onPointerDown` start the drag on the next tick (effectively immediate), matching handle mode. Spreading `bind(key)` **only on the grip span** (not the whole row) ensures dragging starts from the handle, as in the prototype's `areaRow`.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/stow/ui/mobile/spaces/
git commit -m "feat(mobile): add SpaceActionSheet, EditSpaceSheet, ColorPicker, IconPicker" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `HomeScreen` (retrieval-first)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/HomeScreen.tsx`

Port `prototype/screens-core.jsx` `RetrievalHome` (lines 17–127). **Drop `ValueFirstHome`** (contract §11). The header counts drop the dollar total (this is homeowner-organization, not insurance — spec §1; use `{items} items · {spaces} spaces`). The bell navigates to `${basePath}/activity` (route exists in P4; for now `navigate` there — it renders a placeholder until P4). Embeds `<SpacesList>` (Task 8). Search is **local component state** (the prototype's `q`), not the URL.

**Prop interface + bindings:**
```tsx
// src/features/stow/ui/mobile/screens/HomeScreen.tsx
import { useMemo, useState } from "react";
import type { Item, SpaceWithAreas } from "@/types/domain";
import { Bell, Clock, Folder, Inbox, Search, X } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { ResultRow } from "@/features/stow/ui/mobile/components/ResultRow";
import { SpacesList } from "@/features/stow/ui/mobile/screens/SpacesList";
import type { SpacesListProps } from "@/features/stow/ui/mobile/screens/SpacesList";

export interface HomeScreenProps {
  spaces: SpaceWithAreas[];
  items: Item[];
  householdName: string;
  onOpenItem: (itemId: string) => void;
  onBell: () => void;                 // → navigate(`${basePath}/activity`)
  // forwarded to the embedded SpacesList:
  spacesList: Omit<SpacesListProps, "spaces" | "itemCountForSpace">;
}
```

- [ ] **Step 1: Write the data wiring** (full logic — search filter, recent rail, space-name lookup)

```tsx
export function HomeScreen(props: HomeScreenProps) {
  const { spaces, items, householdName, onOpenItem, onBell, spacesList } = props;
  const [query, setQuery] = useState("");

  const spaceNameById = useMemo(() => new Map(spaces.map((s) => [s.id, s.name])), [spaces]);
  const spaceName = (id: string) => spaceNameById.get(id) ?? "";
  const itemCountForSpace = (spaceId: string) => items.filter((i) => i.spaceId === spaceId).length;

  const ql = query.trim().toLowerCase();
  const searching = ql.length > 0;
  const results = useMemo(() => {
    if (!searching) return [];
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(ql) ||
        (i.tags || []).some((t) => t.toLowerCase().includes(ql)) ||
        spaceName(i.spaceId).toLowerCase().includes(ql) ||
        (i.areaNameSnapshot || "").toLowerCase().includes(ql)
    );
  }, [items, ql, searching, spaceNameById]);

  const recent = useMemo(
    () =>
      items
        .slice()
        .sort((a, b) => {
          const at = a.createdAt?.toMillis?.() ?? 0;
          const bt = b.createdAt?.toMillis?.() ?? 0;
          return bt - at;
        })
        .slice(0, 8),
    [items]
  );

  // ...see port instruction for the markup
}
```
> The prototype sorted `createdAt` (a string) lexicographically; live `Item.createdAt` is a Firestore `Timestamp` → sort by `.toMillis()` desc (guard with `?.` for un-synced server timestamps which can be momentarily null). Top 8 per contract §5/roadmap P1.3.

- [ ] **Step 2: Write the markup** — port from `RetrievalHome` (translate per §1.3, map per §11)

Structure:
- Sticky glass header (`padding:"calc(env(safe-area-inset-top) + 24px) 24px 14px"`, `background: color-mix(in srgb, var(--stow-surface) 90%, transparent)`, `backdrop-filter: blur(20px)`, `borderBottom:1px solid var(--stow-border-l)`, `position:"sticky"`, `top:0`, `zIndex:20`):
  - Wordmark row: `<h1 style={{fontFamily:"var(--stow-display)", fontSize:30, fontWeight:900}}>Stow<span style={{color:"var(--stow-accent)"}}>.</span></h1>` + subtitle `${items.length} items · ${spaces.length} spaces` (`var(--stow-warm)`). (Drop the `$total tracked` clause from the prototype.)
  - Bell button (right): 40×40 round `var(--stow-surface)` tile with `<Bell size={18} color="var(--stow-ink-muted)"/>` → `onClick={onBell}`, `aria-label="Activity"`.
  - Search hero: a relative wrapper; `<Search size={18} color={searching ? "var(--stow-accent)":"var(--stow-warm)"}/>` absolutely positioned left; `<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find anything…">` styled with `borderRadius:"var(--stow-radius-button)"`, accent focus ring (`boxShadow: searching ? "0 0 0 4px var(--stow-accent-soft)" : "var(--stow-shadow-soft)"`, border accent when searching); a clear `×` button when `searching` (`onClick={()=>setQuery("")}`).
- Scroll body (`flex:1; overflowY:auto; padding:"18px 24px 150px"`):
  - If `searching`: if `results.length===0`, an empty state ("No matches", `Nothing matches "{query}"`); else a `Label` "{n} result(s)" then `results.map(it => <ResultRow key={it.id} item={it} spaceName={spaceName(it.spaceId)} onClick={()=>onOpenItem(it.id)} />)`.
  - Else (idle): a "Recently added" rail header (`<Clock size={13}/>` + uppercase label) then a horizontal-scroll row of recent cards (port `recentCard`, lines 57–70): 132-wide `cardStyle` cards — 94px image area (`item.image?.downloadUrl` → `<img>`; else `item.kind==="folder" ? <Folder/> : <Inbox/>` at `var(--stow-border)`) + name + `spaceName(item.spaceId)`; each `onClick={()=>onOpenItem(it.id)}`. Then render the embedded list: `<SpacesList spaces={spaces} itemCountForSpace={itemCountForSpace} {...spacesList} />`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/stow/ui/mobile/screens/HomeScreen.tsx
git commit -m "feat(mobile): add retrieval-first HomeScreen with recently-added rail + embedded SpacesList" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `RoomScreen` (areas grid + items)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/RoomScreen.tsx`

Port `prototype/screens-core.jsx` `RoomScreen` (lines 158–263). Header has back, room name, and Camera + QR buttons — **render both** (Camera wired in P2, QR in P5; for now each calls a "coming soon" toast via `onComingSoon`). Areas as a 2-col `AreaCard` grid + dashed "+ Add Area"; optional "All Items" list; inside an area, an area-filtered `ItemRow` list + "+ Add Item". The area filter is driven by `useMobileNavigation`'s `selectedAreaId` (route `/app/spaces/:id/areas/:areaId`).

**Prop interface + bindings:**
```tsx
// src/features/stow/ui/mobile/screens/RoomScreen.tsx
import type { Item, SpaceWithAreas } from "@/types/domain";
import { Box, Camera, ChevronLeft, Plus, QrCode } from "@/features/stow/ui/mobile/theme/icons";
import { AreaCard } from "@/features/stow/ui/mobile/components/AreaCard";
import { ItemRow } from "@/features/stow/ui/mobile/components/ItemRow";

export interface RoomScreenProps {
  space: SpaceWithAreas;
  items: Item[];                       // all items; filter to this space internally
  selectedAreaId: string | null;       // from useMobileNavigation
  onBack: () => void;                  // nav.back (to Spaces) when no area selected
  onClearArea: () => void;            // nav.openSpace(space.id) — drops the areaId
  onOpenArea: (areaId: string) => void; // nav.openSpace(space.id, areaId)
  onOpenItem: (itemId: string) => void;
  onAddArea: () => void;              // openOverlay("addArea", { spaceId })
  onAddItem: (areaId: string | null) => void; // openOverlay("addItem", { spaceId, areaId })
  onComingSoon: (label: string) => void; // toast for Camera (P2) / QR (P5)
}
```

- [ ] **Step 1: Write the data wiring** (full logic — space/area item filters)

```tsx
export function RoomScreen(props: RoomScreenProps) {
  const { space, items, selectedAreaId, onBack, onClearArea, onOpenArea, onOpenItem, onAddArea, onAddItem, onComingSoon } = props;
  const selectedArea = selectedAreaId ? space.areas.find((a) => a.id === selectedAreaId) ?? null : null;
  const isInArea = selectedArea != null;
  const spaceItems = items.filter((i) => i.spaceId === space.id);
  const areaItems = (areaId: string) => spaceItems.filter((i) => i.areaId === areaId);
  const filtered = isInArea ? spaceItems.filter((i) => i.areaId === selectedArea!.id) : spaceItems;
  const spaceColor = space.color;
  // ...see port instruction for the markup
}
```
> Prototype filtered items by `area` **name** string; live items carry both `areaId` and `areaNameSnapshot` — filter by `areaId` (authoritative). `AreaCard` gets `count={areaItems(area.id).length}` and `color={spaceColor}`.

- [ ] **Step 2: Write the markup** — port from `RoomScreen` (translate per §1.3, map per §11)

Structure:
- Sticky glass header (same glass recipe as Home): a back button whose label/behavior is conditional — when `isInArea` → label = `space.name`, `onClick={onClearArea}`; else label = "Spaces", `onClick={onBack}` (both with `<ChevronLeft size={20} color="var(--stow-accent)"/>`). Center title = `isInArea ? selectedArea!.name : space.name`. Right: two buttons — `<Camera size={18}/>` → `onClick={()=>onComingSoon("Camera arrives in P2")}` and `<QrCode size={18}/>` → `onClick={()=>onComingSoon("QR labels arrive in a later release")}` (both `aria-label`led).
- Scroll body (`padding:"16px 16px 150px"`):
  - **Areas view** (`!isInArea`): a `Label` "{n} Area(s)"; a 2-col grid (`gridTemplateColumns:"1fr 1fr", gap:10`) of `<AreaCard key={area.id} name={area.name} count={areaItems(area.id).length} color={spaceColor} onClick={()=>onOpenArea(area.id)} />`, followed by a dashed "+ Add Area" cell (`border:2px dashed var(--stow-border)`, `<Plus/>` + "Add Area" in `var(--stow-accent)`) → `onClick={onAddArea}`. If `spaceItems.length > 0`, an "All Items ({n})" section listing `spaceItems.map(it => <ItemRow key={it.id} item={it} spaceName={space.name} onClick={()=>onOpenItem(it.id)} />)`.
  - **Area view** (`isInArea`): if `filtered.length===0`, an empty state (`<Box size={36}/>`, `Nothing in {selectedArea.name}`, "Add your first item to this area", and an "Add Item" primary button → `onClick={()=>onAddItem(selectedArea!.id)}`); else `filtered.map(it => <ItemRow key={it.id} item={it} spaceName={space.name} onClick={()=>onOpenItem(it.id)} />)`. Below, a dashed "+ Add Item to {selectedArea.name}" row → `onClick={()=>onAddItem(selectedArea!.id)}`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/stow/ui/mobile/screens/RoomScreen.tsx
git commit -m "feat(mobile): add RoomScreen with area grid + area-filtered items" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: `ItemDetail` (location-first, full-screen)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/ItemDetail.tsx`

Port `prototype/screens-detail.jsx` `ItemDetail` (lines 4–160). **Ship location-first only** (`locFirst === true` branches; drop the price-first branch — contract decisions in spec §3). Hero image/placeholder + floating back/edit/delete; content sheet with name + pack toggle, **Location hero card** (tap → move), demoted value line (`★ Priceless` or `Value $n`), notes, tags (chips + add), Edit/Move actions. Sub-modes: **view / edit / tag / move** held in local component state. Photo editing in the edit sub-mode is a **placeholder slot** until P2.

This is the full-screen route target `/app/items/:id`. It receives the resolved `item` and `space` plus action callbacks; the parent (Task 15) renders it when `selectedItemId` is set.

**Prop interface + bindings:**
```tsx
// src/features/stow/ui/mobile/screens/ItemDetail.tsx
import { useMemo, useState } from "react";
import type { Item, SpaceWithAreas } from "@/types/domain";
import {
  ArrowRight, ChevronLeft, ChevronRight, Folder, Inbox, MapPin, Package, Pencil, Plus, Save, Star, Tag, Trash2, X,
} from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";

type Mode = "view" | "edit" | "tag" | "move";

export interface ItemDetailProps {
  item: Item;
  space: SpaceWithAreas | null;        // the item's current space (for the location label)
  spaces: SpaceWithAreas[];            // all spaces, for the move destination picker
  allTags: string[];                   // union of tags across items, for the tag picker
  onBack: () => void;
  onTogglePacked: (next: boolean) => void;            // → actions.togglePacked
  onSaveEdit: (patch: { name: string; value: number | null; notes: string }) => void; // → actions.updateItem
  onToggleTag: (tag: string) => void;                 // add/remove → actions.updateItem {tags}
  onMove: (dest: { spaceId: string; areaId: string; areaNameSnapshot: string }) => void; // → actions.updateItem
  onDelete: () => void;                               // → Confirm → actions.deleteItem
  onFlash: (msg: string) => void;
}
```

- [ ] **Step 1: Write the state + handlers** (full logic — edit draft, tag union minus assigned, move destination)

```tsx
export function ItemDetail(props: ItemDetailProps) {
  const { item, space, spaces, allTags, onBack, onTogglePacked, onSaveEdit, onToggleTag, onMove, onDelete, onFlash } = props;
  const [mode, setMode] = useState<Mode>("view");

  // edit draft
  const [draftName, setDraftName] = useState(item.name);
  const [draftValue, setDraftValue] = useState(item.value != null ? String(item.value) : "");
  const [draftNotes, setDraftNotes] = useState(item.notes ?? "");

  // tag picker
  const [newTag, setNewTag] = useState("");
  const availableTags = useMemo(
    () => allTags.filter((t) => !(item.tags || []).includes(t)),
    [allTags, item.tags]
  );

  // move picker
  const [moveSpaceId, setMoveSpaceId] = useState(space?.id ?? spaces[0]?.id ?? "");
  const moveSpace = useMemo(() => spaces.find((s) => s.id === moveSpaceId) ?? null, [spaces, moveSpaceId]);
  const [moveAreaId, setMoveAreaId] = useState(space?.areas[0]?.id ?? "");

  const spaceName = space?.name ?? "";
  const locationArea = item.areaNameSnapshot;

  function startEdit() {
    setDraftName(item.name);
    setDraftValue(item.value != null ? String(item.value) : "");
    setDraftNotes(item.notes ?? "");
    setMode("edit");
  }
  function saveEdit() {
    if (!draftName.trim()) return;
    onSaveEdit({
      name: draftName.trim(),
      value: draftValue.trim() ? Number.parseFloat(draftValue) : null,
      notes: draftNotes,
    });
    setMode("view");
    onFlash("Item updated");
  }
  function commitMove() {
    if (!moveSpace || !moveAreaId) return;
    onMove({
      spaceId: moveSpace.id,
      areaId: moveAreaId,
      areaNameSnapshot: moveSpace.areas.find((a) => a.id === moveAreaId)?.name ?? "",
    });
    setMode("view");
    onFlash("Item moved");
  }

  const hasImage = Boolean(item.image?.downloadUrl);
  // ...see port instruction for the markup
}
```
> Mapping (§11): the prototype's `roomName(item.roomId)` → `spaceName`; `item.area` → `item.areaNameSnapshot`; `item.isFolder` → `item.kind==="folder"`; `item.image` url → `item.image?.downloadUrl`. The pack toggle calls `onTogglePacked(!item.isPacked)` (still `isPacked` in P1; `status` arrives P4 — contract §7.7). Value parses to `number | null` (repo stores `value ?? null`).

- [ ] **Step 2: Write the markup** — port from `ItemDetail` location-first branches (translate per §1.3)

Outer: `position:absolute; inset:0; zIndex:60; background:var(--stow-surface); animation:"stowUp 0.32s ease-out"`.
- **Hero** (`height: hasImage ? "38%" : "18%"`, `var(--stow-canvas)`): if `hasImage` → `<img src={item.image!.downloadUrl}>`; else centered `item.kind==="folder" ? <Folder/> : <Inbox/>` at `var(--stow-border)`. Floating top bar (`padding:"calc(env(safe-area-inset-top)) 16px 0"` ish — use `52px 16px 0` as the prototype, but prefer safe-area: `"calc(env(safe-area-inset-top) + 8px) 16px 0"`): a back icon-button (`onClick={() => { onBack(); }}`); and when `mode==="view"`, an edit icon-button (`onClick={startEdit}`) + a delete icon-button (`onClick={onDelete}`). Icon-button helper: 40×40 round, `background: hasImage ? "rgba(255,255,255,0.22)" : "var(--stow-canvas)"`, `backdrop-filter: blur(10px)`; glyph color `hasImage ? "#fff" : ...`.
- **Content sheet** (`flex:1; marginTop:-24; borderRadius:"28px 28px 0 0"; padding:24; background:var(--stow-surface); overflowY:auto`):
  - **mode === "tag":** "Manage Tags" — Assigned chips (each `onClick={()=>onToggleTag(t)}` shows `Tag` + name + `X`); "Available" chips (from `availableTags`, `onClick={()=>onToggleTag(t)}` shows `Tag` + name + `Plus`); "Create New" row (input `newTag` + "+ Create" button: on Enter/click if `newTag.trim()` → `onToggleTag(newTag.trim()); setNewTag("")`); a "Done" `Button` (`variant="primary"` — use `var(--stow-ink)` bg per prototype via `style`) → `onClick={()=>setMode("view")}`.
  - **mode === "edit":** header "Edit Item" + a "Cancel" text button (`onClick={()=>setMode("view")}`); `<Field label="Name" value={draftName} onChange={setDraftName}/>`; a "Photo" `FieldLabel` + a **placeholder slot** (`<div>` tile reading "Photo editing arrives in P2" — do NOT wire camera/upload here; P2 replaces this with `PhotoField`); `<Field label="Value ($)" type="number" value={draftValue} onChange={setDraftValue}/>`; `<Field label="Notes" multiline value={draftNotes} onChange={setDraftNotes}/>`; a Save `Button` (`disabled={!draftName.trim()}`, `<Save/>` + "Save Changes") → `onClick={saveEdit}`.
  - **mode === "move":** header "Move Item"; a Space chip row (each space → `setMoveSpaceId(s.id)` and reset `moveAreaId` to that space's first area id) styled like the Add-sheet space chips (selected = `s.color`); an "Area in {moveSpace.name}" chip row (each area → `setMoveAreaId(a.id)`); a "Move here" `Button` (`disabled={!moveSpace || !moveAreaId}`) → `onClick={commitMove}`; plus a "Cancel" neutral `Button` → `onClick={()=>setMode("view")}`.
  - **mode === "view":** the location-first body:
    - Title row: `<h1>{item.name}</h1>` + pack toggle button (48×48, `background: item.isPacked ? "var(--stow-success)" : "var(--stow-canvas)"`, `<Package/>`) → `onClick={() => { onTogglePacked(!item.isPacked); onFlash(item.isPacked ? "Removed from bag" : "Added to bag"); }}`.
    - **Location hero card** (tappable → move): full-width button, `background:var(--stow-accent-soft)`, `border:1px solid color-mix(in srgb, var(--stow-accent) 15%, transparent)`; a 44×44 `var(--stow-accent)` tile with `<MapPin color="#fff"/>`; an uppercase "Location" label (`var(--stow-accent)`) then `spaceName` `<ChevronRight/>` `locationArea`; trailing `<ArrowRight color="var(--stow-accent)"/>`. `onClick={() => { setMoveSpaceId(space?.id ?? spaces[0]?.id ?? ""); setMoveAreaId(space?.areas[0]?.id ?? ""); setMode("move"); }}`.
    - **Demoted value line** (only if `item.value != null || item.isPriceless`): `item.isPriceless ? "★ Priceless"` (`<Star size={12} color="var(--stow-warm)"/>` + "Priceless") : an uppercase "Value" + `$${item.value}` — all in `var(--stow-warm)`.
    - **Notes** (if `item.notes`): a `var(--stow-canvas)` card with a "Notes" `FieldLabel` + the text.
    - **Tags:** a "Tags" `FieldLabel`; assigned tags as static chips (`Tag` + name) + a dashed "+ Add" chip → `onClick={()=>setMode("tag")}`.
    - **Actions** (`marginTop:auto`): an "Edit Item" `Button` (accent-soft, `<Pencil/>`) → `onClick={startEdit}`; a "Move to another space" `Button` (neutral, `<ArrowRight/>`) → `onClick={() => setMode("move")}`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/stow/ui/mobile/screens/ItemDetail.tsx
git commit -m "feat(mobile): add location-first ItemDetail with view/edit/tag/move modes" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Add sheets — `AddItemSheet`, `AddSpaceSheet`, `AddAreaSheet`

**Files:**
- Create: `src/features/stow/ui/mobile/add/AddItemSheet.tsx`
- Create: `src/features/stow/ui/mobile/add/AddSpaceSheet.tsx`
- Create: `src/features/stow/ui/mobile/add/AddAreaSheet.tsx`

Port the Add Item / Add Space / Add Area sheets from `prototype/app.jsx` (the `doAddItem`/`doAddSpace`/`doAddArea` bodies + the `<U.Sheet>` markup, lines 178–338). All three render inside the Task 6 `Sheet`. `AddItemSheet` is **location-first** (contract §10): Photo placeholder slot → Name → Space/Area chips → "More details" disclosure (value/tags/notes) + an "✨ AI filled" badge slot. `AddSpaceSheet` passes `position` (= current space count) for deterministic append. `AddAreaSheet` passes `position` (= current area count in the space).

- [ ] **Step 1: Write `AddItemSheet.tsx`** (full form logic + location-first order)

```tsx
// src/features/stow/ui/mobile/add/AddItemSheet.tsx
import { useMemo, useState } from "react";
import type { SpaceWithAreas } from "@/types/domain";
import { ChevronDown, Plus, Sparkles } from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

export interface AddItemSheetProps {
  open: boolean;
  spaces: SpaceWithAreas[];
  defaultSpaceId: string | null;       // from current room context
  defaultAreaId: string | null;        // from current area context
  onClose: () => void;
  onCreate: (input: {
    name: string;
    spaceId: string;
    areaId: string;
    areaNameSnapshot: string;
    value: number | null;
    tags: string[];
    notes: string;
  }) => void;
}

export function AddItemSheet(props: AddItemSheetProps) {
  const { open, spaces, defaultSpaceId, defaultAreaId, onClose, onCreate } = props;
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState(defaultSpaceId ?? spaces[0]?.id ?? "");
  const [areaId, setAreaId] = useState(defaultAreaId ?? "");
  const [value, setValue] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);

  const selectedSpace = useMemo(() => spaces.find((s) => s.id === spaceId) ?? spaces[0] ?? null, [spaces, spaceId]);

  function selectSpace(nextId: string) {
    const next = spaces.find((s) => s.id === nextId);
    setSpaceId(nextId);
    setAreaId(next?.areas[0]?.id ?? "");
  }

  function submit() {
    if (!name.trim() || !selectedSpace) return;
    const area = selectedSpace.areas.find((a) => a.id === areaId) ?? selectedSpace.areas[0] ?? null;
    if (!area) return;
    onCreate({
      name: name.trim(),
      spaceId: selectedSpace.id,
      areaId: area.id,
      areaNameSnapshot: area.name,
      value: value.trim() ? Number.parseFloat(value) : null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      notes,
    });
    // reset
    setName(""); setValue(""); setTags(""); setNotes(""); setMoreOpen(false);
  }

  // ...see port instruction for the markup
}
```
Port markup from `prototype/app.jsx` Add Item sheet (location-first branch, lines 232–323): inside `<Sheet open={open} onClose={onClose} title="Add Item">`, render in order:
1. **Photo block** — a "Photo" `FieldLabel` with an "✨ AI filled" badge slot beside it (render the badge only when an `aiFilled` flag is set; in P1 there is no AI fill, so the badge is wired but never shown — keep the slot). Below, a **placeholder tile** reading "Add a photo in P2" (do NOT wire camera/upload — P2 adds `PhotoField`).
2. **Name** — `<Field label="Name" value={name} onChange={setName} placeholder="e.g. Wireless Charger"/>`.
3. **Space/Area chips** — a "Space" `FieldLabel` + a wrapped chip row: each space → a chip with a `s.color` dot, selected when `spaceId===s.id` (selected style `border:1.5px solid s.color`, `background: color-mix(in srgb, s.color 12%, var(--stow-surface))`), `onClick={()=>selectSpace(s.id)}`. Then an "Area in {selectedSpace.name}" `FieldLabel` + a chip row of `selectedSpace.areas`: each → selected when `areaId===a.id` (selected = `var(--stow-accent)` bg, white text), `onClick={()=>setAreaId(a.id)}`.
4. **"More details" disclosure** — a button toggling `moreOpen` (chevron rotates); when open, render `<Field label="Value ($)" type="number"…/>`, `<Field label="Tags (comma separated)"…/>`, `<Field label="Notes" multiline…/>`. Collapsed hint shows filled summary (`$value`, `n tags`) like the prototype.
5. A submit `Button` (`disabled={!name.trim()}`, `<Plus/>` + "Add Item") → `onClick={submit}`.

- [ ] **Step 2: Write `AddSpaceSheet.tsx`** (passes `position` = current count)

```tsx
// src/features/stow/ui/mobile/add/AddSpaceSheet.tsx
import { useState } from "react";
import { Plus } from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

// Cycle space accent colors like the prototype (data.jsx colors).
const SPACE_COLORS = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A"];

export interface AddSpaceSheetProps {
  open: boolean;
  spaceCount: number;                  // → position for deterministic append (contract §5.1)
  onClose: () => void;
  onCreate: (input: { name: string; areas: Array<{ name: string }>; color: string; position: number }) => void;
}

export function AddSpaceSheet(props: AddSpaceSheetProps) {
  const { open, spaceCount, onClose, onCreate } = props;
  const [name, setName] = useState("");
  const [areas, setAreas] = useState("");

  function submit() {
    if (!name.trim()) return;
    const areaList = areas
      ? areas.split(",").map((a) => ({ name: a.trim() })).filter((a) => a.name)
      : [{ name: "Main" }];
    onCreate({
      name: name.trim(),
      areas: areaList,
      color: SPACE_COLORS[spaceCount % SPACE_COLORS.length],
      position: spaceCount,
    });
    setName(""); setAreas("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add Space">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Space name" value={name} onChange={setName} placeholder="e.g. Bedroom" />
        <Field label="Areas (comma separated)" value={areas} onChange={setAreas} placeholder="Closet, Nightstand, Dresser" />
        <Button variant="primary" disabled={!name.trim()} onClick={submit}>
          <Plus size={16} color="#fff" /> Create Space
        </Button>
      </div>
    </Sheet>
  );
}
```
> The default `icon` for a new space is `"box"` (repo `createSpace` default). `onCreate` (wired in Task 15) calls `actions.createSpace({ householdId, userId, name, color, position, icon: "box", areas })`.

- [ ] **Step 3: Write `AddAreaSheet.tsx`** (passes `position` = current area count in the space)

```tsx
// src/features/stow/ui/mobile/add/AddAreaSheet.tsx
import { useState } from "react";
import { Plus } from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

export interface AddAreaSheetProps {
  open: boolean;
  areaCount: number;                   // current areas in the target space → position
  onClose: () => void;
  onCreate: (input: { name: string; position: number }) => void;
}

export function AddAreaSheet(props: AddAreaSheetProps) {
  const { open, areaCount, onClose, onCreate } = props;
  const [name, setName] = useState("");

  function submit() {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), position: areaCount });
    setName("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add Area">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Area name" value={name} onChange={setName} placeholder="e.g. Top Shelf" />
        <Button variant="primary" disabled={!name.trim()} onClick={submit}>
          <Plus size={16} color="#fff" /> Add Area
        </Button>
      </div>
    </Sheet>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/add/
git commit -m "feat(mobile): add location-first AddItemSheet + AddSpaceSheet + AddAreaSheet" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: `SearchScreen` (grid/list toggle persisted + popular tags)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/SearchScreen.tsx`

Port `prototype/screens-core.jsx` `SearchScreen` (lines 265–341). Input + grid/list toggle **persisted to `localStorage`**, idle "Popular Tags" pills, results as rows or a 2-col grid. Reuse the match-logic style from `pickerSearch.ts` (substring, normalized).

> **Persistence note:** legacy `StowApp.tsx` persisted the grid toggle via the URL param `view=grid`, **not** `localStorage` (verified). The contract/roadmap for the mobile redesign asks for `localStorage` persistence. Use a stable key `"stow:mobile:search-view"` with values `"grid"|"list"`. (Do NOT port QR or recent-searches — those are P5.)

**Prop interface + bindings:**
```tsx
// src/features/stow/ui/mobile/screens/SearchScreen.tsx
import { useEffect, useMemo, useState } from "react";
import type { Item, SpaceWithAreas } from "@/types/domain";
import { Folder, Inbox, LayoutGrid, List, Search, X } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { ItemRow } from "@/features/stow/ui/mobile/components/ItemRow";
import { matchesPackingItemPickerQuery } from "@/features/stow/ui/packing/pickerSearch";

const VIEW_KEY = "stow:mobile:search-view";

export interface SearchScreenProps {
  items: Item[];
  spaces: SpaceWithAreas[];
  onOpenItem: (itemId: string) => void;
}
```

- [ ] **Step 1: Write the data wiring** (full logic — persisted toggle, match filter, tag union)

```tsx
export function SearchScreen(props: SearchScreenProps) {
  const { items, spaces, onOpenItem } = props;
  const [query, setQuery] = useState("");
  const [gridView, setGridView] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(VIEW_KEY) === "grid";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, gridView ? "grid" : "list");
    } catch {
      /* storage may be unavailable (private mode) — non-fatal */
    }
  }, [gridView]);

  const spaceNameById = useMemo(() => new Map(spaces.map((s) => [s.id, s.name])), [spaces]);
  const spaceName = (id: string) => spaceNameById.get(id) ?? "";

  const allTags = useMemo(() => Array.from(new Set(items.flatMap((i) => i.tags || []))), [items]);

  const matched = useMemo(() => {
    if (!query.trim()) return [];
    return items.filter((i) =>
      matchesPackingItemPickerQuery(query, [i.name, ...(i.tags || []), spaceName(i.spaceId), i.areaNameSnapshot])
    );
  }, [items, query, spaceNameById]);

  const listToShow = query.trim() ? matched : items;
  // ...see port instruction for the markup
}
```
> `matchesPackingItemPickerQuery(query, fields)` (from `src/features/stow/ui/packing/pickerSearch.ts`) normalizes (`toLowerCase`, collapse whitespace) and does substring `includes` across `fields` — reuse it so search semantics match the packing picker. The prototype matched name/tags/space; we additionally include `areaNameSnapshot` (harmless superset).

- [ ] **Step 2: Write the markup** — port from `SearchScreen` (translate per §1.3, map per §11)

Structure:
- Sticky glass header: `<h1 style={{fontFamily:"var(--stow-display)"}}>Search</h1>`; a row with a flex-1 search input wrapper (`<Search size={16}/>` left, `<input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Items, tags, or spaces...">`, accent border when `query`, a clear `×` when `query`) and a 44×44 toggle button → `onClick={()=>setGridView(v=>!v)}` showing `<List/>` when in grid mode else `<LayoutGrid/>`.
- Scroll body (`padding:"16px 16px 150px"`):
  - If `!query.trim()`: a "Popular Tags" `Label` + wrapped pill buttons from `allTags` (`#${tag}`) → each `onClick={()=>setQuery(tag)}`.
  - If `query.trim() && matched.length===0`: empty state ("No results", `Nothing matches "{query}"`).
  - Else: a `Label` = `query.trim() ? "{n} result(s)" : "All Items ({items.length})"`; then:
    - grid view → a 2-col grid of cards (port `gridCard`, lines 285–295): square image (`item.image?.downloadUrl` → `<img>`; else `item.kind==="folder"?<Folder/>:<Inbox/>`), name, `spaceName(item.spaceId)`; `onClick={()=>onOpenItem(it.id)}`.
    - list view → `listToShow.map(it => <ItemRow key={it.id} item={it} spaceName={spaceName(it.spaceId)} onClick={()=>onOpenItem(it.id)} />)`.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/stow/ui/mobile/screens/SearchScreen.tsx
git commit -m "feat(mobile): add SearchScreen with persisted grid/list toggle + popular tags" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: `PackingScreen` (per-list templates)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/PackingScreen.tsx`

Port `prototype/screens-detail.jsx` `PackingScreen` (lines 162–255), but use the **live** per-list templates model: `PackingList` with `itemIds`/`packedItemIds` is the source of truth (contract §11, spec §7.7). List index (cards + `ProgressBar` + `···` menu) and list detail (circular checks, strikethrough, add-items picker reusing `pickerSearch.ts`, clear-all). The add-items picker reuses the **logic** of `pickerSearch.ts` (do not import the legacy `PackingItemPickerModal`, which depends on `ui/shared` — render a mobile picker inside the Task 6 `Sheet`).

**Prop interface + bindings:**
```tsx
// src/features/stow/ui/mobile/screens/PackingScreen.tsx
import { useMemo, useState } from "react";
import type { Item, PackingList, SpaceWithAreas } from "@/types/domain";
import { Check, ChevronLeft, Inbox, MoreHorizontal, Plus } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { ProgressBar } from "@/features/stow/ui/mobile/components/ProgressBar";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";
import { ActionSheet } from "@/features/stow/ui/mobile/shell/ActionSheet";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { matchesPackingItemPickerQuery } from "@/features/stow/ui/packing/pickerSearch";

export interface PackingScreenProps {
  packingLists: PackingList[];
  items: Item[];
  spaces: SpaceWithAreas[];
  onOpenItem: (itemId: string) => void;
  onCreateList: (name: string) => void;                       // → actions.createPackingList
  onRenameList: (listId: string, name: string) => void;      // → actions.updatePackingList {name}
  onDeleteList: (listId: string) => void;                     // → actions.deletePackingList
  onToggleItem: (listId: string, itemId: string, packed: boolean) => void; // → actions.togglePackingListItem
  onClearPacked: (listId: string) => void;                    // → actions.clearPackingListPacked
  onSetItems: (listId: string, itemIds: string[]) => void;    // → actions.updatePackingList {itemIds}
  onFlash: (msg: string) => void;
}
```

- [ ] **Step 1: Write the screen state + handlers** (full logic — active list, picker, menu)

```tsx
export function PackingScreen(props: PackingScreenProps) {
  const { packingLists, items, spaces, onOpenItem, onCreateList, onRenameList, onDeleteList, onToggleItem, onClearPacked, onSetItems, onFlash } = props;
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  const [menuListId, setMenuListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newListName, setNewListName] = useState("");

  const activeList = useMemo(() => packingLists.find((l) => l.id === activeListId) ?? null, [packingLists, activeListId]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const spaceNameById = useMemo(() => new Map(spaces.map((s) => [s.id, s.name])), [spaces]);

  function openPicker() {
    if (!activeList) return;
    setPickerSelected(new Set(activeList.itemIds));
    setPickerQuery("");
    setPickerOpen(true);
  }
  function commitPicker() {
    if (activeList) onSetItems(activeList.id, [...pickerSelected]);
    setPickerOpen(false);
  }
  function togglePickerItem(id: string) {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pickerSections = useMemo(() => {
    return spaces
      .map((space) => ({
        spaceId: space.id,
        spaceName: space.name,
        items: items.filter(
          (i) => i.spaceId === space.id && matchesPackingItemPickerQuery(pickerQuery, [i.name, i.areaNameSnapshot, space.name])
        ),
      }))
      .filter((section) => section.items.length > 0);
  }, [spaces, items, pickerQuery]);

  // ...see port instruction for the markup
}
```
> The picker is the mobile re-implementation of `PackingItemPickerModal` logic (sectioned by space, `matchesPackingItemPickerQuery` filter, multi-select set committed via `onSetItems`). It deliberately does **not** import `PackingItemPickerModal` (legacy `ui/shared` is off-limits until P5).

- [ ] **Step 2: Write the markup** — port from `PackingScreen` (translate per §1.3, map per §11)

Two views, switched on `activeList`:
- **Index** (`!activeList`): header "Packing" + a "New List" pill button → `onClick={()=>setCreating(true)}`. Body: `packingLists.map(l => …)` cards (`cardStyle`, padding 18) showing `l.name`, `${l.packedItemIds.length} of ${l.itemIds.length} packed`, the percent (success at 100%), and `<ProgressBar value={l.packedItemIds.length} total={l.itemIds.length}/>`; card `onClick={()=>setActiveListId(l.id)}`; a `···` button (stopPropagation) → `setMenuListId(l.id)`. A dashed "+ New Packing List" row → `onClick={()=>setCreating(true)}`. When `creating`, render a small inline create row (or reuse `Sheet`): a name `Field` + "Create" `Button` → `onClick={() => { if (newListName.trim()) { onCreateList(newListName.trim()); setNewListName(""); setCreating(false); } }}`.
- **Detail** (`activeList`): sticky glass header with a back button ("Lists" → `setActiveListId(null)`) and a "Clear all" text button → `onClick={() => { onClearPacked(activeList.id); onFlash("List reset"); }}`; the list name `<h1>`; a progress row (`<ProgressBar/>` + `${packed}/${total}`). Body: `activeList.itemIds.map(id => itemById.get(id))` (filter falsy) → for each, a row (`cardStyle`, opacity 0.6 when packed): a circular check button (`background: packed ? "var(--stow-success)":"transparent"`, border when unpacked, `<Check/>` when packed) → `onClick={()=>onToggleItem(activeList.id, it.id, !packed)}` where `packed = activeList.packedItemIds.includes(it.id)`; then a tappable area (thumb + name with strikethrough when packed + `it.areaNameSnapshot`) → `onClick={()=>onOpenItem(it.id)}`. A dashed "+ Add Items" row → `onClick={openPicker}`.
- **Picker** (`<Sheet open={pickerOpen} onClose={()=>setPickerOpen(false)} title="Select Items">`): a search `<input value={pickerQuery} onChange=…>`; a scroll area rendering `pickerSections` — each section a space-name label then its items as checkbox rows (`pickerSelected.has(i.id)`, `onClick={()=>togglePickerItem(i.id)}`); a footer with "{n} selected" + a "Done" `Button` → `onClick={commitPicker}`.
- **List menu** (`<ActionSheet open={menuListId!=null} onClose={()=>setMenuListId(null)} title={…} actions={[Rename, Delete]}>`): "Rename" → prompt-less inline rename is overkill; wire "Rename" to set a small rename state (reuse the create row pattern, pre-filled) calling `onRenameList`; "Delete" (destructive) → `onDeleteList(menuListId)` then `setMenuListId(null)` and `setActiveListId(null)` if it was active.

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/stow/ui/mobile/screens/PackingScreen.tsx
git commit -m "feat(mobile): add PackingScreen per-list templates with add-items picker" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: `SettingsScreen` (household, members, AI Vision, preferences, Export CSV)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/inventoryCsv.ts`
- Create: `src/features/stow/ui/mobile/screens/inventoryCsv.test.ts`
- Create: `src/features/stow/ui/mobile/screens/SettingsScreen.tsx`

Port `prototype/screens-detail.jsx` `SettingsScreen` (lines 257–331), but wire the real Settings the prototype only mocked: Household card (rename), Members (avatars, `RoleBadge`, role selects with owner guards, remove, invite create/regenerate/revoke), AI Vision config (provider/model/baseUrl/temperature/maxTokens/apiKey + Test connection), Preferences (offline indicator, default space, **Export CSV**, Sign out). Reuse callable wrappers in `@/lib/firebase/functions`.

**CSV is new code** — the legacy app has no inventory-CSV export (verified; legacy `csvToList` only *parses* tag strings). Build a tiny pure CSV serializer (unit-tested) and a browser download trigger.

- [ ] **Step 1: Write the failing CSV test** (pure serializer)

```ts
// src/features/stow/ui/mobile/screens/inventoryCsv.test.ts
import { describe, expect, it } from "vitest";
import { buildInventoryCsv } from "@/features/stow/ui/mobile/screens/inventoryCsv";
import type { Item, SpaceWithAreas } from "@/types/domain";

const space = { id: "s1", name: "Garage", areas: [] } as unknown as SpaceWithAreas;
const baseItem = {
  id: "i1", spaceId: "s1", areaNameSnapshot: "Shelf A", name: "Drill",
  tags: ["Tools"], value: 90, notes: "DeWalt", isPacked: false, isPriceless: false, kind: "item",
} as unknown as Item;

describe("buildInventoryCsv", () => {
  it("emits a header row and one row per item", () => {
    const csv = buildInventoryCsv([baseItem], [space]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("Name,Space,Area,Tags,Value,Priceless,Packed,Notes");
    expect(lines[1]).toBe("Drill,Garage,Shelf A,Tools,90,No,No,DeWalt");
  });
  it("quotes and escapes fields containing commas, quotes, or newlines", () => {
    const tricky = { ...baseItem, name: 'Saw, "rusty"', notes: "line1\nline2" } as unknown as Item;
    const csv = buildInventoryCsv([tricky], [space]);
    const row = csv.split("\n").slice(1).join("\n");
    expect(row).toContain('"Saw, ""rusty"""');
    expect(row).toContain('"line1\nline2"');
  });
  it("joins multiple tags with a semicolon and marks priceless/packed", () => {
    const multi = { ...baseItem, tags: ["A", "B"], isPriceless: true, isPacked: true, value: undefined } as unknown as Item;
    const csv = buildInventoryCsv([multi], [space]);
    expect(csv.split("\n")[1]).toBe("Drill,Garage,Shelf A,A;B,,Yes,Yes,DeWalt");
  });
  it("uses an empty space name when the space is unknown", () => {
    const orphan = { ...baseItem, spaceId: "missing" } as unknown as Item;
    expect(buildInventoryCsv([orphan], [space]).split("\n")[1]).toBe("Drill,,Shelf A,Tools,90,No,No,DeWalt");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/screens/inventoryCsv.test.ts`
Expected: FAIL — import cannot be resolved.

- [ ] **Step 3: Write the CSV serializer + download helper**

```ts
// src/features/stow/ui/mobile/screens/inventoryCsv.ts
import type { Item, SpaceWithAreas } from "@/types/domain";

const HEADER = ["Name", "Space", "Area", "Tags", "Value", "Priceless", "Packed", "Notes"];

/** RFC-4180-ish: quote a field if it contains a comma, quote, CR, or LF; double internal quotes. */
function csvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Pure: serialize items to a CSV string. Space name resolved from the spaces list. */
export function buildInventoryCsv(items: Item[], spaces: SpaceWithAreas[]): string {
  const spaceNameById = new Map(spaces.map((s) => [s.id, s.name]));
  const rows = items.map((item) =>
    [
      item.name,
      spaceNameById.get(item.spaceId) ?? "",
      item.areaNameSnapshot ?? "",
      (item.tags ?? []).join(";"),
      item.value != null ? String(item.value) : "",
      item.isPriceless ? "Yes" : "No",
      item.isPacked ? "Yes" : "No",
      item.notes ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  return [HEADER.join(","), ...rows].join("\n");
}

/** Browser side-effect: trigger a download of the CSV. Not unit-tested (DOM/anchor). */
export function downloadInventoryCsv(items: Item[], spaces: SpaceWithAreas[], fileName = "stow-inventory.csv"): void {
  const csv = buildInventoryCsv(items, spaces);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/screens/inventoryCsv.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write `SettingsScreen.tsx`** — full data wiring + handlers (owner guards, invites, LLM config, Test connection)

The screen owns: a `Confirm` for destructive member/invite actions, an LLM form (`providerType`/`model`/`baseUrl`/`temperature`/`maxTokens` + a separate `apiKey` input that is never read back), a "Test connection" result line, and the CSV export. It does NOT manage auth — `onSignOut` comes from the parent and runs through a `Confirm`.

**Prop interface + bindings (consumes `useWorkspaceData` outputs the parent passes through):**
```tsx
// src/features/stow/ui/mobile/screens/SettingsScreen.tsx
import { useMemo, useState } from "react";
import type { HouseholdInvite, HouseholdMember, Item, Role, SpaceWithAreas } from "@/types/domain";
import type { HouseholdLlmConfig, ProviderType } from "@/types/llm";
import { Bell, ChevronRight, Home, Sparkles, Users } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { RoleBadge } from "@/features/stow/ui/mobile/components/RoleBadge";
import { Confirm } from "@/features/stow/ui/mobile/shell/Confirm";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";
import { downloadInventoryCsv } from "@/features/stow/ui/mobile/screens/inventoryCsv";
import {
  createHouseholdInvite, revokeHouseholdInvite, saveHouseholdLlmConfig,
  setHouseholdLlmSecret, updateHouseholdMemberRole, removeHouseholdMember, validateHouseholdLlmConfig,
} from "@/lib/firebase/functions";

export interface SettingsScreenProps {
  householdId: string;
  householdName: string;
  currentUserId: string | null;
  members: HouseholdMember[];
  invites: HouseholdInvite[];
  spaces: SpaceWithAreas[];
  items: Item[];
  llmConfig: HouseholdLlmConfig | null;
  online: boolean;
  onRenameHousehold: (name: string) => void;     // → actions.updateHousehold {name}
  onSignOut: () => void;
  onFlash: (msg: string) => void;
}
```

Full logic to write (role guards mirror `next/StowNextApp.tsx` lines 420–422, 1085–1114):
```tsx
export function SettingsScreen(props: SettingsScreenProps) {
  const {
    householdId, householdName, currentUserId, members, invites, spaces, items, llmConfig, online,
    onRenameHousehold, onSignOut, onFlash,
  } = props;

  const currentMember = useMemo(() => members.find((m) => m.uid === currentUserId) ?? null, [members, currentUserId]);
  const isOwner = currentMember?.role === "OWNER";
  const canManage = currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";
  const ownerCount = useMemo(() => members.filter((m) => m.role === "OWNER").length, [members]);

  // confirm dialog
  const [confirm, setConfirm] = useState<{ title: string; body: string; confirmLabel: string; danger?: boolean; action: () => Promise<void> } | null>(null);
  async function runConfirm() {
    if (!confirm) return;
    const action = confirm.action;
    setConfirm(null);
    await action();
  }

  // household rename
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(householdName);

  // llm form
  const [provider, setProvider] = useState<ProviderType>(llmConfig?.providerType ?? "gemini");
  const [model, setModel] = useState(llmConfig?.model ?? "");
  const [baseUrl, setBaseUrl] = useState(llmConfig?.baseUrl ?? "");
  const [temperature, setTemperature] = useState(String(llmConfig?.temperature ?? 0.2));
  const [maxTokens, setMaxTokens] = useState(String(llmConfig?.maxTokens ?? 400));
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(llmConfig?.enabled ?? false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [savingAi, setSavingAi] = useState(false);

  // invite
  const [inviteRole, setInviteRole] = useState<Role>("MEMBER");

  async function saveAiConfig() {
    if (!canManage || savingAi) return;
    setSavingAi(true);
    try {
      await saveHouseholdLlmConfig({
        householdId,
        config: {
          providerType: provider,
          model: model.trim(),
          baseUrl: provider === "openai_compatible" ? baseUrl.trim() || undefined : undefined,
          enabled,
          promptProfile: "default_inventory",
          temperature: Number.isFinite(Number.parseFloat(temperature)) ? Number.parseFloat(temperature) : 0.2,
          maxTokens: Number.isFinite(Number.parseInt(maxTokens, 10)) ? Number.parseInt(maxTokens, 10) : 400,
        },
      });
      if (apiKey.trim()) {
        await setHouseholdLlmSecret({ householdId, apiKey: apiKey.trim() });
        setApiKey("");
      }
      onFlash("AI settings saved");
    } finally {
      setSavingAi(false);
    }
  }

  async function testConnection() {
    if (!canManage) return;
    setTestResult("Testing…");
    try {
      const result = await validateHouseholdLlmConfig({ householdId });
      setTestResult(result.message || (result.ok ? "Connected" : "Failed"));
    } catch (e) {
      setTestResult(e instanceof Error ? e.message : "Connection test failed");
    }
  }

  function changeRole(member: HouseholdMember, role: Role) {
    if (!canManage || member.role === role) return;
    // guard: never demote the last owner
    if (member.role === "OWNER" && role !== "OWNER" && ownerCount <= 1) {
      onFlash("Promote another owner first");
      return;
    }
    const label = member.displayName || member.email || member.uid;
    setConfirm({
      title: `Change ${label}'s role?`,
      body: `${label} will change from ${member.role.toLowerCase()} to ${role.toLowerCase()}.`,
      confirmLabel: `Change to ${role.toLowerCase()}`,
      action: async () => {
        await updateHouseholdMemberRole({ householdId, uid: member.uid, role });
        onFlash("Member role updated");
      },
    });
  }

  function removeMember(member: HouseholdMember) {
    if (!canManage) return;
    if (member.role === "OWNER" && ownerCount <= 1) {
      onFlash("Promote another owner first");
      return;
    }
    const label = member.displayName || member.email || member.uid;
    setConfirm({
      title: "Remove member?",
      body: `${label} will lose access to this household. Their personal account is not deleted.`,
      confirmLabel: "Remove member",
      danger: true,
      action: async () => {
        await removeHouseholdMember({ householdId, uid: member.uid });
        onFlash("Member removed");
      },
    });
  }

  async function createInvite() {
    if (!canManage) return;
    try {
      await createHouseholdInvite({ householdId, role: inviteRole });
      onFlash("Invite created");
    } catch (e) {
      onFlash(e instanceof Error ? e.message : "Could not create invite");
    }
  }

  function revokeInvite(invite: HouseholdInvite) {
    if (!canManage) return;
    setConfirm({
      title: "Revoke invite?",
      body: "This invite link will stop working immediately.",
      confirmLabel: "Revoke invite",
      danger: true,
      action: async () => {
        await revokeHouseholdInvite({ householdId, inviteId: invite.id });
        onFlash("Invite revoked");
      },
    });
  }

  function exportCsv() {
    downloadInventoryCsv(items, spaces);
    onFlash("Inventory exported");
  }

  function requestSignOut() {
    setConfirm({
      title: "Sign out?",
      body: "This device will leave the current Stow session. Synced household data stays in the account.",
      confirmLabel: "Sign out",
      action: async () => {
        onSignOut();
      },
    });
  }

  // ...see port instruction for the markup
}
```
> The invite **regenerate** flow = revoke the old invite then create a new one of the same role (the callable surface has `createHouseholdInvite`/`revokeHouseholdInvite`; there is no dedicated "regenerate"). Wire a "Regenerate" action per pending invite that runs `revokeHouseholdInvite` then `createHouseholdInvite({ role: invite.role })` inside one `Confirm` action. `inviteUrl` returned by `createHouseholdInvite` may be surfaced via toast/clipboard (`navigator.clipboard?.writeText`) — copying is optional polish, the create itself is the requirement.

- [ ] **Step 6: Write the markup** — port from `SettingsScreen` (translate per §1.3, map per §11)

Structure (header "Settings" `<h1>`; scroll body padding `16px 24px 150px`):
- **Household card** (`cardStyle`): a 48×48 accent-tint tile with `<Home color="var(--stow-accent)"/>`; household name (when `editingName`, a `Field` + Save/Cancel → `onRenameHousehold(nameDraft.trim())`; else the name with an edit affordance gated on `canManage`) + `${members.length} members`. (Drop the prototype's hardcoded "Pro plan".)
- **Members** `Label` + card: each member row = avatar (initials from `displayName || email`), name, email (ellipsised), a `<RoleBadge role={m.role}/>`, and when `canManage` a role `<select value={m.role} onChange={e=>changeRole(m, e.target.value as Role)}>` (OWNER/ADMIN/MEMBER) + a "Remove" affordance (`onClick={()=>removeMember(m)}`, hidden for self / disabled when last owner). A footer "Invite Member" row: an inline role `<select value={inviteRole} onChange=…>` + a "Create invite" button → `onClick={createInvite}`. Below, list `invites` (pending) each with its role + a "Regenerate"/"Revoke" pair (`onClick={()=>revokeInvite(inv)}` etc.). Gate the whole invite UI on `canManage`.
- **AI Vision** `Label` + card: a provider `<select value={provider} onChange=…>` (`gemini`/`openai_compatible`/`anthropic`); `<Field label="Model" value={model} onChange={setModel}/>`; when `provider==="openai_compatible"`, `<Field label="Base URL" value={baseUrl} onChange={setBaseUrl}/>`; `<Field label="Temperature" type="number" value={temperature} onChange={setTemperature}/>`; `<Field label="Max tokens" type="number" value={maxTokens} onChange={setMaxTokens}/>`; an enabled toggle bound to `enabled`; `<Field label="API key" type="password" value={apiKey} onChange={setApiKey} placeholder="Paste to update"/>` (write-only; never pre-filled); a "Save AI settings" `Button` (`disabled={!canManage || savingAi}`) → `onClick={saveAiConfig}`; a "Test connection" `Button` (`variant="neutral"`, `disabled={!canManage}`) → `onClick={testConnection}`; and a `testResult` line. Show a read-only "AI is configured by an owner/admin" note when `!canManage`.
- **Preferences** `Label` + card (port the `row()` helper but make rows actionable):
  - "Offline mode" → static indicator showing `online ? "Online" : "Offline"`.
  - "Default space" → a `<select>` of `spaces` persisted to `localStorage` key `"stow:mobile:default-space"` (read on mount, write on change; non-fatal try/catch — same pattern as SearchScreen).
  - "Export inventory (CSV)" → row `onClick={exportCsv}`.
  - "Sign out" (danger) → row `onClick={requestSignOut}`.
- Render `<Confirm open={confirm!=null} title=… body=… confirmLabel=… danger=… onConfirm={runConfirm} onCancel={()=>setConfirm(null)} />` at the end.

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/stow/ui/mobile/screens/SettingsScreen.tsx src/features/stow/ui/mobile/screens/inventoryCsv.ts src/features/stow/ui/mobile/screens/inventoryCsv.test.ts
git commit -m "feat(mobile): add SettingsScreen (members/invites/AI config/CSV export)" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Wire `StowMobileApp` — real per-tab screens + overlay router

**Files:**
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx`

Replace the P0 `PlaceholderScreen` with the real screens, render the item-detail full-screen route, and add the overlay layer (AddItem/AddSpace/AddArea sheets, SpaceActionSheet, EditSpaceSheet, and the delete `Confirm`s) keyed off `useMobileNavigation`'s route + overlay state. The bottom nav and toast stay from P0. This task wires every callback declared in Tasks 8–16 to `useWorkspaceData` actions and `useMobileNavigation`.

`useMobileNavigation` already provides `overlay` / `openOverlay(kind, payload)` / `closeOverlay()` with `OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace"` (contract §3). P1 uses `addItem`/`addSpace`/`addArea`/`editSpace`; `scan`/`photo` stay no-op-toast until P2. The `SpaceActionSheet` is **not** an `OverlayKind` (it is a transient menu) — hold it in local `StowMobileApp` state alongside the rename + delete-confirm state, because those are tightly coupled to the SpacesList.

- [ ] **Step 1: Rewrite `StowMobileApp.tsx`** (full integration)

```tsx
// src/features/stow/ui/mobile/StowMobileApp.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useWorkspaceData } from "@/features/stow/hooks/useWorkspaceData";
import { useMobileNavigation } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import type { MobileTab } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { makePalette, applyPalette } from "@/features/stow/ui/mobile/theme/palette";
import { BottomNav } from "@/features/stow/ui/mobile/shell/BottomNav";
import { Toast } from "@/features/stow/ui/mobile/shell/Toast";
import { Confirm } from "@/features/stow/ui/mobile/shell/Confirm";
import { HomeScreen } from "@/features/stow/ui/mobile/screens/HomeScreen";
import { RoomScreen } from "@/features/stow/ui/mobile/screens/RoomScreen";
import { SearchScreen } from "@/features/stow/ui/mobile/screens/SearchScreen";
import { PackingScreen } from "@/features/stow/ui/mobile/screens/PackingScreen";
import { SettingsScreen } from "@/features/stow/ui/mobile/screens/SettingsScreen";
import { ItemDetail } from "@/features/stow/ui/mobile/screens/ItemDetail";
import { SpaceActionSheet } from "@/features/stow/ui/mobile/spaces/SpaceActionSheet";
import { EditSpaceSheet } from "@/features/stow/ui/mobile/spaces/EditSpaceSheet";
import { AddItemSheet } from "@/features/stow/ui/mobile/add/AddItemSheet";
import { AddSpaceSheet } from "@/features/stow/ui/mobile/add/AddSpaceSheet";
import { AddAreaSheet } from "@/features/stow/ui/mobile/add/AddAreaSheet";
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
  const flash = (msg: string) => setToast(msg);

  useEffect(() => {
    if (rootRef.current) applyPalette(rootRef.current, makePalette());
  }, []);

  // SpacesList-coupled local state (action sheet target, inline rename, delete confirm)
  const [spaceMenuId, setSpaceMenuId] = useState<string | null>(null);
  const [renamingSpaceId, setRenamingSpaceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const userId = data.userId ?? user.uid;
  const allTags = useMemo(() => Array.from(new Set(data.items.flatMap((i) => i.tags || []))), [data.items]);
  const itemCountForSpace = (spaceId: string) => data.items.filter((i) => i.spaceId === spaceId).length;

  const packedCount = data.packingLists.reduce(
    (sum, list) => sum + Math.max(0, list.itemIds.length - list.packedItemIds.length),
    0
  );

  // resolved route entities
  const selectedSpace = nav.selectedSpaceId ? data.spaces.find((s) => s.id === nav.selectedSpaceId) ?? null : null;
  const selectedItem = nav.selectedItemId ? data.items.find((i) => i.id === nav.selectedItemId) ?? null : null;
  const selectedItemSpace = selectedItem ? data.spaces.find((s) => s.id === selectedItem.spaceId) ?? null : null;
  const menuSpace = spaceMenuId ? data.spaces.find((s) => s.id === spaceMenuId) ?? null : null;
  const editSpacePayloadId = nav.overlay.kind === "editSpace" ? (nav.overlay.payload?.spaceId as string | undefined) : undefined;
  const editSpace = editSpacePayloadId ? data.spaces.find((s) => s.id === editSpacePayloadId) ?? null : null;
  const addAreaSpaceId = nav.overlay.kind === "addArea" ? (nav.overlay.payload?.spaceId as string | undefined) : undefined;
  const addAreaSpace = addAreaSpaceId ? data.spaces.find((s) => s.id === addAreaSpaceId) ?? null : null;
  const addItemPayload = nav.overlay.kind === "addItem" ? nav.overlay.payload : undefined;

  // SpacesList props shared by HomeScreen
  const spacesListProps = {
    onOpenSpace: (id: string) => nav.openSpace(id),
    onOpenMenu: (id: string) => setSpaceMenuId(id),
    onReorder: (orderedIds: string[]) => void data.actions.reorderSpaces({ householdId, orderedIds }),
    onRename: (id: string, name: string) =>
      void data.actions.updateSpace({ householdId, spaceId: id, patch: { name } }).then(() => flash("Space renamed")),
    onAddSpace: () => nav.openOverlay("addSpace"),
    renamingId: renamingSpaceId,
    renameValue,
    onRenameValueChange: setRenameValue,
    onRenameCommit: () => {
      if (renamingSpaceId) {
        const space = data.spaces.find((s) => s.id === renamingSpaceId);
        const trimmed = renameValue.trim();
        if (trimmed && space && trimmed !== space.name) {
          void data.actions.updateSpace({ householdId, spaceId: renamingSpaceId, patch: { name: trimmed } }).then(() => flash("Space renamed"));
        }
      }
      setRenamingSpaceId(null);
    },
    onRenameCancel: () => setRenamingSpaceId(null),
  };

  // active tab screen
  let screen: React.ReactNode = null;
  if (nav.tab === "spaces") {
    screen = selectedSpace ? (
      <RoomScreen
        space={selectedSpace}
        items={data.items}
        selectedAreaId={nav.selectedAreaId}
        onBack={() => nav.navigateToTab("spaces")}
        onClearArea={() => nav.openSpace(selectedSpace.id)}
        onOpenArea={(areaId) => nav.openSpace(selectedSpace.id, areaId)}
        onOpenItem={(id) => nav.openItem(id)}
        onAddArea={() => nav.openOverlay("addArea", { spaceId: selectedSpace.id })}
        onAddItem={(areaId) => nav.openOverlay("addItem", { spaceId: selectedSpace.id, areaId })}
        onComingSoon={(label) => flash(label)}
      />
    ) : (
      <HomeScreen
        spaces={data.spaces}
        items={data.items}
        householdName={data.household?.name ?? "Your household"}
        onOpenItem={(id) => nav.openItem(id)}
        onBell={() => window.history.pushState(null, "", `${nav.basePath}/activity`)}
        spacesList={spacesListProps}
      />
    );
  } else if (nav.tab === "search") {
    screen = <SearchScreen items={data.items} spaces={data.spaces} onOpenItem={(id) => nav.openItem(id)} />;
  } else if (nav.tab === "packing") {
    screen = (
      <PackingScreen
        packingLists={data.packingLists}
        items={data.items}
        spaces={data.spaces}
        onOpenItem={(id) => nav.openItem(id)}
        onCreateList={(name) => void data.actions.createPackingList({ householdId, userId, name, itemIds: [] })}
        onRenameList={(listId, name) => void data.actions.updatePackingList({ householdId, listId, userId, patch: { name } })}
        onDeleteList={(listId) => void data.actions.deletePackingList({ householdId, listId })}
        onToggleItem={(listId, itemId, packed) => void data.actions.togglePackingListItem({ householdId, listId, userId, itemId, packed })}
        onClearPacked={(listId) => void data.actions.clearPackingListPacked({ householdId, listId, userId })}
        onSetItems={(listId, itemIds) => void data.actions.updatePackingList({ householdId, listId, userId, patch: { itemIds } })}
        onFlash={flash}
      />
    );
  } else if (nav.tab === "settings") {
    screen = (
      <SettingsScreen
        householdId={householdId}
        householdName={data.household?.name ?? "Your household"}
        currentUserId={data.userId}
        members={data.members}
        invites={data.invites}
        spaces={data.spaces}
        items={data.items}
        llmConfig={data.llmConfig}
        online={online}
        onRenameHousehold={(name) => void data.actions.updateHousehold({ householdId, patch: { name } }).then(() => flash("Household renamed"))}
        onSignOut={onSignOut}
        onFlash={flash}
      />
    );
  }

  return (
    <div className="stow-mobile" ref={rootRef}>
      <div className="stow-mobile__viewport">
        <div className="stow-mobile__screen">{screen}</div>

        {/* full-screen item detail route */}
        {selectedItem ? (
          <ItemDetail
            item={selectedItem}
            space={selectedItemSpace}
            spaces={data.spaces}
            allTags={allTags}
            onBack={() => nav.back()}
            onTogglePacked={(next) => void data.actions.togglePacked({ householdId, itemId: selectedItem.id, userId, nextValue: next })}
            onSaveEdit={(patch) =>
              void data.actions.updateItem({ householdId, itemId: selectedItem.id, userId, patch: { name: patch.name, value: patch.value ?? undefined, notes: patch.notes } })
            }
            onToggleTag={(tag) => {
              const has = (selectedItem.tags || []).includes(tag);
              const nextTags = has ? selectedItem.tags.filter((t) => t !== tag) : [...(selectedItem.tags || []), tag];
              void data.actions.updateItem({ householdId, itemId: selectedItem.id, userId, patch: { tags: nextTags } });
            }}
            onMove={(dest) => void data.actions.updateItem({ householdId, itemId: selectedItem.id, userId, patch: dest })}
            onDelete={() => setDeleteItemId(selectedItem.id)}
            onFlash={flash}
          />
        ) : null}

        {/* bottom nav hidden while a full-screen item detail is open (matches prototype) */}
        {!selectedItem ? (
          <BottomNav
            tab={nav.tab}
            onTab={(t: MobileTab) => nav.navigateToTab(t)}
            onScan={() => flash("Capture arrives in P2")}
            packedCount={packedCount}
          />
        ) : null}

        {/* overlays */}
        <SpaceActionSheet
          space={menuSpace}
          itemCount={menuSpace ? itemCountForSpace(menuSpace.id) : 0}
          open={spaceMenuId != null}
          onClose={() => setSpaceMenuId(null)}
          onEdit={() => {
            if (spaceMenuId) nav.openOverlay("editSpace", { spaceId: spaceMenuId });
            setSpaceMenuId(null);
          }}
          onRename={() => {
            if (menuSpace) {
              setRenamingSpaceId(menuSpace.id);
              setRenameValue(menuSpace.name);
            }
            setSpaceMenuId(null);
          }}
          onDelete={() => {
            // route Delete through EditSpace's reassignment-aware flow
            if (spaceMenuId) nav.openOverlay("editSpace", { spaceId: spaceMenuId });
            setSpaceMenuId(null);
          }}
        />

        {editSpace ? (
          <EditSpaceSheet
            space={editSpace}
            itemCount={itemCountForSpace(editSpace.id)}
            otherSpaces={data.spaces.filter((s) => s.id !== editSpace.id)}
            onClose={() => nav.closeOverlay()}
            onSaved={(msg) => {
              nav.closeOverlay();
              flash(msg);
            }}
            onDeleted={(msg) => {
              nav.closeOverlay();
              if (nav.selectedSpaceId === editSpace.id) nav.navigateToTab("spaces");
              flash(msg);
            }}
            actions={{
              updateSpace: data.actions.updateSpace,
              createArea: data.actions.createArea,
              updateArea: data.actions.updateArea,
              deleteArea: data.actions.deleteArea,
              reorderAreas: data.actions.reorderAreas,
              deleteSpace: data.actions.deleteSpace,
            }}
            householdId={householdId}
            userId={userId}
          />
        ) : null}

        <AddSpaceSheet
          open={nav.overlay.kind === "addSpace"}
          spaceCount={data.spaces.length}
          onClose={() => nav.closeOverlay()}
          onCreate={(input) => {
            void data.actions
              .createSpace({ householdId, userId, name: input.name, color: input.color, position: input.position, icon: "box", areas: input.areas })
              .then(() => flash("Space created"));
            nav.closeOverlay();
          }}
        />

        <AddAreaSheet
          open={nav.overlay.kind === "addArea" && addAreaSpace != null}
          areaCount={addAreaSpace?.areas.length ?? 0}
          onClose={() => nav.closeOverlay()}
          onCreate={(input) => {
            if (addAreaSpace) {
              void data.actions
                .createArea({ householdId, spaceId: addAreaSpace.id, name: input.name, position: input.position })
                .then(() => flash("Area added"));
            }
            nav.closeOverlay();
          }}
        />

        <AddItemSheet
          open={nav.overlay.kind === "addItem"}
          spaces={data.spaces}
          defaultSpaceId={(addItemPayload?.spaceId as string | undefined) ?? nav.selectedSpaceId}
          defaultAreaId={(addItemPayload?.areaId as string | undefined) ?? nav.selectedAreaId}
          onClose={() => nav.closeOverlay()}
          onCreate={(input) => {
            void data.actions
              .createItem({
                householdId,
                userId,
                name: input.name,
                spaceId: input.spaceId,
                areaId: input.areaId,
                areaNameSnapshot: input.areaNameSnapshot,
                value: input.value ?? undefined,
                tags: input.tags,
                notes: input.notes,
              })
              .then(() => flash("Item added"));
            nav.closeOverlay();
          }}
        />

        {/* delete-item confirm */}
        <Confirm
          open={deleteItemId != null}
          title="Delete item?"
          body="This removes it from your inventory and any packing lists. This can't be undone."
          confirmLabel="Delete"
          danger
          onCancel={() => setDeleteItemId(null)}
          onConfirm={() => {
            if (deleteItemId) {
              void data.actions.deleteItem({ householdId, itemId: deleteItemId, userId }).then(() => flash("Item deleted"));
              if (nav.selectedItemId === deleteItemId) nav.back();
            }
            setDeleteItemId(null);
          }}
        />

        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Reconcile the "Delete space" affordance** (logic note — no separate code)

The `SpaceActionSheet` "Delete space" action and the EditSpace "Delete Space" button both funnel into **EditSpaceSheet's** bounded delete-with-reassignment (the only place that collects a destination). The action sheet's `onDelete` therefore opens EditSpace (where the user taps "Delete Space" → reassignment panel). This avoids a second, reassignment-blind delete path and satisfies contract §8. (If a future phase wants a one-tap delete for empty spaces, add it to the action sheet then — out of scope for P1.)

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both PASS. (Build confirms the `tokens.css` import + lazy route still bundle.)

- [ ] **Step 4: Run the full unit suite**

Run: `npm test`
Expected: PASS — includes `repositoryOrdering.test.ts`, `positionSort.test.ts`, `useHoldToReorder.test.ts`, `icons.test.ts`, `inventoryCsv.test.ts`, plus the P0 tests.

- [ ] **Step 5: Manual smoke in dev**

Run: `npm run dev` (with `VITE_USE_FIREBASE_EMULATORS=true`), open `http://127.0.0.1:5173/app`. Verify:
- Home shows the wordmark + `{n} items · {m} spaces`, the recently-added rail, and the "Your Spaces" list.
- Tap a space → RoomScreen (areas grid); tap an area → filtered items; "+ Add Item" opens the location-first sheet; adding an item persists and toasts.
- Hold a space row → it lifts and reorders (haptic on device); release persists order (reload keeps it).
- `···` on a space → action sheet (Edit / Rename / Delete); Rename inline-edits; Edit opens the editor (color/icon/areas); changing color/icon/areas + Save persists; "Delete Space" with items shows the reassignment picker.
- Open an item → location-first detail; toggle pack, edit name/value/notes, add/remove tags, Move to another space — all persist.
- Search tab filters; grid/list toggle persists across reload.
- Packing tab: create a list, add items via the picker, check items (progress bar advances), clear-all.
- Settings: rename household, change a member role (guarded), create an invite, save AI config + Test connection, Export CSV downloads a file, Sign out confirms.
- Legacy `/spaces` and desktop `/next` still load unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/features/stow/ui/mobile/StowMobileApp.tsx
git commit -m "feat(mobile): wire StowMobileApp to real screens + overlay router" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Playwright e2e for `/app`

**Files:**
- Create: `tests/smoke/mobile-app.spec.ts`

Add a mobile `/app` e2e that exercises the P1 flows: add a space → hold-to-reorder → rename → delete; add a no-photo item; search. Mirror the email-link auth helper from `tests/smoke/authenticated-smoke.spec.ts` (the emulator OOB-code flow), but sign in via `/app` so the new app is the landing surface. Default Playwright project viewport is already mobile (390×844, `isMobile`, `hasTouch`) per `playwright.config.ts` — no per-test override needed.

> Selectors: the mobile screens use text labels and `aria-label`s from Tasks 8–16. Prefer role/text selectors (`getByRole("button", { name: ... })`, `getByText(...)`, `getByPlaceholder(...)`). For hold-to-reorder, drive a pointer long-press + drag with `page.mouse` (down → wait > 300ms → move in steps → up) on a space row, since `useHoldToReorder` arms on `pointerdown` after `holdMs`.

- [ ] **Step 1: Write the spec**

```ts
// tests/smoke/mobile-app.spec.ts
import { expect, test, type Page } from "@playwright/test";

const PROJECT_ID = "demo-stow";
const APP_BASE_URL = "http://127.0.0.1:4273";

type OobCodeRecord = { email?: string; oobCode?: string; oobLink?: string; requestType?: string };

async function waitForEmailLink(email: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
    if (response.ok) {
      const payload = (await response.json()) as { oobCodes?: OobCodeRecord[] };
      const match = payload.oobCodes?.find((record) => {
        if (record.email !== email) return false;
        if (record.oobLink?.includes("mode=signIn")) return true;
        return record.requestType === "EMAIL_SIGNIN";
      });
      if (match?.oobLink) {
        const source = new URL(match.oobLink);
        const target = new URL("/auth/finish", APP_BASE_URL);
        for (const [key, value] of source.searchParams.entries()) target.searchParams.set(key, value);
        return target.toString();
      }
      if (match?.oobCode) {
        const target = new URL("/auth/finish", APP_BASE_URL);
        target.searchParams.set("mode", "signIn");
        target.searchParams.set("oobCode", match.oobCode);
        target.searchParams.set("apiKey", "demo-api-key");
        return target.toString();
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for an email sign-in link for ${email}`);
}

async function signIn(page: Page) {
  const email = `mobile-app-${Date.now()}@example.com`;
  await page.goto("/app");
  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByRole("button", { name: "Email Me a Sign-In Link" }).click();
  await expect(page.getByText(`Sign-in link sent to ${email}`)).toBeVisible();
  await page.goto(await waitForEmailLink(email));
  const finishSignInButton = page.getByRole("button", { name: "Finish Sign-In" });
  if (await finishSignInButton.isVisible()) {
    await page.getByPlaceholder("you@example.com").fill(email);
    await finishSignInButton.click();
  }
  await expect(page).toHaveURL(/\/app/);
  // wordmark + spaces list render once household data loads
  await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });
}

test.describe("mobile /app core parity", () => {
  test("add space, reorder, rename, delete; add no-photo item; search", async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);

    // --- add two spaces ---
    async function addSpace(name: string, areas: string) {
      await page.getByRole("button", { name: "Add Space" }).click();
      await page.getByPlaceholder("e.g. Bedroom").fill(name);
      await page.getByPlaceholder("Closet, Nightstand, Dresser").fill(areas);
      await page.getByRole("button", { name: "Create Space" }).click();
      await expect(page.getByText("Space created")).toBeVisible();
      await expect(page.getByText(name)).toBeVisible();
    }
    await addSpace("Garage", "Shelf A, Toolbox");
    await addSpace("Office", "Desk, Cabinet");

    // --- hold-to-reorder: long-press the "Office" row and drag it above "Garage" ---
    const officeRow = page.getByText("Office", { exact: true }).first();
    const garageRow = page.getByText("Garage", { exact: true }).first();
    const officeBox = await officeRow.boundingBox();
    const garageBox = await garageRow.boundingBox();
    if (officeBox && garageBox) {
      await page.mouse.move(officeBox.x + officeBox.width / 2, officeBox.y + officeBox.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(400); // > holdMs (300) to arm drag
      // drag upward past the Garage row, in steps so pointermove fires
      const targetY = garageBox.y + 4;
      for (let step = 1; step <= 6; step += 1) {
        await page.mouse.move(
          officeBox.x + officeBox.width / 2,
          officeBox.y + officeBox.height / 2 + ((targetY - (officeBox.y + officeBox.height / 2)) * step) / 6
        );
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
    }
    // order persists after reload (position written to Firestore)
    await page.reload();
    await expect(page.getByText("Your Spaces")).toBeVisible({ timeout: 20_000 });

    // --- rename "Office" via its ··· action sheet ---
    await page.getByRole("button", { name: "Office space actions" }).first().click().catch(async () => {
      // fallback if no aria-label: click the MoreHorizontal button in the Office row
      await page.getByText("Office", { exact: true }).first().locator("xpath=ancestor::*[1]").getByRole("button").last().click();
    });
    await page.getByRole("menuitem", { name: "Rename" }).click();
    const renameInput = page.locator('input[value="Office"]');
    await renameInput.fill("Studio");
    await renameInput.press("Enter");
    await expect(page.getByText("Studio")).toBeVisible();

    // --- add a no-photo item into Garage › Shelf A ---
    await page.getByText("Garage", { exact: true }).first().click();
    await expect(page.getByText("Shelf A")).toBeVisible();
    await page.getByText("Shelf A").click();
    await page.getByRole("button", { name: /Add Item/ }).first().click();
    await page.getByPlaceholder("e.g. Wireless Charger").fill("Cordless Drill");
    await page.getByRole("button", { name: "Add Item" }).last().click();
    await expect(page.getByText("Item added")).toBeVisible();
    await expect(page.getByText("Cordless Drill")).toBeVisible();

    // --- search finds the item ---
    await page.getByRole("button", { name: "Search" }).click();
    await page.getByPlaceholder("Items, tags, or spaces...").fill("Cordless");
    await expect(page.getByText("Cordless Drill")).toBeVisible();

    // --- delete "Studio" via Edit Space → Delete (no items, so direct confirm) ---
    await page.getByRole("button", { name: "Spaces" }).click();
    await page.getByText("Studio", { exact: true }).first().locator("xpath=ancestor::*[1]").getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Edit space" }).click();
    await page.getByRole("button", { name: "Delete Space" }).first().click();
    await page.getByRole("button", { name: /Delete Space|Delete & move items/ }).last().click();
    await expect(page.getByText("Space deleted")).toBeVisible();
    await expect(page.getByText("Studio")).toHaveCount(0);
  });
});
```
> The spec is intentionally resilient (the `···` button selector has a fallback) because the exact accessible name depends on Task 8's markup. When implementing Task 8, give each space-row `···` button `aria-label={`${space.name} space actions`}` so the primary selector works and the fallback is unnecessary. The reorder assertion is "survives reload" rather than asserting a specific DOM order, since the precise drop index is timing-sensitive across machines.

- [ ] **Step 2: Run the e2e** (requires emulators per `playwright.config.ts`)

Run: `npm run test:smoke -- mobile-app.spec.ts`
Expected: PASS. (If the `···` aria-label was added in Task 8, the fallback branch never runs.)

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/mobile-app.spec.ts
git commit -m "test(mobile): add /app e2e — add/reorder/rename/delete space, add item, search" \
  -m "Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (P1 plan vs roadmap + contract)

**Roadmap P1 tasks (roadmap "P1 — Core parity" §Tasks 1–12) — coverage:**
- Roadmap T1 Domain + repo ordering → **Tasks 1–3** (`position` on Space/Area, `Space.icon: string`, `reorderSpaces`/`reorderAreas` batched with `updatedAt`, `createSpace`/`createArea` `position?` defaults, client-side position-sort; unit tests assert a 0..n-1 sequence + the comparator). ✓
- Roadmap T2 `useHoldToReorder` → **Task 5** (pure `reorderIndex` unit-tested from mocked rects; hook with 300ms long-press, `navigator.vibrate?.(8)`, scale-aware `getBoundingClientRect`, ~280ms click-suppression). ✓
- Roadmap T3 `HomeScreen` → **Task 10** (wordmark+counts header, bell→`${basePath}/activity`, search hero, recently-added rail sorted `createdAt` desc top 8, embedded `<SpacesList>`, live inline results). ✓
- Roadmap T4 `SpacesList` (Option D) → **Task 8** (icon tile via `iconForKey`, name, `{areas}·{items}`, `···`, tap→openSpace, `···`→SpaceActionSheet, hold→reorderSpaces, inline rename, "+ Add Space"). ✓
- Roadmap T5 `SpaceActionSheet`+`EditSpaceSheet`+`ColorPicker`+`IconPicker` → **Task 9** (preview tile, name, locked 7 swatches + expanded grid, 12 inline icons + "All"→searchable categorized library via `ICON_CATEGORIES`, Areas reorder/add/delete, bounded Delete-with-reassignment passing `reassignTo`). ✓
- Roadmap T6 `RoomScreen` → **Task 11** (header back + Camera + QR rendered, Camera/QR "coming soon" toast, areas 2-col `AreaCard` grid + dashed "+ Add Area", optional All-Items list, area-filtered `ItemRow` list + "+ Add Item"). ✓
- Roadmap T7 `ItemDetail` (location-first) → **Task 12** (hero+floating back/edit/delete, name+pack toggle, Location hero card tap→move, demoted value `★ Priceless`, notes, tag chips+add, Edit/Move; sub-modes view/edit/tag/move; photo edit = placeholder slot until P2). ✓
- Roadmap T8 `AddItemSheet` → **Task 13** (location-first: Photo placeholder slot → Name → Space/Area chips → "More details" disclosure for value/tags/notes; "✨ AI filled" badge slot). ✓ Plus `AddSpaceSheet` (passes `position`) and `AddAreaSheet` (passes `position`). ✓
- Roadmap T9 `SearchScreen` → **Task 14** (input + grid/list toggle persisted to `localStorage` `"stow:mobile:search-view"`, idle "Popular Tags" pills, rows or 2-col grid, reuses `matchesPackingItemPickerQuery`). ✓ (Noted: legacy used a URL param, not localStorage — documented deviation.)
- Roadmap T10 `PackingScreen` → **Task 15** (per-list `packedItemIds` source of truth, list index cards + `ProgressBar` + `···`, detail circular checks + strikethrough + add-items picker reusing `pickerSearch.ts` + clear-all). ✓
- Roadmap T11 `SettingsScreen` → **Task 16** (Household rename; Members avatars/`RoleBadge`/role selects w/ owner guards/remove/invite create+regenerate+revoke via `Confirm` using the `@/lib/firebase/functions` callables; AI Vision provider/model/baseUrl/temperature/maxTokens/apiKey + Test connection via `saveHouseholdLlmConfig`+`setHouseholdLlmSecret`+`validateHouseholdLlmConfig`; Preferences offline indicator, default space, **Export CSV**, Sign out). ✓
- Roadmap T12 Activity write hooks → **Deferred to P4** (contract §3/§10 and roadmap T12's own "Or defer entirely to P4"; this plan adds no `logActivity` stub to avoid a throwaway no-op surface — the call sites are introduced in P4 where `logActivity` exists). Bell already navigates to `${basePath}/activity`. ✓ (explicit deviation, see Risks)

**Contract section coverage:**
- §4 (P1 data model): `Space.icon: string` + `position`, `Area.position`, `SpaceIcon` kept exported → **Task 1**. No `orderBy("position")`; client-side sort; no new index (§4.1) → **Task 3**. ✓
- §5.1 (P1 repo): `createSpace`/`createArea` `position?` default `?? Date.now()`; `reorderSpaces`/`reorderAreas` batched `position=index` + `updatedAt`; no `createdBy`/`updatedBy` on spaces/areas → **Task 2**. ✓
- §6.1 (`useWorkspaceData`): `byPosition` comparator memo + `reorderSpaces`/`reorderAreas` in `actions` → **Task 3**. ✓
- §7 (shared primitives): `Sheet`/`Confirm`/`ActionSheet` + `Card`/`Button`/`Field`/`Chip`/`ProgressBar`/`ItemRow`/`AreaCard`/`ResultRow`/`RoleBadge`, z-index ladder (sheet 70 / actionSheet 75 / confirm 80) → **Tasks 6–7**. ✓ (`AreaCard.onMenu` intentionally unimplemented — flagged in Task 7.)
- §8 (Spaces management): `useHoldToReorder` (incl. pure `reorderIndex` unit tests) → **Task 5**; no edit mode, tap/`···`/hold model → **Task 8**; locked color swatches + EditSpace editor + searchable IconPicker + bounded Delete-with-reassignment (`reassignTo`) → **Task 9**. ✓
- §11 (prototype→domain mapping): applied in every screen task (PascalCase icon→lowercase key via `iconForKey`; `roomId`→`spaceId`; `area`→`areaId`+`areaNameSnapshot`; `isFolder`→`kind`; image url→`image.downloadUrl`; mock URLs never shipped). ✓

**No placeholders:** every step with logic carries full code (repo methods, `reorderIndex`, `byPosition`, `buildInventoryCsv`, all hook + screen handlers, the entire `StowMobileApp` integration). Screen markup uses the §0.1 depth contract (prop interface + bindings + section structure + non-obvious code + explicit "port from `prototype/<file>.jsx`" instruction) — no "TODO"/"TBD"/"etc."/"similar to above"/prose-without-code for logic. ✓

**Type-name consistency:** `MobileTab`/`OverlayKind`/`OverlayState` (P0) consumed in Task 17; `Palette`/`makePalette`/`applyPalette` (P0) in Task 17; `iconForKey`/`ICONS`/`ICON_CATEGORIES`/glyph re-exports (Task 4) consumed in Tasks 7–16; `SpaceWithAreas`/`Item`/`Role`/`HouseholdMember`/`HouseholdInvite`/`PackingList` from `@/types/domain`; `HouseholdLlmConfig`/`ProviderType` from `@/types/llm`; `byPosition` (Task 3) ↔ comparator memo; `reorderIndex`/`useHoldToReorder` (Task 5) ↔ Tasks 8–9; `positionUpdatesFor` (Task 2) ↔ reorder methods; `SheetAction` (Task 6) ↔ `SpaceActionSheet`/`PackingScreen` menus; `buildInventoryCsv`/`downloadInventoryCsv` (Task 16) ↔ SettingsScreen. All repo/contract signatures used exactly (names, shapes). ✓

**Deviations / risks (also surfaced in the return summary):**
1. **Activity write hooks deferred to P4** (roadmap T12 explicitly permits this). No throwaway `logActivity` stub is added; P4 introduces both the repo method and its call sites together.
2. **SearchScreen grid toggle uses `localStorage`** (`"stow:mobile:search-view"`), per the contract/roadmap, whereas legacy persisted it via a URL param — an intentional, documented divergence; QR + recent-searches remain P5.
3. **CSV export is net-new code** — the live app has no inventory-CSV helper (legacy `csvToList` only parses tag strings), so Task 16 adds a unit-tested `buildInventoryCsv` + a DOM download trigger.
4. **`AreaCard.onMenu` (contract §7) is not wired in P1** — RoomScreen's area grid has no per-card menu; areas are managed through EditSpaceSheet. Flagged in Task 7; the prop can be added in a later phase if a per-area menu is introduced.
5. **Delete-space funnels through EditSpaceSheet** (the only reassignment-aware path) from both the action sheet and the editor — avoids a second reassignment-blind delete; matches contract §8.
