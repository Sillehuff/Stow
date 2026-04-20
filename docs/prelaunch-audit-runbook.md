# Pre-Launch Audit Runbook

## Goal
- Run a repeatable launch audit for Stow with clear ownership, evidence capture, independent re-test gates, and one shared definition of done.
- Distinguish `automated proof` from `manual proof` on every batch. This repo still needs both.

## Audit Scope and Environment
- Record repo SHA, branch, audit date, launch target, reviewer names, and in-scope features before starting.
- Record whether the run is `emulator` or `prod-like`.
- Confirm whether `VITE_USE_FIREBASE_EMULATORS=true` and whether real-provider credentials are intentionally in scope for this pass.

## Required Commands
- Install deps: `npm install` and `npm --prefix functions install`
- Local verification: `npm run verify:local`
- Emulator verification: `npm run verify:emulator`
- Full verification: `npm run verify`
- Long-lived emulator session for manual QA: `npm run emulators:start`
- Seed repeatable QA data: `npm run seed:qa`
- Start a browser automation session: `npm run e2e:open`
- Note: `verify:emulator` uses the repo-installed Firebase CLI and requires Java for Firestore and Storage emulators.

Run and record the automated lane in this order:
1. `npm install`
2. `npm --prefix functions install`
3. `npm run verify:local`
4. `npm run verify:emulator`

For manual emulator QA after the automated lane:
1. In terminal A, run `npm run emulators:start`.
2. In terminal B, run `npm run seed:qa`.
3. In terminal C, ensure `VITE_USE_FIREBASE_EMULATORS=true` is set for the frontend session, then run `npm run dev -- --host 127.0.0.1`.
4. Run `npm run e2e:open`.

## Reviewer Roles
- Orchestrator: owns the active batch, ledger state, severity triage, and re-test assignment.
- Static frontend reviewer: checks semantics, keyboard flow, labels, tokens, responsive layout, and UI regressions.
- Backend/data reviewer: checks rules, repository mutations, bootstrap, invites, permissions, and data-loss risk.
- Runtime reviewer: runs automated verification plus emulator-backed smoke flows.
- `Computer Use` desktop reviewer: exercises real browser behavior, popups, share/download/print, and exploratory edge cases.
- `Computer Use` mobile reviewer: tests 320, 390, 430, 768, 820, 1024, and 1280 widths, landscape phone, and 200% zoom.

## Evidence Format
- Severity: `P0`, `P1`, `P2`, or `P3`
- Type: `bug` or `ui-ux`
- Surface: route, modal, flow, or subsystem
- Repro steps: short numbered path
- Expected vs actual: one sentence each
- Environment: browser, viewport, auth role, emulator/live
- Evidence: screenshot path, terminal output, or linked commit/test failure
- Owner: implementation agent or reviewer
- Status: `open`, `fixed-awaiting-retest`, `verified`, or `reopened`
- Proof type: `automated`, `manual`, or `blocked`

## Required Audit Surfaces
- Auth gate, emulator QA access, email-link finish, invite accept, and household bootstrap
- Spaces, areas, items, CRUD and delete-with-reassign flows
- Search, packing lists, settings, members, invites, LLM settings
- QR label flow, vision scan flow, offline/PWA banners, install/update prompts
- Deep links, empty/loading/error states, and role/security boundaries

## Re-Test Loop
1. Implement a tightly scoped batch.
2. Mark each touched finding `fixed-awaiting-retest`.
3. Assign a fresh static reviewer, a fresh runtime reviewer, and a fresh `Computer Use` reviewer who did not author the fix.
4. Re-test the touched surface plus adjacent flows likely to regress.
5. Reopen anything missed, regressions included.
6. Only move a finding to `verified` after an independent reviewer confirms it.

## Launch Gate
- No unresolved `P0` or `P1` issues
- `npm run verify` passes
- Emulator role, CRUD, and rules coverage passes
- Desktop and mobile manual sweeps are complete
- Live smoke passes for auth, invite links, storage upload, callable functions, and provider-critical flows
