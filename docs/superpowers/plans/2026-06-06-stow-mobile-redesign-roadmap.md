# Stow Mobile Redesign — Implementation Roadmap

> **For agentic workers:** This is the **master roadmap** for a multi-phase effort. Each phase (P0–P5) is its own shippable, fully detailed bite-sized plan (now all written — see the index below). Every cross-phase interface (types, repo/hook signatures, shared component props, capture/activity contracts, token/icon/nav APIs) is locked in the **Shared API Contract**; phase plans implement against it and must not diverge. Steps in phase plans use checkbox (`- [ ]`) syntax.
>
> **Detailed plans (execute in order):**
> - **Contract (read first):** `2026-06-06-stow-redesign-shared-contract.md`
> - **P0** Foundation: `2026-06-06-stow-redesign-p0-foundation.md`
> - **P1** Core parity: `2026-06-06-stow-redesign-p1-core-parity.md`
> - **P2** Capture: `2026-06-06-stow-redesign-p2-capture.md`
> - **P3** Whole-shelf batch capture: `2026-06-06-stow-redesign-p3-batch-capture.md`
> - **P4** Activity + lending: `2026-06-06-stow-redesign-p4-activity-lending.md`
> - **P5** Cutover: `2026-06-06-stow-redesign-p5-cutover.md`
>
> **Visual source of truth:** the design prototypes are preserved at `docs/superpowers/design-reference/prototype/*.jsx` (phase plans cite specific functions to port).

**Goal:** Replace Stow's two divergent UIs with one canonical, mobile-first, responsive PWA that recreates the design handoff prototype — leading with retrieval and location, frictionless capture (incl. AI whole-shelf batch), full Spaces/Areas management, and the activity/lending retention bets.

**Architecture:** A new decomposed module `src/features/stow/ui/mobile/` mounted at a temporary `/app` route during development, built on the existing shared data layer (`useWorkspaceData` + `inventoryRepository`) with URL-driven navigation. At cutover it takes over the canonical routes and the legacy + desktop-next UIs are deleted.

**Tech Stack:** React 18 + TypeScript + Vite, React Router, Firebase (Auth/Firestore/Storage/Functions), plain CSS with custom-property design tokens, Vitest + Playwright, vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md`

---

## How to use this roadmap

1. Read the **Shared API Contract** first — it governs every cross-phase signature. This roadmap's per-phase sections below are the high-level map; the detailed bite-sized plans (indexed above) are what you execute.
2. Execute phases **in order P0 → P5**, each from its own detailed plan. Ship each behind `/app` until P5 cutover. Review between phases; if executing a later phase reveals a contract change, update the contract first, then reconcile affected plans.
3. Keep verification green at every commit — `npm run typecheck && npm test && npm run build` (there is **no** `verify` script). Don't touch legacy `/spaces` or desktop `/next` until **P5 cutover**.

## Assumptions (open-question defaults; change here if vetoed)
- Activity log: **client-side writes** for v1 (Functions-trigger upgrade later).
- Loan model: **fields on `Item`** (not a subcollection) for v1.
- No shipped "Tweaks" theming panel (dev-only at most).
- Dark-mode tokens defined but **ship light-only**.
- Dev route: **`/app`**.

---

## Global file-structure map

New module (responsibility per file):

```
src/features/stow/ui/mobile/
  StowMobileApp.tsx          # shell: responsive frame, renders active screen + overlays, owns toast
  theme/
    palette.ts               # makePalette(accent,dark,radius) -> token object; applyPalette() sets CSS vars
    tokens.css               # static custom-property scaffolding + keyframes (stowUp/Pop/Toast/Scan/capSweep/capPop/capDots)
    icons.tsx                # StowIcon registry (glyph map), ICON_CATEGORIES, iconForKey() fallback
  shell/
    BottomNav.tsx            # 4 tabs + center scan FAB + packed badge
    Sheet.tsx                # bottom sheet (scrim, grab handle, focus trap)
    ActionSheet.tsx          # iOS-style action sheet
    Confirm.tsx              # confirm dialog (focus trap, Escape)
    Toast.tsx                # transient toast
    SafeArea.tsx             # env(safe-area-inset-*) padding wrapper
  components/
    Card.tsx Chip.tsx ProgressBar.tsx ItemRow.tsx AreaCard.tsx ResultRow.tsx Field.tsx Button.tsx
  hooks/
    useMobileNavigation.ts   # prefix-aware URL nav (pure parseMobileRoute/buildMobilePath + hook) + overlay state
    useHoldToReorder.ts      # long-press drag, scale-aware px math, navigator.vibrate
    useCamera.ts             # getUserMedia capture + freeze/retake + <input capture> fallback
  screens/
    HomeScreen.tsx SpacesList.tsx RoomScreen.tsx SearchScreen.tsx
    ItemDetail.tsx PackingScreen.tsx SettingsScreen.tsx ActivityScreen.tsx
  spaces/
    SpaceActionSheet.tsx EditSpaceSheet.tsx IconPicker.tsx ColorPicker.tsx
  capture/
    ScanOverlay.tsx PhotoSource.tsx CaptureFirst.tsx QuickCapture.tsx captureReducer.ts
  add/
    AddItemSheet.tsx AddSpaceSheet.tsx AddAreaSheet.tsx
```

Modified outside the module:
- `src/App.tsx` — add lazy route `"/app/*" -> StowMobileRoutePage` (P0); repoint canonical routes (P5).
- `src/routes/StowMobileRoutePage.tsx` — **create** (P0): auth/bootstrap/PWA shell mirroring `StowNextRoutePage.tsx`.
- `index.html` — add Clash Display + Inter Tight font `<link>`s (P0).
- `src/types/domain.ts`, `src/types/llm.ts` — type additions (per-phase).
- `src/features/stow/services/repository.ts`, `hooks/useWorkspaceData.ts` — new actions/subscriptions (per-phase).
- `src/lib/firebase/paths.ts`, `firestore.rules`, `firestore.indexes.json` — activity collection + indexes (P1/P4).
- `functions/src/{vision.ts,index.ts,shared/schemas.ts,providers/gemini.ts}` + tests — shelf detection (P3).

## Data-model migration summary (all type diffs, one place)

```ts
// src/types/domain.ts
export type ItemStatus = "home" | "packed" | "lent" | "repair" | "lost";
export interface ItemLoan { to: string; toUid?: string; since: Timestamp; due?: Timestamp; note?: string; }

export interface Space {
  // ...existing
  icon: string;          // CHANGED from SpaceIcon union -> free-form key (UI validates via registry)
  position: number;      // ADDED (P1) — sort order
}
export interface Area {
  // ...existing
  position: number;      // ADDED (P1)
}
export interface Item {
  // ...existing
  isPacked: boolean;     // DEPRECATED — kept until P5; not written by new packing UI
  status: ItemStatus;    // ADDED (P4), default "home"
  loan?: ItemLoan;       // ADDED (P4)
}
export type ActivityType =
  | "item_added" | "items_added_batch" | "item_moved" | "item_deleted"
  | "item_status_changed" | "space_added" | "space_deleted";
export interface ActivityEntry {
  id: string; householdId: string; type: ActivityType;
  actorUid: string; actorName: string; summary: string;
  spaceId?: string; areaId?: string; itemId?: string; count?: number;
  createdAt: Timestamp;
}
```

```ts
// src/types/llm.ts (P3)
export interface ShelfDetection { label: string; confidence: number; bbox: [number, number, number, number]; suggestedValue?: number; tags?: string[]; }
export interface VisionDetectShelfRequest { householdId: string; imageRef: { storagePath: string }; spaceId?: string; areaId?: string; areaName?: string; }
export interface VisionDetectShelfResponse { detections: ShelfDetection[]; provider: string; jobId: string; }
```

**Migrations:** backfill `position` (by current name order — lazy on first reorder; one-time `scripts/backfill-positions.ts`) and `status` (`isPacked ? "packed" : "home"`). Repository `normalizeItemDoc`/space/area readers default missing `position`→large sentinel and missing `status`→derived from `isPacked` so old docs render before migration runs.

---

## P0 — Foundation

**Goal:** A themed, navigable empty shell at `/app` wired to live household data. Nothing visual-complete yet; the scaffolding everything else builds on.

**Depends on:** nothing. **Detailed plan:** `2026-06-06-stow-redesign-p0-foundation.md`.

**Files (create):** `theme/palette.ts` (+`palette.test.ts`), `theme/tokens.css`, `theme/icons.tsx` (+`icons.test.ts`), `shell/BottomNav.tsx`, `shell/Toast.tsx`, `hooks/useMobileNavigation.ts` (+`useMobileNavigation.test.ts`), `StowMobileApp.tsx`, `src/routes/StowMobileRoutePage.tsx`. *(Overlay primitives `Sheet/Confirm/ActionSheet` + base components `Card/Button/Chip/Field` are created in P1 when first consumed — YAGNI for P0.)* **Modify:** `src/App.tsx`, `index.html` (fonts); `tokens.css` is imported by `StowMobileApp.tsx`.

**Tasks:** (1) `makePalette` + `applyPalette` (test token values). (2) `tokens.css` scaffolding + keyframes. (3) Font links in `index.html`. (4) Icon registry + `iconForKey` fallback (test unknown→default). (5) `Toast` primitive. (6) `BottomNav` (4 tabs + scan FAB + badge). (7) `useMobileNavigation` — prefix-aware URL nav: pure `parseMobileRoute`/`buildMobilePath` (unit-tested) + hook + overlay state. (8) `StowMobileApp` shell rendering placeholder per-tab screens + `useWorkspaceData`. (9) `StowMobileRoutePage` (clone `StowNextRoutePage` auth/bootstrap shell). (10) Route `"/app/*"` in `App.tsx`.

**Acceptance:** `/app` loads authenticated, shows the bottom nav + scan FAB over the warm backdrop, tabs switch via URL, household data loads, `npm run typecheck && npm test && npm run build` green. Legacy/desktop untouched.

**Tests:** `palette.test.ts` (token outputs incl. `color-mix` accentSoft, dark overrides); `icons.test.ts` (known key + fallback); `useMobileNavigation.test.ts` (pure `parseMobileRoute`/`buildMobilePath` round-trip). Manual: load `/app` in dev.

---

## P1 — Core parity (the visible redesign)

**Goal:** Recreate every non-capture screen faithfully; Spaces/Areas "Option D" management fully working with persisted order and deep customization.

**Depends on:** P0.

**Data/repo additions:**
- `Space.position`, `Area.position`, `Space.icon: string` (per migration summary).
- `repository.reorderSpaces(householdId, orderedIds)` and `reorderAreas(householdId, spaceId, orderedIds)` — batched `position` writes.
- `subscribeSpaces` → `orderBy("position")` fallback name; areas sorted by `position`.
- `firestore.indexes.json` — spaces `position`; areas collectionGroup `spaceId,position`.
- `firestore.rules` — allow `position` on space/area updates (already member-writable; confirm field-level rules don't reject).
- `useWorkspaceData.actions` — expose `reorderSpaces`, `reorderAreas`.
- Wire **delete-with-reassignment** (`deleteSpace`/`deleteArea` `reassignTo`) into the new EditSpace/area-delete UI (repo already supports it).

**Files (create):** `screens/HomeScreen.tsx`, `screens/SpacesList.tsx`, `screens/RoomScreen.tsx`, `screens/SearchScreen.tsx`, `screens/ItemDetail.tsx`, `screens/PackingScreen.tsx`, `screens/SettingsScreen.tsx`, `spaces/{SpaceActionSheet,EditSpaceSheet,IconPicker,ColorPicker}.tsx`, `add/{AddItemSheet,AddSpaceSheet,AddAreaSheet}.tsx`, `components/{ItemRow,AreaCard,ResultRow,ProgressBar}.tsx`, `hooks/useHoldToReorder.ts`. **Modify:** `StowMobileApp.tsx` (route overlays), `repository.ts`, `useWorkspaceData.ts`, `domain.ts`, `paths.ts`, `firestore.rules`, `firestore.indexes.json`.

**Tasks (task-level):**
1. **Domain + repo ordering** — add `position`; `reorderSpaces`/`reorderAreas` (batched `writeBatch`, `updatedAt`/`updatedBy` stamped); subscription ordering; index defs. *Test:* reorder produces expected `position` sequence; subscription returns sorted.
2. **`useHoldToReorder`** — long-press (300ms) arms drag, `navigator.vibrate(8)`, pointer-move maps to index using element rects (scale-aware), 280ms post-drop click suppression. *Test:* index computation from mocked rects.
3. **`HomeScreen`** — sticky glass header (`Stow.` wordmark, `{items}·{spaces} tracked`, bell→`/app/activity`), search hero (accent focus ring), idle = "Recently added" rail (sort `createdAt` desc, top 8) + `<SpacesList>`, typing = live `ResultRow` results (match name/tags/space/area) or empty state.
4. **`SpacesList` (Option D)** — reorderable rows (color icon tile via `iconForKey`, name, `{areas}·{items}`, trailing `···`); tap row→`/app/spaces/:id`; `···`→`SpaceActionSheet`; hold→reorder via `useHoldToReorder`→`reorderSpaces`; inline rename; "+ Add Space"→`AddSpaceSheet`.
5. **`SpaceActionSheet` + `EditSpaceSheet` + `ColorPicker` + `IconPicker`** — action sheet (Edit/Rename/Delete); editor with live preview tile, name, color swatches (7 + expanded grid/picker), icon grid (12 + "All"→searchable categorized library), Areas section with `useHoldToReorder` + add/delete, bounded "Delete Space" (with reassignment picker when items exist).
6. **`RoomScreen`** — header (back, room name, real Camera + QR buttons), areas 2-col `AreaCard` grid + dashed "+ Add Area", optional "All Items" list; area view = filtered `ItemRow` list or empty state + "+ Add Item".
7. **`ItemDetail` (location-first)** — full-screen overlay at `/app/items/:id`; hero image/placeholder + floating glass back/edit/delete; content sheet: name + pack toggle, **Location hero card** (tap→move), demoted value line (`★ Priceless`), notes, tags (chips + add), Edit/Move actions. Sub-modes view/edit/tag/move. Edit covers name/photo/value/notes (photo editing — parity gap vs desktop-next).
8. **`AddItemSheet`** — location-first order: Photo (`PhotoField` placeholder until P2) → Name → Space/Area chip pickers (pre-selected from context) → "More details" disclosure (value/tags/notes). "✨ AI filled" badge slot.
9. **`SearchScreen`** — title + input + grid/list toggle (persist to localStorage like legacy), idle "Popular Tags" pills, results as rows or 2-col grid.
10. **`PackingScreen`** — port the existing per-list templates UX (`packedItemIds` source of truth): list index (cards + progress + ··· menu) and list detail (circular checks, strikethrough, add-items picker, clear-all). Reuse `pickerSearch.ts`.
11. **`SettingsScreen`** — Household card; Members (avatars, `RoleBadge`, role selects w/ owner guards, remove, invite create/regenerate/revoke via confirm dialogs); AI Vision config (provider/model/endpoint/temp/maxTokens/key + test connection); Preferences (offline, default space, export CSV, sign out). Reuse callable wrappers in `lib/firebase/functions`.
12. **Activity write hooks (lightweight)** — call a no-op `logActivity` stub now (full impl P4) on item add/move/delete so call sites exist. (Or defer entirely to P4 — see P4.)

**Acceptance:** All four tabs + room/area/item-detail render to prototype fidelity; create/rename/delete/recolor/re-icon/reorder spaces & areas persist; hold-to-drag reorders with haptic; item detail view/edit/tag/move works; search + packing + settings at parity with legacy (minus capture). `verify:local` green.

**Tests:** repo ordering unit tests; `useHoldToReorder` unit test; component tests for `SpacesList` (reorder + action sheet), `ItemDetail` (mode switching, move), `HomeScreen` (search filtering). Extend Playwright `/app` spec: add space → reorder → rename → delete; add no-photo item; search.

---

## P2 — Capture

**Goal:** Real camera capture and single-item AI scan; camera-first add.

**Depends on:** P1.

**Repo/backend:** none new (reuse `visionCategorizeItemImage` + `uploadFileToStorage`). Carry over **image-orphan cleanup** (`bestEffortDeleteImage` pattern) into new image flows.

**Files (create):** `hooks/useCamera.ts`, `capture/PhotoSource.tsx`, `capture/CaptureFirst.tsx`, `capture/ScanOverlay.tsx` (single mode for now), `components/PhotoField.tsx`. **Modify:** `AddItemSheet.tsx` (wire real `PhotoField`), `ItemDetail.tsx` (photo editing), `StowMobileApp.tsx` (overlay routing for photo/scan/capture-first), `useMobileNavigation.ts`.

**Tasks:** (1) `useCamera` — `getUserMedia({video:{facingMode:"environment"}})`, draw frame to canvas→Blob, freeze/retake states, permission errors, `<input type=file capture=environment>` fallback when unsupported. (2) `PhotoSource` — camera + library (file picker) source UI with iOS-style framing/shutter/flash/freeze→Retake/Use. (3) `PhotoField` — empty (Take Photo / Library / Scan with AI tiles) and filled (preview + Retake/Replace/Remove). (4) Single AI scan — capture→upload→`visionCategorizeItemImage`→fill name/value/tags→review→save; honest loading copy. (5) `CaptureFirst` — camera-first Add entry (photo→details sheet pre-filled, AI-filled badge). (6) `ScanOverlay` single mode behind scan FAB. (7) Image-orphan cleanup on replace/remove.

**Acceptance:** Add an item by photographing it (real camera or file fallback); AI scan fills fields; replacing a photo cleans the old Storage object. `verify:local` green.

**Tests:** `useCamera` fallback selection (feature-detect mock); capture flow component test with mocked `getUserMedia` + mocked vision callable. Playwright: add item via file-input fallback path.

---

## P3 — Whole-shelf batch capture (headline feature)

**Goal:** Photograph a shelf, detect every object, review least-confident-first, batch-commit — honest about the snapshot model.

**Depends on:** P2.

**Backend additions:**
- `functions/src/shared/schemas.ts` — `VisionDetectShelfRequest`/`Response` + `ShelfDetection` Zod schemas (+ `functions/test/schemas.test.ts`).
- `functions/src/providers/gemini.ts` — multi-object detection (bounding boxes + labels + confidence; map to `ShelfDetection[]`); other providers return a clear `unsupported`.
- `functions/src/vision.ts` + `functions/src/index.ts` — export callable `visionDetectShelfItems` (reuse household-storage-image validation, MIME/size/timeout guards from existing vision path).
- `src/lib/firebase/functions.ts` — client wrapper `visionDetectShelfItems`.
- `src/types/llm.ts` — the shelf types (per migration summary).

**Frontend additions:**
- `repository.createItemsBatch(householdId, items[])` — batched create; single `items_added_batch` activity entry with `count`.
- `capture/QuickCapture.tsx` + `capture/captureReducer.ts` — phases analyzing→detected→review→destination→done; confidence-coded boxes (solid accent / dashed amber `#C9821F`); retargetable destination; review stack least-confident-first with name/confirm/skip + ranked-guess chips + match %; Done summary commits via `createItemsBatch`.
- `ScanOverlay` "Whole shelf" mode → launches `QuickCapture`.

**Tasks:** (1) Schemas + tests. (2) Gemini multi-object provider + test (mock API → mapped detections). (3) `visionDetectShelfItems` callable + client wrapper. (4) `captureReducer` (pure state machine) — *test thoroughly* (sort least-confident-first, skip/confirm/rename transitions, destination retarget, commit payload). (5) `QuickCapture` UI bound to reducer. (6) `createItemsBatch` + activity. (7) Honest UX copy + confidence treatment.

**Acceptance:** With a mocked detection response, a shelf photo yields confidence-coded boxes, a least-confident-first review stack, and a batch commit that adds N items + one activity entry. Real Gemini path works behind a configured key. `verify:local` green; functions tests pass.

**Tests:** `captureReducer.test.ts` (the core — ordering, triage, commit payload); schema tests; gemini provider test; Playwright with mocked callable.

---

## P4 — Retention bets (activity + status/lending)

**Goal:** The "reason to come back" — household activity feed and living item status incl. lending / "away from home."

**Depends on:** P1 (call sites) + ideally P3 (batch activity).

**Data/backend:**
- `paths.ts` — `activity` collection + doc paths.
- `domain.ts` — `ActivityEntry`/`ActivityType`, `ItemStatus`, `ItemLoan` (per migration summary).
- `repository.ts` — `logActivity(...)`, `subscribeActivity(householdId, limit)`, `setItemStatus`, `setItemLoan`, `clearItemLoan`. Wire `logActivity` into create/move/delete/status/batch call sites.
- `useWorkspaceData.ts` — `subscribeActivity` + expose `activity`, new actions.
- `firestore.rules` — `activity`: member read, member create, no update/delete; allow `status`/`loan` on item updates.
- `firestore.indexes.json` — `activity` by `createdAt desc`.
- Migration: backfill `status` from `isPacked`.

**Files (create):** `screens/ActivityScreen.tsx`; "Away from home" strip component for `HomeScreen`; lending controls in `ItemDetail`.

**Tasks:** (1) Types + paths + rules + index. (2) Repo `logActivity`/`subscribeActivity` + wire call sites. (3) `ActivityScreen` (bell target at `/app/activity`) — chronological feed with actor, summary, relative time, deep-link to item/space. (4) `setItemStatus`/loan repo + item-detail status control + lending sheet (borrower = member or free name, since/due/note). (5) Home "Away from home" strip (items where `status!=="home"`). (6) Status backfill migration.

**Acceptance:** Adding/moving/deleting items and changing status writes activity entries that render in the feed; an item can be marked lent (with borrower) and shows in "Away from home"; status persists. `verify:local` green.

**Tests:** repo activity + status unit tests; rules test (member can create activity, cannot update/delete); `ActivityScreen` component test; Playwright: mark item lent → appears in away strip + activity.

---

## P5 — Cutover

**Goal:** Make the new app canonical; delete the old two; finish parity; migrate data.

**Depends on:** P1–P4 at parity.

**Parity to finish first:** QR generation per space + QR-scan-to-navigate (port from legacy `StowApp.tsx`); persisted recent searches (localStorage); confirm delete-with-reassignment everywhere.

**Tasks:** (1) Run/confirm migrations (`position`, `status`) — one-time `scripts/backfill-*.ts` against prod/emulator. (2) `App.tsx` — repoint `/`, `/spaces*`, `/search`, `/packing`, `/settings`, `/items/:id` to the new app; remove `/app` temp prefix (new app reads canonical routes). (3) Delete `src/features/stow/ui/StowApp.tsx` (+ legacy `ui/tabs`, `ui/item`, `ui/packing`, `ui/shared` no longer referenced) and `src/features/stow/ui/next/StowNextApp.tsx` + `StowNextRoutePage.tsx`. (4) Remove legacy `:root` hex tokens + JS `palette` and `.stow-next` OKLCH tokens from `styles.css`; remove `docs/mockups` divergence note. (5) Update Playwright: retarget `authenticated-smoke.spec.ts` to the new canonical routes; replace `next-redesign.spec.ts`. (6) Update README screenshots/notes.

**Acceptance:** Default route renders the new app; no references to deleted modules; one token system remains; all smoke specs pass; `verify` (local + emulator) green.

---

## Cross-cutting

**Verification (every commit):** `npm run typecheck && npm test && npm run build` (no `verify` script exists). Functions: `npm run functions:test`. Rules + e2e (before P3/P4 merges and at P5): `npm run test:rules`, `npm run test:smoke`. 

**Sequencing/dependencies:**
```
P0 ─> P1 ─> P2 ─> P3 ─┐
                 └> P4 ─> P5
```
P4 can start after P1 (activity call sites) but its batch-activity ties to P3.

**Risk register:** see spec §10 — shelf detection accuracy/cost (honest UX), camera cross-browser (file fallback), token migration (scope to module until P5), activity integrity (client v1, triggers later), scope (phase gating).

---

## Self-review (roadmap vs spec)
- Spec §5 design system → P0 (tokens/fonts/icons). ✓
- Spec §6 screens → P1 (non-capture) + P2/P3 (capture). ✓
- Spec §7.1 ordering → P1; §7.2 status, §7.3 loans, §7.4 activity → P4; §7.5 icons → P0/P1; §7.6 batch → P3; §7.7 packed reconciliation → P1 (packing) + P4 (status); §7.8 parity (QR/cleanup/reassignment/recent-search) → P2 (cleanup) + P5 (QR/recent) + P1 (reassignment wiring). ✓
- Spec §8 phasing → P0–P5 map 1:1. ✓
- Spec §9 testing → per-phase Tests + Cross-cutting. ✓
