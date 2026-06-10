# Stow Pre-Launch Review — 2026-06-09

Full-app review before first users: 4 parallel deep code reviews (mobile UI, client data
layer, functions backend, rules/config/PWA) + full automated check run. Every finding
below was verified against the actual code; agent findings that didn't survive
verification were discarded (notably a false "no CI / no tests exist" claim — CI runs
the full test gauntlet on PR and merge).

## Automated checks — all green

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm test` (unit) | 30 files, 161 tests pass |
| `npm run build` | pass (1788 modules) |
| `npm run functions:build` + `functions:test` | 8 files, 32 tests pass |
| `npm run test:rules` (emulator) | 7 tests pass |
| `npm run test:smoke` (Playwright + emulators) | 6 pass (47s) |

CI (`.github/workflows/firebase-hosting-{merge,pull-request}.yml`) runs all of the above
before deploying hosting. **Gap: only hosting deploys via CI — functions, Firestore
rules/indexes, and Storage rules deploy manually and can drift from the repo.**

---

## P0 — fix before users (visible breakage / first-run blockers)

### 1. New users land in an empty household and cannot add a single item
`src/features/household/useHouseholdBootstrap.ts:54-89` creates household + member +
llmConfig but **no spaces/areas/items**. The documented "seeded demo household"
(`README.md`, plan) is dead code: `normalizeSeedForHousehold` in
`src/features/stow/seed.ts:177` is imported nowhere (verified by grep). Compounding it:
`AddItemSheet` requires `name && selectedSpace && selectedArea` to submit, and
QuickCapture commit requires a destination — so a brand-new user **cannot add an item
at all** until they discover they must first create a space *and* an area. This is the
first-run experience for every user.
**Fix:** wire seeding into bootstrap (same batch), or build an explicit first-run
"create your first space" onboarding step that the Add flows funnel into.

### 2. Literal `·` / `—` escape codes render as raw text in Edit Space
`src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx:495, 529, 751` — these escapes
sit in raw JSX text (not inside `{"…"}`), so users literally see
`Areas · drag to reorder`, `No areas yet — tap Add.`, and
`This space has N items — choose where they go:`. Line 615 shows the correct
braced pattern. Three-character fix, core CRUD surface.

### 3. Adding items while offline hangs the sheet on "Saving…" forever
`src/features/stow/ui/mobile/add/AddItemSheet.tsx:276-298` (also QuickCapture commit,
AddSpaceSheet, AddAreaSheet) awaits `createItem` → `setDoc`, which with
`persistentLocalCache` (client.ts:23-29) only resolves on **server ack**. Offline, the
optimistic local write makes the item appear in the list behind the modal, but the modal
spins forever. For an offline-first inventory app (garages, basements, storage units)
this is a core-flow bug.
**Fix:** resolve the UI on the local write when offline (don't await server ack for UX
completion); show a "will sync" affordance.

### 4. White screen, no recovery, when persistence init fails (Safari private mode etc.)
`src/main.tsx:10-26` — `void renderApp()` awaits `initializeFirebaseClient()` **before**
`createRoot().render()`, and swallows rejections. If IndexedDB/persistence is
unavailable, nothing renders and the error boundary never mounts.
**Fix:** try/catch → fall back to memory cache, render error shell on failure.

---

## P1 — security hardening + serious bugs (before inviting people outside the household of trust)

### 5. Invite acceptance: no transaction and no email binding
`functions/src/invites.ts:65-96` — the `acceptedAt` single-use guard is read outside any
transaction and committed with a non-conditional `db.batch()`; two concurrent accepts of
the same token both succeed. Separately, invites are pure bearer links: the caller's
email is recorded but never compared, so anyone with the URL joins and can read the
whole household. Fix: wrap accept in `db.runTransaction` re-checking `acceptedAt`;
optionally bind invites to an email.

### 6. Member role changes not transactional → zero-owner household possible
`functions/src/members.ts:29-65` — `countOwners` and the write are separate ops. Two
owners demoting/removing each other concurrently both read count=2 and both commit,
leaving no owner (and admins can't assign OWNER, so it's unrecoverable in-app). Fix:
single `runTransaction` for count + invariant + write.

### 7. Storage rules: no size or content-type limit
`storage.rules:13-15` — any member can write any blob of any size anywhere under the
household prefix. The 10 MB / `image/*` checks in `vision.ts` only run at read time.
Fix: `request.resource.size < 10MB && request.resource.contentType.matches('image/.*')`.

### 8. Provider HTTP calls have no timeout; vision callables have no rate limit
`functions/src/providers/anthropic.ts:6`, `openaiCompatible.ts:11,52`,
`gemini.ts:107,141,148` — no `AbortController` on any provider fetch (only the storage
download has a 10s timeout). And `vision.ts:85-163` is gated only by membership — any
member can loop scans and burn the household's API key budget. Fix: 20-30s abort on
every provider fetch; per-household daily cap / cooldown.

### 9. Client can forge LLM "validated" state
`functions/src/llmConfig.ts:30-41` spreads `input.config` (whose schema includes
`lastValidatedAt`/`lastValidatedBy`) straight into the doc with `merge: true`. An admin
client can mark a garbage key as validated. Fix: strip validation/audit fields from the
client-writable schema; only `validateHouseholdLlmConfigHandler` writes them.

### 10. Invite URL base falls back to request Origin header, then localhost
`functions/src/invites.ts:31` — `APP_BASE_URL ?? originHeader ?? "http://localhost:5173"`.
If `APP_BASE_URL` is unset in prod, links can be attacker-influenced or just broken
(localhost). Fix: require `APP_BASE_URL` in prod; never build user-facing links from
Origin.

### 11. QR deep link / activity tap to a deleted space is a silent dead end
`src/features/stow/ui/mobile/StowMobileApp.tsx:214-239` — `/spaces/<deadId>` falls
through to HomeScreen with no message, URL stuck. QR labels outlive spaces — this WILL
happen. Fix: once spaces are loaded and the id resolves to nothing, show "Space not
found" + redirect.

### 12. In-app back button does nothing on deep-link entry
`src/features/stow/ui/mobile/hooks/useMobileNavigation.ts:132-134` — `back()` is an
unconditional `navigate(-1)`; opening the PWA directly on `/items/:id` or a QR link
gives history with nothing behind it. Fix: fall back to a known route when there's no
in-app history.

### 13. Dead "Camera" button in every Room header
`src/features/stow/ui/mobile/screens/RoomScreen.tsx:142` — primary-looking header action
just toasts "Camera arrives in P2". Remove or wire to the existing capture overlay.

---

## P2 — should fix soon

14. **Packing progress counts deleted items** — `PackingScreen.tsx:80-83` derives
    `total` from raw `itemIds` while rows render only resolved items; header can read
    "2 of 3 packed" forever. Derive counts from resolved items.
15. **Item create can double-insert on retry** — `StowMobileApp.tsx:544-575` (and
    QuickCapture): `logActivity` is awaited after the successful write and shares the
    same catch, so an activity failure shows "Couldn't save item. Try again." → retry
    duplicates the item. Put activity in the same batch or make it best-effort.
16. **Lent→other status uses two writes with no rollback** — `StowMobileApp.tsx:361-369`:
    `clearItemLoan` then `setItemStatus`; failure of the second strands status. Also
    re-selecting "lent" clears the loan but keeps status lent. Collapse into one patch +
    short-circuit on same status.
17. **Bootstrap ↔ invite-accept race orphans a household** —
    `useHouseholdBootstrap.ts:54-87` is non-transactional and reads a cache-eligible
    user doc; simultaneous bootstrap+accept (or two devices) last-write-wins
    `currentHouseholdId`. Make bootstrap transactional, prefer existing membership.
18. **Reorder fails wholesale if any id was deleted elsewhere** — `repository.ts:411-433`
    uses `batch.update` (rejects on missing doc). Use `set(..., {merge:true})` or
    pre-filter.
19. **Settings flashes raw Firebase error strings** — `SettingsScreen.tsx:255-360`
    bypasses `toUserErrorMessage`; map errors centrally in `callFunction`
    (`src/lib/firebase/functions.ts:17-25`).
20. **iOS home-screen icon is broken** — `public/manifest.webmanifest` ships SVG-only
    icons with `purpose: "any maskable"` and `index.html` has no `apple-touch-icon`.
    iOS needs PNGs. For a mobile-first PWA this is the install experience.
21. **App updates rely on a user tapping the refresh prompt** — `vite.config.ts:42`
    (`registerType: "prompt"`) with no periodic `registration.update()`. Stale clients
    can linger indefinitely. Add an hourly update check.
22. **Removed members keep cached household images up to 30 days** —
    `vite.config.ts:48-58` SW-caches `firebasestorage.googleapis.com` (200 entries,
    30d). Acceptable if known; shorten TTL if media privacy matters post-removal.
23. **Every shelf Quick Capture leaks one orphaned Storage image** —
    `QuickCapture.tsx:111-117` uploads the analyzed frame; nothing references or deletes
    it. Delete after detection or attach to created items.
24. **Untracked `vite.config.js` build artifact can shadow `vite.config.ts`** — Vite
    resolves `.js` before `.ts`, and `tsc -b` emits `vite.config.js/.d.ts/.tsbuildinfo`
    (untracked, currently in-sync). A future `.ts` edit + stale `.js` = silently stale
    local dev/build config. Delete the artifacts and stop emitting for the config
    (tsconfig.node noEmit).
25. **Functions/rules/indexes deploys aren't in CI** — only hosting deploys on merge.
    Document/automate `firebase deploy --only functions,firestore,storage` so rules in
    repo can't drift from prod (the collection-group `areas` query hard-fails without
    its deployed index).

## P3 — improvements

26. Sheets retain stale draft input after dismiss (`AddSpaceSheet.tsx:18-37`,
    `AddAreaSheet.tsx:16-22`) — reset on open like AddItemSheet does.
27. Library-fallback file inputs hard-code `capture="environment"`
    (`ScanOverlay.tsx:81`, `CaptureFirst.tsx:206`) — on iOS this forces the camera the
    user just denied; `PhotoField.tsx:113` has the right conditional pattern.
28. "Recently added" sorts pending-write items (null `createdAt`) to the end
    (`HomeScreen.tsx:20-22`).
29. Zod schemas: no `.max()` on any string, no `.strict()` anywhere
    (`functions/src/shared/schemas.ts`) — bound inputs that flow into prompts/paths.
30. `mapError` returns raw internal error messages to clients
    (`functions/src/index.ts:23-31`) — log detail, return generic.
31. KMS: a custom `LOCAL_SECRET_ENCRYPTION_KEY` silently bypasses KMS in prod
    (`crypto/kms.ts:26-38`) — consider requiring `KMS_KEY_NAME` whenever `K_SERVICE`
    is set. Placeholder-key rejection itself verified correct.
32. `deleteSpace` can exceed the 500-op batch limit for big spaces
    (`repository.ts:472-506`) — chunk.
33. Client trusts Firestore doc shapes via `as` casts (`repository.ts:66-107`) — thin
    runtime guard at the boundary.
34. Email-link sign-in doesn't clear stored email on terminal failure
    (`src/lib/firebase/auth.ts:64-73`).
35. Dead composite index `members(role, createdAt)` in `firestore.indexes.json:28-35`.
36. `stow-v3.jsx` prototype (1162 lines, Unsplash URLs) still at repo root — delete.
37. Item deleted by another member while you view it: URL stays `/items/:id` over Home
    with no explanation (`StowMobileApp.tsx:88,313,413`).

---

## Verified sound (worth knowing)

- **Firestore rules isolation**: per-household member checks everywhere; `settings/llmSecret`
  fully client-denied; direct member mutation blocked; bootstrap-owner exception not
  abusable cross-household (`existsAfter`/`getAfter` pattern verified); activity
  append-only; collection-group `areas` rule checks `householdId`.
- **Invite token hygiene**: `randomBytes(24)` (~192 bits), stored as SHA-256 hash only,
  equality-query lookup (no timing oracle); expiry enforced; revoke hard-deletes.
- **Callable authZ**: every callable verifies auth; roles read server-side from member
  docs, never from client input; removed members blocked on next call despite valid ID
  token; admin-cannot-touch-owner and last-owner guards hold (single-threaded).
- **Vision pipeline**: storage paths scoped to the caller's household; `image/*` + 10 MB
  enforced at download with stream destruction; no external URL fetch path.
- **Client async discipline**: request-id refs, mounted/cancelled refs, image-cleanup on
  cancel/replace/failure throughout capture and edit flows; all `onSnapshot`s have error
  handlers and unsubscribes; multi-tab persistence via `persistentMultipleTabManager`.
- **Email-link auth edge cases** handled: cross-device (email confirm form), expired link
  mapping, StrictMode double-invoke dedupe.
- **CI**: full test gauntlet (unit, typecheck, functions, rules emulator, Playwright
  smoke) blocks both PR previews and the merge→hosting deploy.
