# Stow Mobile Redesign — Design Spec

**Date:** 2026-06-06
**Status:** Approved direction; full phased implementation plan written (Shared API Contract + P0–P5 detailed plans under `docs/superpowers/plans/`); no code yet
**Implementation plans:** see `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md` (master index) and `…-shared-contract.md` (locked interfaces)
**Source:** Claude Design handoff bundle (`Stow Prototype.html` + 17 chat transcripts + supporting prototypes)

---

## 1. Context

Stow is a shared **household organization PWA** (React + TypeScript + Vite, Firebase Auth/Firestore/Storage/Functions, pluggable vision-LLM adapters) built on a `Spaces → Areas → Items` hierarchy.

A design handoff bundle delivered a high-fidelity **mobile, iOS-style phone prototype** of a redesigned Stow, plus the conversation history that produced it. The single most important decision in that history (chat 11):

> "the primary purpose of this app is for **homeowner organization, not insurance inventory**."

This reframes the entire product. Everything leads with **find** and **location**; price/value is demoted to a quiet secondary detail. The other through-lines the user cared about most: **reduce capture friction** (real camera, camera-first add, AI whole-shelf batch capture) and **give people a reason to come back** (household activity, "where things are" status, lending).

### Current codebase reality

The repo currently has **two parallel UIs** on the same shared data layer:

- **Legacy `/spaces`** (live default) — `src/features/stow/ui/StowApp.tsx` (~2.7k lines). URL-driven navigation; has QR generation, image-orphan cleanup, and delete-with-reassignment.
- **Desktop `/next`** (experimental) — `src/features/stow/ui/next/StowNextApp.tsx` (~3k lines). A **desktop-first 3-pane workspace** — a different form factor from the mobile prototype. Feature-complete with confirm-dialog UX, an AI-review form, and capture-mode handlers, but missing QR, image cleanup, item-photo editing, and delete-reassignment.

Both consume `useWorkspaceData` + `inventoryRepository` (`src/features/stow/hooks/useWorkspaceData.ts`, `src/features/stow/services/repository.ts`).

## 2. Goals & Non-Goals

### Goals
- Recreate the mobile prototype faithfully as the **new canonical Stow UI**, mobile-first and responsive.
- Lead every surface with **retrieval (find)** and **location**; demote value.
- Deliver frictionless capture: real camera, camera-first add, single AI scan, and **AI whole-shelf batch capture** with honest, confidence-ranked review.
- Ship full Spaces/Areas management ("Option D": gesture-driven, no edit mode, deep-but-calm color/icon customization).
- Add the retention bets the user kept circling: **household activity feed** and **lifecycle status + lending / "away from home."**
- Reuse the existing shared data layer; add only the data/backend the design requires.

### Non-Goals
- No separate rebuilt desktop workspace UI (the desktop `/next` layout is retired, not extended).
- No insurance / asset-register / value-first framing.
- **Do not ship simulated iOS hardware chrome** (status bar "9:41", dynamic island, home indicator). Those are prototype artifacts; the real PWA fills the viewport and respects OS safe-area insets.
- No unrelated refactors of legacy beyond what cutover requires.

## 3. Decisions (locked)

| Decision | Choice |
|---|---|
| Form factor | **Mobile-first, responsive** (phone canonical; wider screens get a centered max-width column) |
| Target app | **New canonical app** — replaces both `/spaces` and desktop `/next` at parity; salvage their best logic; keep shared data layer |
| This pass | **Plan only** (this spec + a phased implementation plan; no code) |
| Plan scope | **Full vision, phased** (P0–P5, including batch capture, activity feed, lending) |
| Navigation | **URL-driven** — port/extend `useStowNavigationState` (deep links, back button, QR-to-location) |
| Design tokens | **One system** — port the prototype's `makePalette` to CSS variables; retire the 3 conflicting palettes at cutover |
| Camera | **Real** via `getUserMedia` + `<input capture>` fallback |
| Home variant | Ship **retrieval-first only** (drop the value-first comparison variant) |
| Item detail | Ship **location-first only** (drop the price-first comparison variant); value stays as a quiet optional field |

## 4. Target Architecture

### 4.1 New module (decomposed — not another monolith)

```
src/features/stow/ui/mobile/
  StowMobileApp.tsx          # shell: responsive frame, tab bar + scan FAB, overlay router
  theme/
    palette.ts               # makePalette(accent, dark, radius) -> CSS variables
    tokens.css               # generated/static custom properties, light + dark
    icons.tsx                # expanded StowIcons set + category metadata
  shell/
    BottomNav.tsx            # 4 tabs + center scan FAB + packed badge
    Sheet.tsx Confirm.tsx Toast.tsx ActionSheet.tsx
    SafeArea.tsx             # env(safe-area-inset-*) wrapper
  screens/
    HomeScreen.tsx           # retrieval home (search + recently added + spaces list)
    SpacesList.tsx           # Option D managed list (reorder / ··· / rename)
    RoomScreen.tsx           # areas grid + items, or area-filtered items
    SearchScreen.tsx         # list/grid + popular tags
    ItemDetail.tsx           # location-first view / edit / tag-picker / move
    PackingScreen.tsx        # per-list templates (reconciled)
    SettingsScreen.tsx
    ActivityScreen.tsx       # bell -> household activity feed (P4)
  spaces/
    SpaceActionSheet.tsx EditSpaceSheet.tsx IconPicker.tsx ColorPicker.tsx
  capture/
    useCamera.ts             # getUserMedia capture, freeze/retake, fallback
    ScanOverlay.tsx          # single + "whole shelf" mode launcher
    PhotoSource.tsx          # camera + library source picker
    CaptureFirst.tsx         # camera-first add entry
    QuickCapture.tsx         # whole-shelf batch detection + review stack
  add/
    AddItemSheet.tsx AddSpaceSheet.tsx AddAreaSheet.tsx
  hooks/
    useMobileNavigation.ts   # wraps useStowNavigationState + overlay state
    useHoldToReorder.ts      # long-press drag w/ haptics, scale-aware
  components/
    Card.tsx ItemRow.tsx AreaCard.tsx Chip.tsx ProgressBar.tsx ... (shared primitives)
```

Reused unchanged: `useWorkspaceData`, `inventoryRepository`, `src/types/domain.ts`, `src/types/llm.ts`, `lib/firebase/{paths,storage,functions,errors}`.

### 4.2 Routing & cutover

- **During development:** mount the new app at a temporary route (e.g. `/app/*`) so legacy `/spaces` and desktop `/next` keep running untouched. The new app internally uses the same URL-driven nav model as legacy.
- **At cutover (P5):** repoint the canonical routes (`/`, `/spaces`, `/search`, `/packing`, `/settings`, `/items/:id`) to the new app; delete `StowApp.tsx` (legacy) and `next/StowNextApp.tsx` (desktop); remove the legacy + desktop token sets and the `docs/mockups` divergence; update `App.tsx` default redirect and the Playwright smoke specs.

### 4.3 Responsive strategy

- Phone is canonical: full-bleed, `env(safe-area-inset-*)` honored, bottom nav floats above the home-indicator inset.
- ≥ ~700px: center a phone-width column (~430px) over the warm radial backdrop; no separate desktop IA.
- No fake device bezel in production.

## 5. Design System

Recreate `makePalette(accent, dark, radius)` first — every component reads tokens from it.

### 5.1 Color tokens (light)
`ink #1A1A2E` · `inkSoft #2D2D44` · `inkMuted #6B6B80` · `warm #9595A8` · `border #E8E8EE` · `borderL #F0F0F5` · `surface #FFFFFF` · `canvas #F7F7FA` · `accent #E8652B` (brand orange) · `accentSoft = color-mix(accent 12%, #FFF)` · `success #2D9F6F`/`successSoft #EAFAF2` · `danger #E04545`/`dangerSoft #FFF0F0` · `shadow 0 2px 10px rgba(0,0,0,.05)` · `shadowSoft 0 1px 3px rgba(0,0,0,.04)`.

**Dark** (tokens ready, ship light first): `ink #F4F4F8` · `inkMuted #9A9AAE` · `border #2C2C3C` · `surface #181822` · `canvas #101019` · stronger shadows.

**Special:** low-confidence **amber `#C9821F`** (soft `#FBF1DD`); camera/scan dark `#0A0A12`; page backdrop `radial-gradient(120% 80% at 50% -10%, #20202c, #14141c 55%, #0d0d13)`; value-hero gradient `linear-gradient(135deg, accent, color-mix(accent 70%, #000))`.

**Space accent palette:** `#E8652B #2D9F6F #5B6ABF #C4883A #B0479A` + edit-space adds `#2A6FDB #D6336C` (7 swatches), with an expanded preset grid / picker behind a "more" affordance.

### 5.2 Radius / spacing
`radius = 12` base (themeable). Relative convention: card `radius+8`, button `radius+6`, input `radius+2`, result row `radius+4`; pills/circles `99`. Content scroll areas pad-bottom ~150px to clear the floating nav; headers top-pad for safe area.

### 5.3 Typography
- Display / wordmark: **Clash Display** (the "Stow**.**" wordmark, screen `<h1>`s) — `--stow-display`.
- Body: **Inter Tight** — `--stow-body`.
- Add the Google Fonts + Fontshare `<link>`s to `index.html` (Clash Display 500/600/700, Inter Tight 400–900). Self-host later for PWA offline if needed.

### 5.4 Glass & tints
Glass surfaces = token color at alpha (`{surface}E6`/`F2`) + `backdrop-filter: blur(20px)`. Colored chips/badges = base color + alpha-hex suffix (`{color}1A`, `22`, `33`, `55`).

### 5.5 Animations (keyframes)
`stowUp` (sheets/screens slide up), `stowPop` (dialogs), `stowToast`, `stowScan` (viewfinder line, 1.4s loop), `capSweep` (analysis band), `capPop` (detection boxes, staggered), `capDots` (analyzing ellipsis). All disabled under `prefers-reduced-motion`. Hold-to-drag uses `navigator.vibrate(8)` haptic.

### 5.6 Iconography
Lucide-style stroke icons via a shared `Svg` wrapper. Expand beyond today's 5 space icons to a categorized library: **Rooms** (Home, Bed, Sofa, Bath…), **Storage** (Box, Package, Folder, Archive…), **Kitchen** (Coffee, Utensils, Wine, Fridge…), **Outdoor** (Leaf, Car, Sun, Wrench…), plus core UI icons. Picker shows 12 inline defaults + "All" → searchable library with category chips.

## 6. Screen & Flow Specs

(Faithful to the prototype; see the handoff for pixel detail.)

1. **App shell** — floating glass **bottom nav**: Spaces (Home) · Search · **center Scan FAB** (56px, accent, floats above bar) · Packing (Package + unpacked badge) · Settings. Overlay z-ladder preserved: nav 30, sheets 70, action sheets 75–78, confirm 80, photo/capture 85, quick-capture 90, toast 90.
2. **Home (retrieval-first)** — sticky glass header with "**Stow.**" wordmark + `{items} · {spaces} tracked` + bell (→ Activity). Big "Find anything…" search hero (accent focus ring). When idle: "Recently added" horizontal rail (by `createdAt` desc) + the Spaces managed list. When typing: live inline results (name/tags/room/area) as result rows, or empty state.
3. **Spaces managed list (Option D)** — "Your Spaces" card: reorderable rows (color icon tile, name, `{areas} · {items}`, trailing `···`). Tap = open room; `···` = action sheet (Edit / Rename / Delete); **touch-and-hold = drag reorder** (no edit mode, haptic). Inline rename. "+ Add Space" footer.
4. **Room screen** — glass header with back, room name, trailing Camera + QR buttons (real). Areas as a 2-col card grid + dashed "+ Add Area"; optional "All Items" list. Inside an area: item rows or empty state + "+ Add Item."
5. **Item detail (location-first)** — full-screen overlay. Hero image (or placeholder glyph) with floating glass back/edit/delete. Content sheet overlapping hero: name + pack toggle; **Location hero card** (accent, MapPin, `Room › Area`, tappable to move); value demoted to a quiet line (`★ Priceless` when flagged); Notes; Tags (chips + add); actions (Edit, Move). Sub-modes: view / edit (name/photo/value/notes) / tag-picker / move.
6. **Search** — "Search" title; input + grid/list toggle (persisted). Idle = "Popular Tags" pills. Results = list rows or 2-col grid cards.
7. **Packing** — list index (cards with progress bar + `done/total` + ··· menu) and list detail (circular check toggles, strikethrough when packed, add-items picker, clear-all). Per-list `packedItemIds` is the source of truth (see §7.7).
8. **Settings** — Household card; Members (avatars, role badges, invite); AI Vision config (provider/model/endpoint/temp/maxTokens/key + test connection); Preferences (offline, default space, export CSV, sign out).
9. **Capture flows:**
   - **Scan FAB → ScanOverlay** — dark viewfinder, corner brackets, bouncing scan line, mode strip ("One item" / "Whole shelf").
   - **Single AI scan** — capture → upload → `visionCategorizeItemImage` → fill name/value/tags → review → save.
   - **PhotoSource** — camera (real) + library (file picker) sources for the photo field.
   - **CaptureFirst** — camera-first Add entry: photo first, then details sheet pre-filled (with "✨ AI filled" badge).
   - **QuickCapture (whole-shelf batch)** — frozen frame → on-device/Gemini multi-object detection → confidence-coded boxes (solid accent = confident, dashed amber = unsure) → retargetable destination → **review stack least-confident-first** (name/confirm/skip, ranked-guess chips, match %) → Done summary that commits items. Honest framing throughout ("one still frame, read on-device — not live video").
10. **Add sheets** — Add Item (location-first: Photo → Name → Space/Area chips → "More details" disclosure for value/tags/notes), Add Space (name + areas), Add Area (name).
11. **Edit Space sheet** — live preview tile; name; **Color** swatches (+ expanded picker); **Icon** grid (+ searchable library); **Areas** with hold-to-drag reorder / add / delete; bounded "Delete Space."
12. **Activity (P4)** — bell target: chronological household feed ("Sam added 3 items to Garage", "You moved Drill to Garage › Toolbox", "Jess marked Tent lent to …").

## 7. What Must Be Added (gap analysis)

For each: domain type · repository · rules/paths/indexes · migration.

### 7.1 Persisted ordering
- **Type:** `position: number` on `Space` and `Area`.
- **Repo:** `reorderSpaces(householdId, orderedIds)`, `reorderAreas(householdId, spaceId, orderedIds)` (batched). `subscribeSpaces` → `orderBy(position)` then name; areas sorted by position.
- **Index:** none required — ordering is applied **client-side** after the existing name-ordered subscriptions (so un-backfilled docs still render and the existing `areas` composite index stays valid). See the Shared API Contract §4.1.
- **Migration:** lazy backfill `position` from current name order on first reorder, or one-time `scripts/backfill-positions.ts` (run in P5).

### 7.2 Item lifecycle status
- **Type:** `status: 'home' | 'packed' | 'lent' | 'repair' | 'lost'` (default `home`). Keep `isPacked` for back-compat during transition.
- **Repo:** `setItemStatus(itemId, status)`.
- **Migration:** backfill `status` from `isPacked` (`true → 'packed'`, else `home`).

### 7.3 Lending / loans
- **Type:** optional `loan?: { to: string; toUid?: string; since: Timestamp; due?: Timestamp; note?: string }` on `Item` (set when `status === 'lent'`). (Fields-on-item for v1; subcollection only if it grows.)
- **Repo:** `setItemLoan` / `clearItemLoan`.
- **UI:** "Away from home" strip on home; lending controls on item detail; gentle nudges later.

### 7.4 Household activity feed
- **Path:** `households/{id}/activity/{activityId}` `{ type, actorUid, actorName, summary, spaceId?, itemId?, count?, createdAt }`.
- **Repo:** `subscribeActivity(householdId, limit)`, `logActivity(...)`.
- **Writes:** client-side on create/move/delete/status changes for v1 (Cloud Function triggers can replace later for integrity).
- **Rules:** members read; members create; no client update/delete. **Index:** none required — the `orderBy("createdAt", "desc")` query is served by Firestore's automatic single-field index.

### 7.5 Expanded icon library
- **Type:** change `Space.icon` from the 5-value `SpaceIcon` union to a free-form `icon: string` key validated at the UI boundary against a registry in `theme/icons.tsx` (avoids an ever-growing union; unknown keys fall back to a default glyph). The registry holds the glyph map + category metadata.
- **UI:** `iconForSpace` maps any key to a glyph (default fallback for unknown); picker shows 12 inline defaults + "All" → searchable library with category chips (Rooms / Storage / Kitchen / Outdoor).

### 7.6 Whole-shelf batch capture (backend + client)
- **Callable:** `visionDetectShelfItems(request)` → `{ detections: [{ label, confidence, bbox:[x,y,w,h], suggestedValue?, tags? }], provider, jobId }`.
- **Provider:** implement multi-object detection in `functions/src/providers/gemini.ts` (bounding boxes + labels + confidence); return a clear "unsupported" for providers without it.
- **Schemas:** add request/response in `functions/src/shared/schemas.ts` (+ tests).
- **Repo:** `createItemsBatch(householdId, items[])` (batched writes; one activity entry with `count`).
- **Reuse:** image-upload-to-Storage path already exists; same pattern feeds the detection call.

### 7.7 Reconcile the two "packed" systems
- **Packing tab** uses per-list `packedItemIds` as the source of truth (already implemented via packing templates).
- **Item lifecycle `status: 'packed'`** is independent ("this thing is away because it's packed") and is **not** driven by packing-list checkboxes, to avoid the confusion flagged in the chats. `isPacked` is deprecated in favor of `status` and removed at cutover.
- Document this relationship in code comments and the item detail UI copy.

### 7.8 Parity items to carry over before cutover
- QR generation per space + QR-scan-to-navigate (from legacy).
- Image-orphan cleanup on replace/delete (from legacy `bestEffortDeleteImage`).
- Delete space/area **with item reassignment** (repository already supports `reassignTo`; wire it into the new UI).
- Persisted recent searches (localStorage, from legacy).

## 8. Phasing

Each phase is shippable behind the temporary `/app` route.

- **P0 — Foundation.** Token system (`palette.ts` + `tokens.css`), fonts, app shell (responsive frame, bottom nav + scan FAB, safe-area), overlay primitives (Sheet/Confirm/Toast/ActionSheet), `useMobileNavigation`, mount at `/app`. Wire `useWorkspaceData`.
- **P1 — Core parity.** Home (retrieval), Spaces (Option D: action sheet, hold-to-drag reorder + `position`, edit-space, color/icon customization + expanded icons), Room/Area, Item detail (location-first: view/edit/tag/move), Search, Settings. Adds §7.1, §7.5.
- **P2 — Capture.** `useCamera` (real), PhotoSource, CaptureFirst, single AI scan via existing `visionCategorizeItemImage`. Image-orphan cleanup carried over (§7.8).
- **P3 — Whole-shelf batch capture.** Backend detection callable + schemas + tests (§7.6), QuickCapture review stack, `createItemsBatch`. The headline feature.
- **P4 — Retention bets.** Activity feed (§7.4) behind the bell; lifecycle status + lending / "away from home" (§7.2, §7.3).
- **P5 — Cutover.** Finish parity (QR, reassignment-on-delete, recent searches), repoint canonical routes, delete legacy + desktop next, remove old token sets, migrate data (`position`, `status`), update smoke specs + default redirect.

## 9. Testing Strategy
- **Unit (Vitest):** `makePalette`, reorder ordering math, navigation parse/encode, capture review reducer, status/loan helpers, batch-detection schema validation (functions).
- **Component:** key screens (Home, SpacesList Option D interactions, ItemDetail modes, QuickCapture review).
- **E2E (Playwright):** new flows on `/app` — add space + hold-to-drag reorder, add item (location-first), single scan (mocked), whole-shelf batch (mocked detection), packing, settings, activity. At P5, replace `next-redesign.spec.ts` and retarget the authenticated smoke spec.
- Verification (no `verify` script exists): `npm run typecheck && npm test && npm run build`; functions `npm run functions:test`; rules `npm run test:rules`; e2e `npm run test:smoke`.

## 10. Risks & Mitigations
- **Shelf-detection accuracy/cost (Gemini).** Mitigate with honest snapshot UX, confidence coding, least-confident-first review, easy skip.
- **Real camera cross-browser (iOS Safari).** `getUserMedia` with `<input capture="environment">` fallback; feature-detect.
- **Token migration regressing legacy.** Scope new tokens to the new module; remove legacy/desktop token sets only at cutover.
- **Scope.** Phasing keeps each step shippable behind `/app`; no big-bang.
- **Activity-feed integrity (client writes).** Acceptable for v1; plan a Functions-trigger upgrade path.

## 11. Open Questions (resolve during plan review)
1. Activity writes: client-side v1 vs Cloud Function triggers now? (recommend client v1)
2. Loan model: fields-on-item vs subcollection? (recommend fields v1)
3. Ship a dev-only "Tweaks" theming panel, or hardcode the default theme? (recommend dev-only, not in prod bundle)
4. Dark mode in v1 or tokens-ready-but-light-only? (recommend tokens ready, ship light)
5. Temporary dev route name (`/app` vs `/m` vs reuse `/next`)? (recommend `/app`)
