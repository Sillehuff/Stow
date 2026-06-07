# Stow Mobile Redesign — Shared API Contract (locked)

> **For agentic workers:** This document is the **single source of truth for every cross-phase interface** in the P1–P5 implementation plans. Each phase plan (`2026-06-06-stow-redesign-pN-*.md`) implements its slice against these locked signatures. If a phase needs to change a signature here, update this file first and reconcile the affected phase plans — never let two plans diverge on a shared type.
>
> **Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md`
> **Roadmap:** `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md`
> **P0 (done/template):** `docs/superpowers/plans/2026-06-06-stow-redesign-p0-foundation.md`

---

## 0. Conventions (apply to every phase plan)

- **Header:** every phase plan starts with the writing-plans header (Goal / Architecture / Tech Stack / Spec+Roadmap+Contract links) and the agentic-worker sub-skill note. Steps use checkbox (`- [ ]`) syntax.
- **TDD bite-sized steps:** write failing test → run (expect fail) → minimal impl → run (expect pass) → commit. One action per step (2–5 min).
- **Test commands:** single file `npx vitest run <path>`; full unit suite `npm test` (excludes rules + smoke); functions `npm run functions:test`; rules `npm run test:rules`; e2e `npm run test:smoke`.
- **There is no `verify` script.** "Verify" = `npm run typecheck && npm test && npm run build`.
- **Tests are pure-function / node-env only** (Vitest, no jsdom/RTL in repo). Test reducers, repo ordering math, schemas, helpers, nav parsing, hold-to-reorder index math, capture reducer. UI components are validated by manual dev load + Playwright (`tests/`), not unit DOM tests.
- **Commit trailer** on every commit message:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Do not touch** legacy `src/features/stow/ui/StowApp.tsx`, `ui/next/StowNextApp.tsx`, `ui/tabs`, `ui/item`, `ui/shared`, or canonical routes until **P5**.

### 0.1 Depth convention (how to write screen tasks without 10k lines of re-derived JSX)

The design prototypes are preserved in-repo and **are the visual source of truth**:
`docs/superpowers/design-reference/prototype/*.jsx` (see §11 for the file→component map).

For each screen/sheet task:
1. **Logic gets full code.** Repo methods, hooks, reducers, schemas, providers, migrations, nav, helpers, data-model edits, and the screen's **data wiring + event handlers** are written out in full in the plan (TDD where testable).
2. **Markup is ported, not re-derived.** State the component's **TypeScript prop interface**, the **exact `useWorkspaceData` fields/actions and `useMobileNavigation` calls it consumes**, the **section-by-section structure**, and the **non-obvious code** (token usage, conditional rendering, animations). Then instruct: *"Port the markup from `prototype/<file>.jsx` → `<Component>`, translating per §1.3 (prototype `P.x`/`St.x` → `var(--stow-x)`; prototype mock data → live domain per §11)."*
3. **No placeholders.** "TODO", "add validation", "handle errors", "similar to above" are plan failures. If a step changes code, show the code or the precise port instruction with the named prototype function.

### 0.2 Module location

All new code lives under `src/features/stow/ui/mobile/` (see roadmap "Global file-structure map"). The route page is `src/routes/StowMobileRoutePage.tsx` (P0, done). Imports use the `@/` alias.

---

## 1. Design tokens (locked in P0)

### 1.1 `theme/palette.ts`
```ts
export const DEFAULT_ACCENT = "#E8652B";
export interface PaletteInput { accent?: string; dark?: boolean; radius?: number; }
export interface Palette { /* ink, inkSoft, inkMuted, warm, border, borderL, surface, canvas,
  accent, accentSoft, success, successSoft, danger, dangerSoft, shadow, shadowSoft,
  radius, radiusCard, radiusButton, radiusInput */ }
export function makePalette(input?: PaletteInput): Palette;
export function applyPalette(el: HTMLElement, palette: Palette): void; // sets --stow-* vars
```

### 1.2 CSS custom properties (from `theme/tokens.css`, scoped to `.stow-mobile`)
`--stow-ink` `--stow-ink-soft` `--stow-ink-muted` `--stow-warm` `--stow-border` `--stow-border-l` `--stow-surface` `--stow-canvas` `--stow-accent` `--stow-accent-soft` `--stow-success` `--stow-success-soft` `--stow-danger` `--stow-danger-soft` `--stow-shadow` `--stow-shadow-soft` `--stow-radius` `--stow-radius-card` `--stow-radius-button` `--stow-radius-input` `--stow-display` `--stow-body`.

Keyframes: `stowUp` `stowPop` `stowToast` `stowScan` `capSweep` `capPop` `capDots` (all disabled under `prefers-reduced-motion`).

### 1.3 Token translation rule (prototype → our code)
Prototype components receive a palette object `P` and use inline values like `P.surface`, `P.accent`, `P.radius + 8`, plus alpha-hex suffixes (`P.accent + "1A"`). Translate:
- `P.surface` → `var(--stow-surface)`, `P.accent` → `var(--stow-accent)`, `P.inkMuted` → `var(--stow-ink-muted)`, `P.borderL` → `var(--stow-border-l)`, `P.accentSoft` → `var(--stow-accent-soft)`, etc.
- `P.radius + 8` → `var(--stow-radius-card)`; `+6` → `var(--stow-radius-button)`; `+2` → `var(--stow-radius-input)`; bare `P.radius` → `var(--stow-radius)`.
- Alpha tints `P.accent + "1A"` → `color-mix(in srgb, var(--stow-accent) 10%, transparent)` (1A≈10%, 22≈13%, 33≈20%, 55≈33%). Keep it readable; exact alpha is not critical.
- Fonts: wordmark/headers `fontFamily: "var(--stow-display)"`; body inherits `--stow-body`.
- Components do **not** take a `P` prop in our code; they read CSS vars. (Pass-through of a JS `Palette` object is only needed where a value must be computed in JS.)

---

## 2. Icons (locked in P0; expanded in P1)

`theme/icons.tsx` exports:
```ts
export const ICONS: Record<string, LucideIcon>;        // space/area icons, lowercase keys
export const FALLBACK_ICON: LucideIcon;                 // Box
export const ICON_CATEGORIES: IconCategory[];           // {key,label,icons[]}
export function iconForKey(key: string | undefined | null): LucideIcon; // ICONS[key] ?? FALLBACK
// plus shell/UI glyph re-exports
```

**`Space.icon` is a free-form `string`** validated only at the UI boundary via `iconForKey` (unknown → `FALLBACK_ICON`). Existing DB values (`home|coffee|briefcase|box|folder`) already match `ICONS` keys.

**P1 expands `ICONS` + `ICON_CATEGORIES`** to the full categorized set. Port glyphs from `prototype/icons.jsx` (lucide names in parentheses):
- Rooms: `home`(Home) `bed`(Bed) `sofa`(Sofa) `bath`(Bath) `tv`(Tv) `door`(DoorOpen)
- Storage: `box`(Box) `package`(Package) `folder`(Folder) `archive`(Archive) `briefcase`(Briefcase)
- Kitchen: `coffee`(Coffee) `utensils`(Utensils) `wine`(Wine) `fridge`(Refrigerator)
- Outdoor/Misc: `leaf`(Leaf) `car`(Car) `sun`(Sun) `wrench`(Wrench) `wash`(WashingMachine) `shirt`(Shirt) `book`(Book) `music`(Music) `heart`(Heart) `gift`(Gift) `key`(Key) `plug`(Plug) `clock`(Clock)

Picker shows 12 inline defaults + "All" → searchable library with category chips (§7 IconPicker).

---

## 3. Navigation (locked in P0; extended per phase)

`hooks/useMobileNavigation.ts`:
```ts
export type MobileTab = "spaces" | "search" | "packing" | "settings";
export interface MobileRoute { tab: MobileTab; spaceId: string|null; areaId: string|null; itemId: string|null; }
export type OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace";
export interface OverlayState { kind: OverlayKind | null; payload?: Record<string, unknown>; }
export function parseMobileRoute(pathname: string, params: URLSearchParams, basePath?: string): MobileRoute;
export function buildMobilePath(basePath: string, route: {tab?;spaceId?;areaId?;itemId?}): string;
export function useMobileNavigation(householdId: string, basePath?: string): {
  householdId, basePath, route, tab, selectedSpaceId, selectedAreaId, selectedItemId,
  overlay, navigateToTab, openSpace, openItem, back, openOverlay, closeOverlay
};
```
- `basePath` defaults `"/app"`; cutover (P5) passes `""` so the same parser drives canonical routes.
- **P2** uses existing `OverlayKind` values `scan`/`photo` for capture overlays; **add `captureFirst`** to the union and `openOverlay("captureFirst")`.
- **P3** uses overlay `scan` (whole-shelf mode launches `QuickCapture` from `ScanOverlay`); no new route needed.
- **P4** adds an **activity view**: extend with a pure helper `isActivityPath(pathname, basePath): boolean` and a `goActivity()`/route segment `/activity`; `StowMobileApp` renders `ActivityScreen` as a routed full-screen view when the path matches. Keep `MobileRoute` shape stable; add the helper rather than reshaping it. Bell button calls `navigate(\`${basePath}/activity\`)`.

---

## 4. Data model (locked) — `src/types/domain.ts`

Apply these diffs across phases (each phase adds only its own fields; keep ordering of additions consistent with this contract):

```ts
// P1
export interface Space { /* …existing… */ icon: string; position: number; }  // icon CHANGED from SpaceIcon; position ADDED
export interface Area  { /* …existing… */ position: number; }                // ADDED
// Keep `export type SpaceIcon` exported for one release if anything still imports it, but Space.icon is `string`.

// P4
export type ItemStatus = "home" | "packed" | "lent" | "repair" | "lost";
export interface ItemLoan { to: string; toUid?: string; since: Timestamp; due?: Timestamp; note?: string; }
export interface Item { /* …existing… */ isPacked: boolean; /* DEPRECATED, kept until P5 */ status: ItemStatus; loan?: ItemLoan; }
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
// P3 — src/types/llm.ts
export interface ShelfDetection { label: string; confidence: number; bbox: [number, number, number, number]; suggestedValue?: number; tags?: string[]; }
export interface VisionDetectShelfRequest { householdId: string; imageRef: { storagePath: string }; spaceId?: string; areaId?: string; areaName?: string; }
export interface VisionDetectShelfResponse { detections: ShelfDetection[]; provider: string; jobId: string; }
```

### 4.1 Normalization & migration (so un-migrated docs render before backfill)
- **Ordering (P1):** do **not** add `orderBy("position")` to Firestore queries (it would hide docs missing the field). Keep `subscribeSpaces` `orderBy("name")` and the `subscribeAreas` collection-group `where(householdId) orderBy(name)` query **unchanged** (existing composite index stays valid). Apply order **client-side** in `useWorkspaceData` (§6.1): sort by `(position ?? Number.MAX_SAFE_INTEGER)` then `name.localeCompare`. **No new Firestore index is required for ordering.**
- **Status (P4):** `normalizeItemDoc` defaults missing `status` to `data.isPacked ? "packed" : "home"`. New `createItem` writes `status: "home"`.
- **Backfill scripts (run in P5):** `scripts/backfill-positions.ts` (assign `position` by current name order per space, and per area within space), `scripts/backfill-status.ts` (`status = isPacked ? "packed" : "home"`). Until run, normalization above keeps everything rendering.

---

## 5. Repository additions — `src/features/stow/services/repository.ts`

Match existing style: `requireDb()`, `serverTimestamp()`, `writeBatch`, input as a single object. **Spaces/Areas have no `createdBy`/`updatedBy` fields** (do not add them); Items do.

### 5.1 P1 — ordering
```ts
// createSpace input gains: position?: number   (written as `position: input.position ?? Date.now()`)
// createArea input gains:  position?: number   (same default)
reorderSpaces(input: { householdId: string; orderedIds: string[] }): Promise<void>;
//   writeBatch: for each id at index i -> update space doc { position: i, updatedAt: serverTimestamp() }
reorderAreas(input: { householdId: string; spaceId: string; orderedIds: string[] }): Promise<void>;
//   writeBatch over area docs under the space -> { position: i, updatedAt: serverTimestamp() }
```
*Default `position` note:* new spaces/areas append last; callers (Add sheets) may pass an explicit `position` (= current count) for deterministic append. `Date.now()` default keeps new docs after index-based reordered docs.

### 5.2 P3 — batch create
```ts
export interface NewBatchItem {
  name: string; spaceId: string; areaId: string; areaNameSnapshot: string;
  image?: ImageRef; value?: number; tags?: string[]; notes?: string; vision?: Item["vision"];
}
createItemsBatch(input: { householdId: string; userId: string; items: NewBatchItem[] }): Promise<string[]>;
//   one writeBatch; each item set() mirrors createItem defaults (kind "item", isPacked false,
//   status "home", photoStatus/entryMode derived, createdBy/updatedBy = userId). Returns new ids.
//   Activity logging is NOT done here — P4 wires logActivity at the call site (items_added_batch, count).
```

### 5.3 P4 — activity, status, lending
```ts
logActivity(input: { householdId: string; entry: Omit<ActivityEntry,"id"|"householdId"|"createdAt"> }): Promise<void>;
//   addDoc to paths.activity(householdId) with householdId + createdAt: serverTimestamp().
subscribeActivity(householdId: string, max: number,
  onData: (state: SnapshotState<ActivityEntry>) => void, onError: (e: Error) => void): Unsubscribe;
//   query(collection(activity), orderBy("createdAt","desc"), limit(max)) — single-field index (automatic), no composite index.
setItemStatus(input: { householdId: string; itemId: string; userId: string; status: ItemStatus }): Promise<void>;
//   updateItem patch { status } (+ if status !== "lent", may clear loan via separate clearItemLoan).
setItemLoan(input: { householdId: string; itemId: string; userId: string; loan: ItemLoan }): Promise<void>;
//   updateItem patch { status: "lent", loan }.
clearItemLoan(input: { householdId: string; itemId: string; userId: string }): Promise<void>;
//   updateItem patch { status: "home", loan: deleteField()-equivalent } — use `loan: null` (normalizeItemDoc treats null/absent as undefined).
```
Extend `updateItem`'s patch `Pick` to include `status` and add `loan?: ItemLoan | null`.

`paths.ts` (P4): `activity: (h) => \`households/${h}/activity\``, `activityDoc: (h, id) => \`households/${h}/activity/${id}\``.

---

## 6. `useWorkspaceData` additions — `src/features/stow/hooks/useWorkspaceData.ts`

Return shape today: `{ household, spaces (SpaceWithAreas[]), areas, items, itemDrafts, members, invites, packingLists, llmConfig, sync, error, errorsBySource, userId, actions }`.

### 6.1 P1
- `WorkspaceActions` += `reorderSpaces`, `reorderAreas`; add them to the `actions` memo.
- Change the `spacesWithAreas` memo to order by position:
```ts
const byPosition = <T extends { position?: number; name: string }>(a: T, b: T) =>
  (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
const spacesWithAreas = spacesState.items.slice().sort(byPosition).map(space => ({
  ...space, areas: areasState.items.filter(a => a.spaceId === space.id).slice().sort(byPosition),
}));
```

### 6.2 P3
- `WorkspaceActions` += `createItemsBatch`; add to `actions` memo.

### 6.3 P4
- Add an `activity` subscription effect (like packingLists) gated on `householdId`; new state `activityState`; return `activity: activityState.items`.
- `WorkspaceErrorSource` += `"activity"`; add to `emptyErrors()` and the `error` precedence order.
- `WorkspaceActions` += `logActivity`, `setItemStatus`, `setItemLoan`, `clearItemLoan`; add to `actions` memo.

---

## 7. Shared UI primitive interfaces (implemented in P1; consumed everywhere)

Port impls from `prototype/components.jsx` (`cardStyle`, `Label`, `FieldLabel`, `Input`, `Button`, `Sheet`, `Confirm`, `Toast`, `RoleBadge`) and translate per §1.3. P0 already shipped `shell/Toast.tsx` and `shell/BottomNav.tsx`. P1 adds:

```ts
// shell/Sheet.tsx        — bottom sheet w/ scrim, grab handle, title, close, scroll body, focus trap, Escape
export function Sheet(props: { open: boolean; onClose: () => void; title: string; children: ReactNode }): JSX.Element | null;
// shell/Confirm.tsx      — centered dialog, danger confirm + cancel, Escape/scrim close
export function Confirm(props: { open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }): JSX.Element | null;
// shell/ActionSheet.tsx  — iOS action sheet: list of actions + cancel
export interface SheetAction { label: string; icon?: LucideIcon; destructive?: boolean; onSelect: () => void; }
export function ActionSheet(props: { open: boolean; title?: string; actions: SheetAction[]; onClose: () => void }): JSX.Element | null;

// components/Card.tsx     — surface card (cardStyle): { children, onClick?, style?, as? }
// components/Button.tsx   — { children, onClick?, variant?: "primary"|"neutral"|"danger"|"ghost", disabled?, style?, type? } (primary = accent bg #fff text)
// components/Field.tsx    — labeled input: { label, value, onChange, placeholder?, type?, multiline? }
// components/Chip.tsx     — pill: { label, selected?, onClick?, color?, onRemove? }
// components/ProgressBar.tsx — { value: number; total: number }  (accent fill, rounded)
// components/ItemRow.tsx  — item list row: { item: Item; onClick?; right?: ReactNode }  (thumb/glyph, name, room›area subtitle, optional status dot in P4)
// components/AreaCard.tsx — room grid card: { name: string; count?: number; onClick?; onMenu?() }
// components/ResultRow.tsx— search result row: { item: Item; query?: string; onClick? }
// components/RoleBadge.tsx— { role: Role }  (OWNER accent / ADMIN success / MEMBER warm)
```
Overlay z-index ladder (keep): nav 30, sheet 70, actionSheet 75, confirm 80, photo/capture 85, quickCapture 90, toast 90.

---

## 8. Spaces management (Option D) — P1

`hooks/useHoldToReorder.ts` (pure index math is unit-tested):
```ts
export function reorderIndex(positions: number[], from: number, pointerY: number): number; // pure: maps pointerY to target index given element tops/heights
export function useHoldToReorder<T>(opts: {
  ids: string[];
  onReorder: (orderedIds: string[]) => void;   // commit (calls reorderSpaces/reorderAreas)
  holdMs?: number;                              // default 300
}): {
  draggingId: string | null;
  bind: (id: string) => { onPointerDown; onPointerMove; onPointerUp; onPointerCancel };
  containerRef: React.RefObject<HTMLDivElement>;
  suppressClick: () => boolean;                 // true within ~280ms after a drop
};
```
- Long-press (`holdMs`) arms drag → `navigator.vibrate?.(8)`. Pointer-move maps to target index via element rects (scale-aware: read `getBoundingClientRect`). On drop, emit new `orderedIds` and start a ~280ms click-suppression window so the tap handler doesn't fire.
- **No edit mode.** Tap row = open; `···` = ActionSheet (Edit / Rename / Delete); hold = reorder.

Components: `screens/SpacesList.tsx` (port `prototype/spaces-mgmt.jsx` `SpacesManagedList` + `ReorderList`/`Grip`), `spaces/SpaceActionSheet.tsx`, `spaces/EditSpaceSheet.tsx` (port `EditSpaceSheet`; contains live preview tile, name `Field`, `ColorPicker`, `IconPicker`, Areas reorder via `useHoldToReorder`, bounded Delete with reassignment), `spaces/ColorPicker.tsx`, `spaces/IconPicker.tsx`.

Color swatches (locked): `#E8652B #2D9F6F #5B6ABF #C4883A #B0479A #2A6FDB #D6336C` + expanded grid behind "more".

Delete-with-reassignment: repo `deleteSpace`/`deleteArea` already accept `reassignTo: { spaceId, areaId, areaNameSnapshot }`; when items exist, the EditSpace/area-delete UI must collect a destination (a small space/area picker) and pass `reassignTo`; otherwise repo throws "contains items".

---

## 9. Capture interfaces — P2/P3

```ts
// hooks/useCamera.ts (P2)
export interface CameraController {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: "idle" | "starting" | "live" | "frozen" | "error" | "unsupported";
  error: string | null;
  supported: boolean;                 // feature-detect getUserMedia
  start(): Promise<void>;             // getUserMedia({video:{facingMode:"environment"}})
  stop(): void;
  capture(): Promise<Blob>;           // draw current frame to canvas -> Blob (jpeg)
  reset(): void;                      // back to live from frozen
}
export function useCamera(): CameraController;
// Fallback when !supported: callers render <input type="file" accept="image/*" capture="environment">.

// capture/PhotoSource.tsx (P2): { onClose; onPicked: (blob: Blob) => void } — camera + library picker, freeze→Retake/Use.
// components/PhotoField.tsx (P2): { value: ImageRef | null; onChange: (next: ImageRef | null) => void; onScanAI?: () => void; uploadPath: (fileName: string) => string; disabled?: boolean; onBusyChange?: (busy: boolean) => void }
//   empty = Take Photo / Library / Scan-with-AI tiles; filled = preview + Retake/Replace/Remove.
//   On pick: uploadFileToStorage(uploadPath(name), file) -> ImageRef; on replace/remove: bestEffortDeleteImage(old) (§9.1).
// capture/CaptureFirst.tsx (P2): { householdId; spaceId?; areaId?; onClose; onCreated: (itemId: string) => void } — camera-first add (photo→details sheet, AI-filled badge).
// capture/ScanOverlay.tsx (P2 single; P3 adds shelf): { onClose; onCaptureSingle: (blob: Blob) => void; onCaptureShelf?: (blob: Blob) => void } — dark viewfinder, corner brackets, stowScan line, mode strip "One item"/"Whole shelf".
```

### 9.1 Image-orphan cleanup (P2) — add to `src/lib/firebase/storage.ts`
```ts
export async function bestEffortDeleteImage(image: ImageRef | null | undefined): Promise<void>;
//   if image?.storagePath: try deleteStorageObject(image.storagePath); swallow errors (log only).
```
Call on photo replace/remove and on item delete (port the legacy behavior).

### 9.2 Single AI scan (P2)
capture/upload → `visionCategorizeItemImage({ householdId, imageRef: { storagePath }, context })` → fill `name`/`tags`/`notes` (+ value left manual) → review → save. Honest loading copy ("Reading photo…").

### 9.3 Whole-shelf batch (P3)
```ts
// capture/captureReducer.ts — pure state machine (unit-tested thoroughly)
export type CapturePhase = "analyzing" | "detected" | "review" | "destination" | "done";
export interface CaptureState {
  phase: CapturePhase;
  detections: ShelfDetection[];          // raw, as returned
  order: number[];                       // review order = indices sorted least-confident-first
  cursor: number;                        // position in `order`
  drafts: Record<number, { name: string; keep: boolean; tags: string[]; value?: number }>;
  destination: { spaceId: string | null; areaId: string | null; areaNameSnapshot: string };
}
export type CaptureAction =
  | { type: "detected"; detections: ShelfDetection[] }
  | { type: "startReview" }
  | { type: "rename"; index: number; name: string }
  | { type: "confirm"; index: number }   // keep + advance
  | { type: "skip"; index: number }      // drop + advance
  | { type: "setDestination"; destination: CaptureState["destination"] }
  | { type: "commitReady" };
export function captureReducer(state: CaptureState, action: CaptureAction): CaptureState;
export function selectCommitItems(state: CaptureState): NewBatchItem[]; // kept drafts -> NewBatchItem[]
// "least-confident-first": order = detections.map((_,i)=>i).sort((a,b)=>conf[a]-conf[b]).
// capture/QuickCapture.tsx (P3): { householdId; spaceId?; areaId?; onClose; onCommitted: (count: number) => void }
//   confidence boxes: solid var(--stow-accent) if confidence>=0.6 else dashed amber #C9821F; commit via createItemsBatch; P4 wires logActivity(items_added_batch,count) at this call site.
```

### 9.4 Backend (P3) — functions/
- `functions/src/shared/schemas.ts`: add `visionDetectShelfInputSchema` + `shelfDetectionSchema`/`visionDetectShelfResultSchema` (Zod). `bbox` = `z.tuple([z.number(),z.number(),z.number(),z.number()])`, `confidence` 0..1. Tests in `functions/test/schemas.test.ts`.
- `functions/src/providers/types.ts`: add optional `detectShelfItems?(context): Promise<ShelfDetectionResult[]>` to `VisionProviderAdapter`.
- `functions/src/providers/gemini.ts`: implement `detectShelfItems` (prompt for a JSON array of objects `{label, confidence, box_2d:[ymin,xmin,ymax,xmax] normalized 0..1000}`; map Gemini's `box_2d` → our `bbox:[x,y,w,h]` normalized 0..1). Other providers leave it undefined.
- `functions/src/vision.ts`: `visionDetectShelfItemsHandler(raw, uid)` mirroring `visionCategorizeItemImageHandler` (zod parse, `requireHouseholdMember`, `loadConfigAndSecret`, `config.enabled`, `resolveImage` household-prefix guard, `getVisionAdapter`; if `!adapter.detectShelfItems` → `HttpsError("failed-precondition","Shelf detection unsupported for this provider")`; write a `visionJobs` doc; return `{ detections, provider, jobId }`).
- `functions/src/index.ts`: export `visionDetectShelfItems = onCall(...)` mirroring `visionCategorizeItemImage`.
- `src/lib/firebase/functions.ts`: add `visionDetectShelfItems(input: VisionDetectShelfRequest): Promise<VisionDetectShelfResponse>` wrapper.

---

## 10. Activity / status / lending — P4 (UI)

- `screens/ActivityScreen.tsx` — routed full-screen view at `${basePath}/activity` (bell target). Reads `activity` from `useWorkspaceData`; rows show actor, summary, relative time, deep-link via `openItem`/`openSpace`.
- Home "Away from home" strip — component in `screens/HomeScreen.tsx`: items where `status !== "home"`; tapping opens item.
- ItemDetail lending — status control + lending sheet (borrower = member from `members` or free text, `since`/`due`/`note`) → `setItemLoan` / `clearItemLoan` / `setItemStatus`.
- Activity write hooks — wire `logActivity` at item add (`item_added`), batch (`items_added_batch` w/ count), move (`item_moved`), delete (`item_deleted`), status change (`item_status_changed`), space add/delete. Client-side writes (v1).
- `firestore.rules` (P4): add under `households/{householdId}`:
  ```
  match /activity/{activityId} {
    allow read: if isHouseholdMember(householdId);
    allow create: if isHouseholdMember(householdId);
    allow update, delete: if false;
  }
  ```
  Add a rules test in `tests/` (member can create, cannot update/delete). No new composite index (single-field `createdAt` is automatic).

---

## 11. Prototype → domain mapping

| Prototype (mock) | Domain (live) |
|---|---|
| `ROOMS[]` (`data.jsx`) | `Space` (+ nested `Area[]` via `useWorkspaceData().spaces: SpaceWithAreas[]`) |
| room `icon: "Home"|"Coffee"|"Briefcase"|"Box"` (PascalCase) | `Space.icon: string` lowercase key (`home`,`coffee`,…) → render via `iconForKey` |
| room `areas: [{name}]` | `Area` docs (`spaceId`, `name`, `position`) |
| `ITEMS[].roomId` | `Item.spaceId` |
| `ITEMS[].area` (string) | `Item.areaId` + `Item.areaNameSnapshot` |
| `ITEMS[].isFolder` | `Item.kind === "folder"` |
| `ITEMS[].image` (url) | `Item.image: ImageRef` (`downloadUrl`) — placeholder glyph when absent |
| `ITEMS[].isPacked` | `Item.isPacked` (deprecated) → `Item.status` in P4 |
| `ITEMS[].isPriceless` | `Item.isPriceless` |
| `PACKING_LISTS[]` | `PackingList` (`itemIds`, `packedItemIds`) — source of truth for the Packing tab |
| `MEMBERS[]` | `HouseholdMember` (`uid`, `displayName`/`email`, `role`) |
| `PHOTO_POOL`/`CAMERA_FEED` | real camera (`useCamera`) / file picker; never ship the mock URLs |

### Prototype file → component map
- `prototype/screens-core.jsx`: `RetrievalHome` (ship), `RoomScreen`, `SearchScreen`. *(`ValueFirstHome` — drop.)*
- `prototype/screens-detail.jsx`: `ItemDetail` (location-first), `PackingScreen`, `SettingsScreen`, `ScanOverlay`.
- `prototype/spaces-mgmt.jsx`: `SpacesManagedList` (Option D), `ReorderList`, `Grip`, `SpaceActionSheet`, `EditSpaceSheet`.
- `prototype/photo.jsx`: `PhotoField`, `PhotoSource`, `CaptureFirst`, `CornerBrackets`, `SourceTile`.
- `prototype/quick-capture.jsx`: `QuickCapture`.
- `prototype/app.jsx`: `StowApp` integration reference (find `AddItemSheet`/`AddSpaceSheet`/`AddAreaSheet`/`IconPicker`/`ColorPicker` here or in `spaces-mgmt.jsx`; wiring of tabs/overlays/toast).
- `prototype/components.jsx`: shared primitives. `prototype/icons.jsx`: glyph set.

---

## 12. Phase → contract section index
- **P1** core parity → §4(P1), §5.1, §6.1, §7, §8, §11.
- **P2** capture → §9 (useCamera/PhotoSource/PhotoField/CaptureFirst/ScanOverlay single), §9.1, §9.2.
- **P3** batch capture → §4(P3 llm), §5.2, §6.2, §9.3, §9.4.
- **P4** retention → §3(activity), §4(P4), §5.3, §6.3, §10.
- **P5** cutover → run §4.1 backfills; repoint routes (basePath `""`); delete legacy/desktop; remove old token sets; QR + recent-searches parity; smoke specs.
