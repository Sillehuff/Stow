# Report: Screens & UI shell (review-ui agent)

## Screens & UI shell

Read every file in scope in full. The subsystem is in good shape — the prior review's P0/P1 UI items (raw escape codes in EditSpaceSheet, offline-hang on Add, "Space not found" redirect, `back()` deep-link fallback, dead Camera button, re-tapping "lent", activity-log double-insert) are all genuinely fixed in current code. What remains is one correctness bug, a couple of real perf wins on the data-distribution path, and some dead code.

### P0 — correctness bugs

**1. Packing badge counts deleted items — permanently inflated, never clears**
`src/features/stow/ui/mobile/StowMobileApp.tsx:103-106`
```ts
const packedCount = data.packingLists.reduce(
  (sum, list) => sum + Math.max(0, list.itemIds.length - list.packedItemIds.length),
  0
);
```
This derives the unpacked count from **raw** `list.itemIds`, which retains ids of items deleted elsewhere. `packingProgress` in `PackingScreen.tsx:27-35` was deliberately built to filter ghost ids (see `packingProgress.test.ts:11-14` — "ignores ids that no longer resolve to items"), but this badge computation bypasses it. Failure scenario: a list has one unpacked item; the user deletes that item from its detail view; the list is now effectively empty, yet the BottomNav "packing" tab shows a red "1" badge (aria-label "1 unpacked", `BottomNav.tsx:70-92`) forever. Prior review #14 fixed exactly this class of bug inside the screen but not this header count.
Fix: build a `Set` of live item ids once (`new Set(data.items.map((i) => i.id))`) and count only unpacked ids present in it:
```ts
const liveIds = new Set(data.items.map((item) => item.id));
const packedCount = data.packingLists.reduce((sum, list) => {
  const packed = new Set(list.packedItemIds);
  return sum + list.itemIds.filter((id) => liveIds.has(id) && !packed.has(id)).length;
}, 0);
```
Wrap in `useMemo` keyed on `[data.packingLists, data.items]`.

### P1 — performance

**2. Every keystroke in Search/Home/AddItem re-renders the entire app tree, including all sheets and the full item list**
`src/features/stow/ui/mobile/StowMobileApp.tsx:54-778`
`StowMobileApp` holds all workspace data and renders the active screen plus *every* overlay (`AddItemSheet`, `AddSpaceSheet`, `AddAreaSheet`, `EditSpaceSheet`, `SpaceActionSheet`, `ActionSheet`, `Confirm`, `Toast`) as always-mounted siblings (lines 464-776). None of the screen/sheet components are wrapped in `React.memo`. The search inputs that drive re-renders live *inside* child screens (`SearchScreen.tsx:145`, `HomeScreen.tsx:133`, `AddItemSheet` fields) so local state doesn't by itself re-render the parent — but any parent re-render (a Firestore snapshot tick on any of the ~9 subscriptions in `useWorkspaceData`, a `toast`/`spaceMenuId`/`scanMenuOpen` state change) re-runs the whole `StowMobileApp` body, re-executing `data.spaces.find`, `data.items.find/filter`, `allTags` (memoized), and re-rendering the mounted-but-closed sheets. On a household with hundreds of items and a live activity feed (50-doc subscription, `useWorkspaceData.ts:224`), this is a measurable per-tick cost. Concrete win: memoize `HomeScreen`, `SearchScreen`, `PackingScreen`, `SettingsScreen`, `RoomScreen`, `ItemDetail` with `React.memo`, and gate the closed sheets behind their `open` boolean so React doesn't reconcile their subtrees when shut. `AddItemSheet`/`AddSpaceSheet`/`AddAreaSheet` are always mounted (line 556/595/617) and only early-return internally via `Sheet`'s `if (!open) return null` — but their component bodies (and `useMemo`s like `resolveInitialLocation`, `seededLocation`) still run on every parent render. Conditionally render them (`{nav.overlay.kind === "addItem" ? <AddItemSheet .../> : null}`) as is already done for `PhotoSource`/`ScanOverlay`/`QuickCapture` (lines 669-713).

**3. `ItemRow` / `ResultRow` / `GridCard` / packing rows are unmemoized in lists that re-render on every parent tick**
`src/features/stow/ui/mobile/components/ItemRow.tsx:6`, `ResultRow.tsx:4`, `SearchScreen.tsx:253-261`, `PackingScreen.tsx:465-567`
The "All Items" list in Search maps every item to an `ItemRow` with a fresh inline `onClick={() => onOpenItem(item.id)}` closure each render (`SearchScreen.tsx:259-261`), and `ItemRow` is a plain function component. Combined with finding #2, a single snapshot tick re-renders every visible row. For the documented target (garages/storage units → large inventories) rendered without virtualization, this is the dominant cost. Fix: `React.memo(ItemRow)` and hoist the click handler to take the id (`onClick={onOpenItem}` where `ItemRow` calls `onClick(item.id)`), or accept that inline closures defeat memo and instead pass a stable `onOpenItem` plus `item.id`. Lower-effort partial win: wrap `ItemRow`, `GridCard`, and the packing item button in `React.memo`; the closures still change but the row's own subtree (image + two text spans) is cheap to skip when props are referentially stable via a stable callback.

### P2 — cleanup / dead code

**4. `Card` component is dead**
`src/features/stow/ui/mobile/components/Card.tsx:10-26`
Only `cardStyle` (the exported const) is imported anywhere; the `Card` component itself has zero usages (`grep "import { Card"` and `grep "<Card"` both empty across `src/`). Remove the component, keep `cardStyle`.

**5. Dead `sheetUp` and `fadeIn` keyframes in the global stylesheet**
`src/styles.css:50-57`
Neither is referenced anywhere in `src/` (verified across `.css`/`.ts`/`.tsx`). The mobile UI animates exclusively via `stowUp`/`stowPop`/`stowToast`/`stowScan` defined in `theme/tokens.css`. Delete both blocks.

**6. `ResultRow` is a redundant pass-through wrapper**
`src/features/stow/ui/mobile/components/ResultRow.tsx:4-16`
It accepts a `query` prop it explicitly discards (`query: _query`) and renders `<ItemRow item onClick spaceName/>` with no added behavior. Its only caller (`HomeScreen.tsx:204`) never passes `query`. Replace the single usage with `ItemRow` directly and delete `ResultRow.tsx`. (Low value but it's pure duplication with a misleading unused prop.)

**7. Duplicated inline `actorColor` + `initials` helpers across two files**
`src/features/stow/ui/mobile/screens/ActivityScreen.tsx:15-33` and `src/features/stow/ui/mobile/screens/LendingSheet.tsx:15-33`
The `SWATCHES` array, `actorColor(uid)` hash, and `initials(name)` functions are byte-for-byte identical in both files. Extract to a shared module (e.g. `screens/avatar.ts`) and import in both. Concrete benefit: the swatch palette is also independently duplicated a *third* time in `ColorPicker.tsx:4` (`SPACE_SWATCHES`) and `AddSpaceSheet.tsx:7` (`SPACE_COLORS`, first 5) and `activitySelectors`/`palette` — a single source prevents them drifting.

### Verified clean

- **useHoldToReorder gestures** — hold-timer set/clear paths, movement-cancel threshold (`>9px`, line 108-109), `suppressClick` window (280ms) vs commit, pointer-capture in `EditSpaceSheet.bindGrip`, and the `idsKey`-guarded reset that skips re-sync mid-drag (line 64-70) are all correct; `reorderIndex` math is unit-tested. `commit()` slices `orderRef.current` so a concurrent ids-prop change can't corrupt the committed order. Timer cleanup on unmount (line 62) is present.
- **Effect cleanup / listener leaks** — `Toast` timer (onDone in a ref so it isn't restarted per parent tick), `SpaceQrSheet` async QR-gen with `cancelled` guard, `useDismissable` keydown add/remove + focus restore, `AddItemSheet` request-id + `liveImageRef` orphan-cleanup, `shelfPreviewUrlRef` object-URL revoke — all sound.
- **Navigation state desync** — `resolveBack` history-idx fallback, `parseMobileRoute` base-strip, `spaceMissing`/`selectedItem`-removed effects with `selfDeletingIdRef` suppression are correct and match the prior-review fixes.
- **Sheet/modal focus & scroll-lock** — `captureOverlayActive` + `inert` on the background screen and BottomNav, focus trap in `useDismissable`, Escape `stopPropagation`. Correct.
- **List keys** — every `.map` uses a stable domain id; no index keys on mutable lists.
- **Async status/move/loan flows in ItemDetail & StowMobileApp** — same-status short-circuit, lent→other single-write path, in-flight `saving` guards, and the delete flow's `selfDeletingIdRef` timeout re-arm are all correct.
- **Expensive-computation-in-render** — the heavy derivations that matter are already `useMemo`'d with correct deps. The un-memoized `savedDefaultSpaceId = readDefaultSpaceId()` on every render (StowMobileApp.tsx:99) is an intentional, documented localStorage read and is cheap.
