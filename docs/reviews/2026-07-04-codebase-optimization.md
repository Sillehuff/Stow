# Codebase review & optimization — 2026-07-04

Full-codebase review of Stow across five subsystems (Opus 4.8 review agents), triaged
and applied here, with an independent Opus verification pass over the resulting diff.
Follows the 2026-06-09 pre-launch review; those fixes were confirmed still in place.

## Method

Five parallel read-only review agents, one per subsystem:
capture/camera, screens & UI shell, data/services, backend functions & security rules,
and build/tooling/tests. Each was told to skip already-fixed pre-launch items and to
report only findings with a concrete failure scenario or measurable win. Findings were
triaged; low-risk/high-value fixes applied; product-behavior-changing items deferred
with rationale. Baseline before changes: 214 frontend unit tests + 70 functions tests +
19 rules tests, all green.

## Applied

### Correctness (P0)

1. **Cross-household area write hole (firestore.rules).** The collection-group
   `match /{path=**}/areas/{areaId}` block gated `create`/`update` on the *incoming*
   payload's `householdId`. Because Firestore unions matching rules, a member of
   household B could write to household A's area path (`households/A/.../areas/X`) by
   sending `householdId:"B"` in the payload — the path-scoped rule denied it, but the
   collection-group rule allowed it. Fixed to `allow create, update, delete: if false`
   (read retained for the `collectionGroup("areas")` query). Legitimate area writes go
   through the path-scoped rule unaffected. **Regression test added and
   counterfactually validated**: it fails against the old rules, passes against the new.

2. **Packing badge counted deleted items (StowMobileApp.tsx).** The BottomNav "packing"
   badge derived its unpacked count from raw `list.itemIds`, which retains ids of items
   deleted elsewhere — leaving a phantom badge that never cleared. Now filters to items
   that still exist and aren't packed, memoized on `[packingLists, items]`. (The screen
   body already filtered ghost ids; only this header count bypassed it.)

### Performance / cost (P1)

3. **QR decode loop throttled (QrScanOverlay.tsx).** The scan loop ran a full
   `drawImage`+`getImageData`+jsQR decode on every animation frame (~60fps) on the
   jsQR fallback path (older iPhones). Added a 100ms throttle → ~10 decodes/sec, cutting
   3-6× the sustained CPU/GPU/battery cost while the scanner is open. rAF retained so it
   still auto-pauses when the tab is hidden; native BarcodeDetector path benefits equally.

4. **jsQR split out of the main chunk (StowMobileApp.tsx).** `QrScanOverlay` (which
   statically imports the ~15 kB jsQR decoder) is now `React.lazy` + `Suspense`. The
   decoder no longer downloads on every workspace open — it loads only when the QR
   scanner is opened. Build confirms `jsqr` moved into its own on-demand chunk.

5. **KMS decrypt cached per warm instance (functions/llmConfig.ts).** Every vision call
   re-read two Firestore docs and paid a billed KMS decrypt, even though a household's
   config/key changes rarely and a single shelf scan fans out to many categorize calls.
   Added a 60s TTL cache keyed by householdId, invalidated on every config/secret write.
   Worst-case cross-instance staleness after a key rotation is one TTL window.

6. **Shelf detection array capped (functions/vision.ts + schemas.ts).** A (mis)behaving
   provider could return an unbounded detection array that shipped whole to the client.
   Capped at 50 in the handler (before `detectionCount` is recorded) with a matching
   `.max(50)` on the result schema.

7. **`useWorkspaceData.sync` now covers activity.** The sync `fromCache`/`hasPendingWrites`
   flags omitted `activityState`, so an in-flight activity-log write could read as
   "all synced." Added to both OR-chains and the deps array.

### Hardening (P2)

8. **`extractJsonObject` fallback (functions/providers/common.ts).** The brace-slice
   fallback `JSON.parse` was unguarded; a partially-bracketed provider response threw a
   raw `SyntaxError` instead of the intended `HttpsError`. Wrapped in try/catch.

9. **`llmConfigSchema.strict()` (functions/schemas.ts).** Belt-and-suspenders so a future
   edit that swaps the save-config input schema can't silently reintroduce the
   validation/audit-field forgery hole the pre-launch review closed. (Stored configs are
   read by cast, never parsed, so no read path breaks.)

10. **Backfill scripts require `--apply`.** `backfill-positions` / `backfill-status`
    default to a dry run unless `--apply` is passed, and print the affected household
    count before writing. Without a `--household` filter these touch every household, so
    a fat-fingered invocation no longer defaults to mutating production.

### Cleanup / dead code (P2)

11. Removed the unused `Card` component (kept `cardStyle`), the `ResultRow` pass-through
    wrapper (HomeScreen now uses `ItemRow` directly), and the dead `sheetUp`/`fadeIn`
    keyframes. Extracted the byte-identical `actorColor`/`initials` helpers (duplicated in
    ActivityScreen and LendingSheet) to `screens/avatar.ts`. Removed the dead
    `"destination"` member of `CapturePhase` and the `commitReady` action (transition
    folded into the reducer's confirm/skip, which also removes a one-frame "No detections
    to review" flash at the end of shelf review).

12. **`Item.value` type** widened from `number` to `number | null` to match what every
    writer persists and `normalizeItemDoc` reads (all consumers already guard with
    `!= null`).

### Build / tooling (P2)

13. **Root `npm test` no longer double-runs the functions suite.** Changed
    `vitest run --exclude 'tests/**'` (which still collected `functions/test/**`) to
    `vitest run src scripts`. Functions tests remain owned solely by `functions:test`.

14. **Scripts are now typechecked.** Added `tsconfig.scripts.json` (resolves `@/*` and
    node types) and wired it into `typecheck`. The production-mutating backfill/seed
    scripts were previously in no tsconfig `include`.

Added targeted tests for the new backend guards (JSON-parse fallback, shelf cap) and the
rules regression test. Test totals after changes: **frontend 144** (was 214; the drop is
exactly the 70 functions tests no longer double-counted by the root runner), **functions
73** (+3), **rules 19** (+2). Typecheck (app + scripts) clean; production build clean.

## Deferred (product-behavior changes — recommend, do not auto-apply)

- **Item/draft/packing-list listener pagination + `docChanges()` incremental updates
  (data layer).** `subscribeItems` streams and re-materializes the entire collection on
  every snapshot with no `limit`. This is the largest efficiency risk as inventories grow,
  but adding pagination changes the live-full-inventory UX and needs product sign-off.

- **PWA precache narrowing (build).** Workbox precaches all ~1.3 MB of assets on SW
  install, including feature-only chunks. Narrowing to the app shell + runtime-caching the
  rest would roughly halve the install payload but changes first-visit-offline behavior for
  lazy routes. The jsQR split above already trimmed the highest-value piece.

- **`React.memo` on screen/row components (UI).** Real win for large inventories, but
  making memo actually bite requires stabilizing the callback props threaded through
  `StowMobileApp` — an invasive refactor better done deliberately than folded into this pass.

- **CI deploys only hosting** (unchanged from pre-launch #25): rules/indexes/functions
  still deploy manually and can drift from the repo.

Full per-subsystem agent reports preserved in the session scratchpad.
