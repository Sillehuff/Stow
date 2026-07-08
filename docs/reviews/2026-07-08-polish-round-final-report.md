# Stow polish & hardening round — final report (2026-07-07 → 08)

**Status: COMPLETE on `polish/2026-07-07-audit-triage` (13 commits). Independent
review verdict: SHIP. Awaiting the owner's go-ahead to merge to main** (merging to
main triggers the CI deploy of hosting to the live channel; backend changes then need
one manual `npm run deploy:backend`).

## What this round was

The resumed second half of the 2026-07-07 polish program: adversarially verify the
47-finding audit backlog, fix what's real, land the deferred perf work and race
tests, run a UI/a11y pass, and gate everything behind independent review.
The first half's record: `2026-07-07-audit-triage-and-handoff.md`.

## Verification of the audit backlog

Five Codex (GPT-5.5) verifiers, read-only, one domain batch each, checked all 45
open findings against the code: **44 CONFIRMED, 1 REJECTED**. The rejection
("baseUrl un-clearable via merge") exposed a worse live bug — the callable client
serializes a cleared field to `null`, which the strict schema rejected, so saving
Gemini/Anthropic AI settings failed outright. All 44 confirmed findings plus that
replacement bug are fixed in this round.

## What landed (commit order)

1. `379c5a2` — **acceptInvite can no longer demote an existing member** (sole-owner
   bricking closed); membership read inside the tx; invite stays unconsumed; tests.
2. `70810c7` — **Provider layer**: Gemini blocked/truncated responses surface as
   errors (not fake zero-detections); shelf detection gets a 1024-token floor;
   provider body reads bounded by the timeout; validation stops testing stale cached
   keys; `baseUrl` clearable end-to-end.
3. `b7464bc` — **Deploy/caching/rules**: functions predeploy build (stale-lib deploys
   impossible); hosting cache headers (HTML must-revalidate, hashed assets
   immutable); CacheFirst SW routes for Storage images + CDN fonts; serialized live
   deploys + least-privilege CI token; activity writes bound to the caller's uid;
   rules suite gains bootstrap-mirror + deny-path coverage.
4. `f037790` — **Offline honesty**: every awaited edit/delete/status/move/loan/space/
   settings write goes through the completeWrite guard (no more infinite hangs; the
   undismissable delete-confirm is gone); AI-scan results carry a ticket and are
   discarded (photo deleted) when stale; listener failures render as a banner with
   permission-denied ("no longer have access" + sign out) distinguished; ItemDetail
   cleans up unsaved replacement photos on Back/unmount; updateItem strips undefined
   patch keys.
5. `0eea9b4` — **Capture races + media**: close-mid-upload can't orphan the shelf
   frame or pay for vision; commits validate the destination against live spaces;
   photos downscale on-device (1600px JPEG) at the single upload choke point;
   Storage uploads fail fast offline; camera overlay portals to the body.
6. `5432b9f` — **Perf slice 1**: items/packingLists/activity subscriptions map only
   changed docs (docChanges) and keep unchanged object identities.
7. `6646562` — progress record in the handoff doc.
8. `ad3f893` — **Settings + a11y/layout/contrast** (Codex X2+X3 under review, with
   reviewer corrections): invite regeneration preserves + shows the email
   restriction; expired invites labeled; AI toggle is a real switch; programmatic
   labels + 16px input floor everywhere; persistent wrapping toast live region;
   ActionSheet becomes an honest modal dialog; safe-area padding on bottom sheets;
   keyboard reorder (area move buttons; row Enter/Space); scan overlay survives
   short/landscape viewports; scan line animates via transform (reviewer-fixed:
   the mover must span the track); AA contrast tokens asserted by a palette test;
   packing picker gated on open; lazy list thumbnails; Move up/down in the space
   menu as the keyboard alternative to drag.
9. `c7a0bae` — RoomScreen counts items in one pass.
10. `4fbeb87` — **Race tests** (Opus agent, verified against the live emulator):
    one-winner bootstrap; reorder-vs-delete leaves only name-less stubs the read
    boundary drops; packing-toggle-vs-delete proven safe toggle-first and documented
    impossible to guarantee delete-first (blind arrayUnion) with the app-level
    filter invariant pinned instead.
11. `f4f96dd` — review nit: drag-reorder surfaces rejected offline writes like every
    other guarded path.

## Verification

- Full suite green at every commit and finally: **146 app tests, 85 functions tests,
  28 rules/races tests (live emulator), typecheck, production build.**
- **Live browser pass** against seeded emulators (2026-07-08 ~00:30): email-link
  sign-in, keyboard space-row activation, Move up/down (order change persisted,
  entries appear/disappear at the ends), dialog/switch semantics, 16px labeled
  controls, persistent toast region, scan overlay portrait + 568×320 landscape,
  visual design unchanged, zero console errors.
- **Independent review** (Opus agent, blind to authorship, whole-branch diff):
  verdict SHIP; no blockers; 2 nits (1 fixed, 1 accepted: ItemDetail says "Item
  updated" for a locally-applied offline edit, which is truthful).

## Known follow-ups (deliberate, non-blocking)

- **React.memo + stable-callback sweep** across screens/rows: skipped this round by
  explicit call — every *confirmed* perf finding is fixed; blanket memoization needs
  prop-identity surgery that wasn't worth the regression risk tonight. The
  incremental mapper already preserves item identities, so rows are memo-ready.
- **tests/ not covered by `npm run typecheck`** (pre-existing gap the race-test agent
  surfaced; its file was type-checked explicitly).
- Cosmetic: in the camera-unavailable state on a ≤320px-tall landscape viewport, the
  "Choose from library" button clips by ~8px.
- Anthropic adapter doesn't inspect `stop_reason` (the Gemini finding's sibling;
  no evidence of harm, not in the verified backlog).
- Optional second opinion: a blind Codex adversarial review of the final branch
  (owner's standing preference for major deliverables) — quota reset at 11:17pm,
  so it's available on request.

## To ship

1. Owner says go → merge `polish/2026-07-07-audit-triage` into `main`, push
   (CI deploys hosting to live after the full test gauntlet).
2. Then run `npm run deploy:backend` once (functions/rules/indexes/storage rules —
   the predeploy hook now rebuilds automatically).
3. Post-deploy sanity: save AI settings for a Gemini config (the previously broken
   path), accept-invite as an existing member (expect "already a member"), one
   offline edit.
