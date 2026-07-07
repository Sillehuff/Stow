# Stow polish & hardening — 2026-07-07 audit triage + handoff

**Status: PAUSED mid-program at a clean stopping point.** A Claude session limit
(resets 1pm America/New_York) and an intermittently-unavailable safety classifier
truncated the run. This document preserves everything so a fresh session — or local
Codex (GPT-5.5) workers via the `delegate` skill — can resume with zero context.

## What this program is

A full polish/debug/enhance pass over Stow (React 19 + Vite + Firebase household
inventory PWA), following the 2026-06-09 pre-launch review and 2026-07-04 optimization
pass. Plan: fresh multi-agent audit → fix confirmed findings → deliberate perf refactor
→ deferred race tests → UI enhancement → full verification → report.

## DONE this session (safe, landed on working tree; commit pending)

1. **Repo hygiene**
   - Deleted dead untracked `src/features/stow/ui/mobile/components/ResultRow.tsx`
     (pass-through wrapper the 2026-07-04 pass already removed from imports).
   - Deleted stale merged branches: `claude/relaxed-herschel-128c34`,
     `codex/stow-next-organizer-redesign`, `fix/functions-hardening`,
     `fix/p0-launch-blockers`, `fix/rules-pwa-config`, `fix/ux-flows`, and the six
     `codex/full-audit-*` / `codex/meticulous-audit-fixes` / `codex/storage-draft-upload-fix`
     branches (all confirmed merged or superseded; memory sanctioned deletion).
   - **STILL STUCK:** worktree `.claude/worktrees/gifted-wing-5e1683` (branch
     `claude/gifted-wing-5e1683`) — a background `rm -rf` was interrupted; ~144 MB
     partially remains and its presence made `vitest run` collect a duplicate test tree
     (this is why a clean `npm test` currently double-collects and 2 tests fail under the
     stale copy). **Resume step:** `git worktree remove --force .claude/worktrees/gifted-wing-5e1683 && git worktree prune`,
     then delete branch `claude/gifted-wing-5e1683`. Re-run `npm test` — it should be
     clean once the duplicate tree is gone.

2. **CI Node runtime bump** (June 16 2026 Node-20 GH-Actions cutoff passed)
   - `.github/workflows/firebase-hosting-merge.yml` and `-pull-request.yml`:
     `node-version: 20 → 22`; replaced the SHA-pinned `action-hosting-deploy` (a
     commit that was `v0.10.0`+node24) with the released tag `@v0.11.0` (verified
     identical to that commit; v0.11.0 IS the Node-24 runtime release).
   - `functions/package.json` `engines.node: "20" → "22"`. `npm run functions:build`
     verified green after the bump.

3. **P0 fix — item edit throws for any valueless item** (CONFIRMED by hand-tracing)
   - `src/features/stow/ui/mobile/StowMobileApp.tsx` `onSaveEdit`: changed
     `value: patch.value ?? undefined` → `value: patch.value ?? null`.
   - Root cause: `ItemDetail.parseValue` returns `null` for an empty Value field
     (`ItemDetail.tsx:116`); the old `?? undefined` turned that into `undefined`;
     `repository.updateItem` spreads the patch straight into `updateDoc`
     (`repository.ts:662`); the Firestore client sets no `ignoreUndefinedProperties`
     (`client.ts:24`), so `updateDoc` throws `Unsupported field value: undefined`.
     Editing any item with no value (Passports, Tax Documents — both in the demo seed)
     and saving name/notes changes threw. `null` is correct: `Item.value` is `number | null`.
   - **Recommended class-fix for the resume session:** also strip undefined-valued keys
     at the `updateItem` write boundary (defense-in-depth so no future caller can
     reintroduce the class), plus a `repository.test.ts` case asserting `updateDoc` never
     receives `undefined`. Not done here to keep the pause-point change minimal.

## Environment left running (for the resume session)

- Firebase emulators (auth 9099, firestore 8080, storage 9199) started via
  `./scripts/with-java.sh npx firebase emulators:start --project demo-stow --only auth,firestore,storage`
  (background bash id `b66cqriul`). Java 21 confirmed present via `scripts/with-java.sh`.
- A demo household was seeded for the preview UI pass:
  `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199 GCLOUD_PROJECT=demo-stow npx tsx scripts/seed-demo.ts --uid <signed-in-uid> --email <email> --name "Huff Household"`.
  Dev server (`npm run dev`, port 5173) is wired to the emulators via
  `.env.development.local`. Sign in via the email-link flow, then pull the oob link from
  `http://127.0.0.1:9099/emulator/v1/projects/demo-stow/oobCodes` (same pattern as
  `tests/smoke/authenticated-smoke.spec.ts`). Emulators may be torn down by the time you
  resume — restart if needed.
- **Baseline UI assessment:** the app's visual foundation is strong and intentional
  (warm-orange accent, rounded cards, consistent token system in `theme/tokens.css`).
  The UI task is surgical polish + the a11y/layout fixes below, NOT a redesign.

## PENDING — the audit findings (UNVERIFIED — read this before fixing)

The 9-lens finder fan-out completed and deduped to **47 findings**. The two-verifier
adversarial pass (94 verifier agents) **all died on the session limit before running** —
so **every finding below is UNVERIFIED except the 3 marked [HAND-VERIFIED]**. Prior review
rounds marked many similar-sounding things "verified clean," and the finders were told to
hunt for what was missed, so **expect some false positives**. Do NOT bulk-apply — verify
each first (re-run the adversarial verify via a fresh Claude fan-out after the reset, or
via Codex `codex-adversarial-review`), then fix only confirmed ones.

Full finding objects (descriptions, failure scenarios, suggested fixes, exact line
numbers) are recoverable from the finder + dedup agent transcripts at:
`/Users/ellishuff/.claude/projects/-Users-ellishuff-Documents-Coding-Projects-Stow/14d8a620-c189-49a9-b95c-4ace9f316aa3/subagents/workflows/wf_e7e22e58-293/agent-*.jsonl`
(dedup agent `af0e5951bfde87001` holds all 47 merged; finder agents hold per-lens detail).
The workflow result JSON is at `tasks/w2ti99y9b.output`.

### Correctness / data integrity
- **[P0][HAND-VERIFIED — FIXED above]** Item edit throws for any item without a value.
- **[P0][HAND-VERIFIED — needs fix]** `acceptHouseholdInvite` overwrites an existing
  member's role via `tx.set(memberRef, {role: inviteData.role}, {merge:true})` with no
  existing-membership check (`functions/src/invites.ts:108`). An existing OWNER who
  accepts a MEMBER/ADMIN invite is silently demoted; the sole owner bricks household
  admin. Fix: read `memberRef` in the tx; if already a member, do not downgrade role
  (no-op or reject). Add a functions test.
- **[P1]** Every edit/delete flow hangs forever offline — the `completeWrite` offline
  guard was applied only to the ADD flows; status/move/loan/edit-save/item-delete/
  space-edit-delete/settings await the write directly (`ItemDetail.tsx:299`,
  `StowMobileApp.tsx`). (Plausible + consistent with the pre-launch fix having scoped to
  adds only — verify then extend `completeWrite` to these paths.)
- **[P1]** Offline item delete latches `deleteSaving=true` forever (await never resolves
  offline with `persistentLocalCache`); the next delete opens a Confirm modal whose
  Cancel is gated by `!deleteSaving`, so it's undismissable (`StowMobileApp.tsx:760`).
- **[P1]** "Regenerate invite" drops the email restriction → an email-bound invite
  becomes an anyone-with-link bearer invite (`SettingsScreen.tsx`).
- **[P1]** `useWorkspaceData` `error`/`errorsBySource`/`sync` surface has zero consumers —
  listener failures and being removed from a household are completely silent
  (`StowMobileApp.tsx` never reads `data.error`).
- **[P1]** Expired invites shown as "Pending" indefinitely in Settings (`SettingsScreen.tsx`).
- **[P2]** Activity-feed entries forgeable — the `activity` create rule checks only
  `isHouseholdMember`, doesn't bind `actorUid` to the caller (`firestore.rules:94`).
- **[P2]** Single-item AI scan is fire-and-forget with no progress UI; a slow result
  clobbers what the user is doing or is discarded with its uploaded photo orphaned
  (`StowMobileApp.tsx handleScanSingle`).
- **[P1]** Closing/rescanning QuickCapture mid-upload orphans the `_shelf` storage object
  and still pays for the vision call (`QuickCapture.tsx`).
- **[P1]** QuickCapture commits items into a space/area another member deleted mid-review,
  stranding them outside every space (`QuickCapture.tsx`).
- **[P1]** Leaving ItemDetail edit via Back (or a remote item deletion) orphans a
  freshly-uploaded replacement photo in Storage (`ItemDetail.tsx`).
- **[P2]** `itemDrafts` is a dead feature still costing a permanent Firestore listener
  every session (`repository.ts subscribeItemDrafts` + `useWorkspaceData`).

### Backend (Cloud Functions)
- **[P1]** `saveHouseholdLlmConfig` `merge:true` makes `baseUrl` un-clearable — after a
  user switches provider, vision calls keep sending the household API key to the
  abandoned third-party host (`llmConfig.ts`).
- **[P1]** Gemini adapters ignore `finishReason`/`blockReason` and run shelf detection on
  a 400-token budget — busy shelves silently return zero detections; thinking models fail
  categorize outright (`providers/gemini.ts`).
- **[P1]** `providerFetch` timeout covers only response headers; the body read is
  unbounded, letting a slow provider pin a request to the 60s platform timeout
  (`providers/common.ts`).
- **[P2]** `validateHouseholdLlmConfig` can test a stale cached API key from another
  instance's 60s cache and stamps `lastValidatedAt` on that wrong result (`llmConfig.ts`).

### Visual / layout (iOS-mobile PWA)
- **[P1]** `PhotoField`'s camera overlay renders inside positioned/scrolling ancestors, so
  it never covers the screen and breaks inside ItemDetail edit (`PhotoField.tsx:216` —
  render `PhotoSource` via a portal or hoist it).
- **[P1]** All form inputs use <16px font → iOS Safari auto-zooms and crops the
  fixed-position app shell (`Field.tsx`; bump input font-size to ≥16px).
- **[P1]** Every bottom-anchored overlay ignores `env(safe-area-inset-bottom)`
  (`ActionSheet.tsx`, `Sheet.tsx`, `EditSpaceSheet`, ItemDetail actions, QuickCapture Done).
- **[P1]** `ScanOverlay`/`QuickCapture` fixed pixel insets → in landscape / any viewport
  <~460px tall the viewfinder collapses to zero height and the scrim covers the camera
  (`ScanOverlay.tsx`).
- **[P1]** QuickCapture review step doesn't scroll — "Confirm & add" is clipped off-screen
  on short viewports and with the rename keyboard open (`QuickCapture.tsx`).
- **[P2]** `Toast` uses `whiteSpace:nowrap` — long messages clip off both edges on narrow
  phones (`Toast.tsx`).
- **[P2]** Long unbroken item names/notes make ItemDetail horizontally scrollable
  (`ItemDetail.tsx`; add `overflow-wrap/word-break`).
- **[P2]** Lazy QR scanner `fallback={null}` — tapping "Scan QR label" shows nothing while
  the chunk downloads (`StowMobileApp.tsx`; add a loading affordance).

### Accessibility (WCAG 2.1 AA)
- **[P1]** Form fields have no programmatic labels — `Field.tsx` label is a bare `<div>`,
  no `htmlFor`/`id`, no `aria-label` (WCAG 1.3.1/4.1.2).
- **[P1]** Home-screen space rows are click-only `<div>`s — keyboard/switch users can't
  open a space (`SpacesList.tsx`; WCAG 2.1.1).
- **[P1]** `Toast` live region is created together with its message → screen-reader
  announcements unreliable (`Toast.tsx`; mount a persistent `aria-live` region; WCAG 4.1.3).
- **[P1]** Accent/danger/status colors used as small text fail AA contrast (computed
  2.7:1–4.1:1) across RoleBadge/Chip/badges/muted text (WCAG 1.4.3; darken tokens).
- **[P2]** `ActionSheet` uses `role="menu"` without menu keyboard semantics or `aria-modal`.
- **[P2]** Space/area reorder is hold-and-drag only, no keyboard alternative
  (`EditSpaceSheet.tsx`; WCAG 2.1.1).
- **[P2]** AI Vision toggle exposes no on/off state to AT (`SettingsScreen.tsx`; use a
  real checkbox/switch role + `aria-checked`).
- **[P2]** Icon-only delete-area buttons have no accessible name (`EditSpaceSheet.tsx`).

### Performance
- **[P1]** Photos uploaded at full original resolution — no client downscale before
  Storage upload or LLM vision (`PhotoField.tsx:54`; canvas-resize to a max edge before
  upload — also cuts vision cost/latency and pairs with the "images too big" cost items).
- **[P1]** SW uses `StaleWhileRevalidate` for immutable Firebase Storage images — every
  cached thumbnail hit re-downloads the full image in the background (`vite.config.ts`;
  switch that runtime-cache route to `CacheFirst`).
- **[P1]** No `loading="lazy"` on any list image — Search's default "All Items" eagerly
  fetches every item image on tab open (`ItemRow.tsx`).
- **[P2]** PackingScreen item picker recomputes O(spaces×items) on every keystroke and on
  every items snapshot while closed (`PackingScreen.tsx`; memoize + gate on open).
- **[P2]** `stowScan` keyframes animate `top` → continuous layout+paint at 60fps while
  capture overlays are open (`tokens.css`; animate `transform` instead).
- **[P2]** RoomScreen re-runs O(areas×items) filters on every app render tick
  (`RoomScreen.tsx`; memoize).

### Offline / PWA lifecycle
- **[P1]** Photo uploads have no offline guard — `uploadBytes` silently retries up to 10
  min on every capture path (`storage.ts`; detect offline and fail fast with a message).
- **[P1]** Brand fonts load render-blocking from two external CDNs with no SW caching —
  typography is lost on every offline launch and first paint stalls on flaky networks
  (`index.html`; self-host or runtime-cache the fonts).
- **[P2]** No cache headers for `index.html` / hashed assets — non-SW browsers can
  white-screen up to an hour after a deploy (`firebase.json` hosting headers).

### Tests / CI / config
- **[P1]** `deploy:backend` ships stale compiled functions — `lib/` is weeks older than
  `src/`; `firebase.json` functions block has no `predeploy` build hook and the
  `deploy:backend` script doesn't chain `functions:build` (`firebase.json:9`,
  `package.json:18`). **High-value, low-risk — do early.**
- **[P1]** Rules-test bootstrap batch doesn't mirror the real sign-up transaction
  (missing `settings/llm` and `users` writes) — the test passes but wouldn't catch a
  rule that breaks real bootstrap (`tests/firestore.rules.test.ts`).
- **[P2]** Firestore rules deny-paths untested: forged `visionJobs.createdBy`, client
  invite creation, non-admin household update, cross-uid `users` access
  (`tests/firestore.rules.test.ts`).
- **[P2]** Merge-deploy workflow has no `concurrency` guard — rapid merges can deploy
  stale code to the live channel (`firebase-hosting-merge.yml`).
- **[P2]** Merge workflow has no `permissions` block — deploy job runs with repo-default
  token scope (`firebase-hosting-merge.yml`).
- **[P2]** `playwright.config.ts` lacks `forbidOnly` — a stray `test.only` silently guts
  the smoke suite in CI.

## Also still PENDING (not from the audit)

- **Deliberate perf refactor** (deferred from 2026-07-04): React.memo across screen/row
  components + stable callbacks threaded through `StowMobileApp` + switch hot `onSnapshot`
  handlers (items/drafts/packingLists) to `docChanges()` incremental array maintenance.
  Behavior-preserving; NO pagination (needs product sign-off). Full spec written at
  session scratchpad `perf-refactor-spec.md` (also reproduced conceptually here — a resume
  session should re-derive it; the incremental-mapper + latest-ref-callback patterns are
  the core). This partially overlaps the perf findings above; do them together.
- **Deferred race tests** (memory follow-up): emulator-backed tests for concurrent
  bootstrap, reorder-vs-delete (spaces + areas), packing-toggle-vs-item-delete. An agent
  was spawned to write `tests/firestore.races.test.ts` but died on the session limit
  **without writing the file** — start fresh. Detailed spec was in the agent prompt; the
  invariants: exactly-one-bootstrap-winner; reorder set+merge survives concurrent delete
  and leaves only name-less stubs (filtered by `mapNamedSnapshot`); no dangling deleted
  item id in packing `itemIds`.
- **UI enhancement pass** with live-preview verification (the a11y + layout findings above
  are the concrete work-list; plus opportunistic polish — the design foundation is good).
- **Full verification**: `npm run typecheck`, `npm test`, `npm --prefix functions test`,
  `npm run test:rules`, `npm run build` — all green — then an independent agent review of
  the final diff (Ellis's standing rule).

## Recommended resume order

1. Finish worktree removal + confirm `npm test` clean (unblocks everything).
2. Commit the DONE work (hygiene, CI bump, P0 fix) — see below.
3. Re-run the adversarial verify over the 47 findings (fresh Claude fan-out post-reset,
   or Codex). Triage into confirmed/rejected.
4. Fix confirmed P0/P1 first (acceptInvite demotion; offline-hang class; delete latch;
   invite-email drop; deploy:backend build hook are the highest value/lowest risk).
5. Perf refactor + perf findings together. Race tests. UI/a11y pass with preview.
6. Full verification + independent review. Write the final dated report + update memory.

## Delegation notes (Ellis asked to hand remaining work to Codex/Opus)

- Mechanical, well-specified fixes (a11y labels, safe-area insets, font-size bumps,
  `loading="lazy"`, CacheFirst route, `forbidOnly`, `concurrency`/`permissions` blocks,
  predeploy hook, `overflow-wrap`) → `delegate` skill (local Codex GPT-5.5), one spec per
  batch, Claude reviews the diff. These are low-reasoning and don't need a Claude verify.
- Semantics-sensitive fixes (acceptInvite role logic, offline-hang refactor, the perf
  `docChanges` refactor, rules changes) → keep on Claude (architect + review), or Codex
  under a tight spec with a mandatory Claude review of the diff — never ship unreviewed.
- Independent verification of the 47 findings → `codex-adversarial-review` is a good
  second opinion, but a fresh Claude adversarial fan-out (as originally designed) is the
  primary; run whichever is available first, reconcile.
