# Stow PWA (Firebase + Firestore + Vision LLM Adapters)

Production-oriented rebuild scaffold for the original `stow-v3.jsx` prototype with:

- React + TypeScript + Vite
- PWA support (`vite-plugin-pwa`)
- Firebase Auth + Firestore + Storage + Functions
- Shared household model (members/invites/roles)
- Pluggable backend vision adapters (`OpenAI-compatible`, `Gemini`, `Anthropic`)
- Offline-first core inventory reads/writes via Firestore local persistence

## What Is Implemented

- Frontend project scaffold and app shell
- Auth gate (Google + email link)
- Household bootstrap (first user gets seeded demo household)
- Firestore-backed spaces/areas/items CRUD UI (core flows)
- Packing flow, search, item edit/delete, local QR label generation
- Settings UI for members/invites and LLM config
- Vision scan flow with backend callable integration + review-before-save
- Firebase Functions package with callable endpoints and provider adapter abstraction
- Firestore/Storage rules + index definitions
- Demo seed script

## What Still Needs Validation / Completion

- Dependency installation and build verification in this environment
- End-to-end emulator runs
- Real provider credential testing (LLM validation/categorization)
- Broader security-rule coverage beyond the first emulator harness
- UI parity refinements vs the original prototype visuals

## Quick Start

1. Install dependencies:

```bash
npm install
npm --prefix functions install
```

2. Create env file:

```bash
cp .env.example .env.local
```

If you are testing locally against emulators, set:

```bash
VITE_USE_FIREBASE_EMULATORS=true
```

3. Start Firebase emulators (from repo root):

```bash
npm run emulators:start
```

4. In another terminal, run the frontend with emulator mode enabled:

```bash
VITE_USE_FIREBASE_EMULATORS=true \
npm run dev
```

## Verification

Core verification commands:

```bash
npm run verify:local
npm run verify:emulator
npm run verify
```

- `verify:local` runs typecheck, frontend tests, functions tests, both builds.
- `verify:emulator` starts the Firebase emulators with the repo-installed Firebase CLI, runs the rules suite against the shared QA project, seeds repeatable QA data, and exercises an auth-plus-callable invite smoke path. A local JRE/JDK is required for Firestore and Storage emulators.
- `verify` runs both.

## QA Seeding

To seed the deterministic QA fixture set used by the pre-launch audit:

```bash
npm run seed:qa
```

This creates a `qa-household`, seeded spaces/items/packing data, a reusable invite token, and three emulator-only QA accounts:

- `qa-owner@example.com`
- `qa-admin@example.com`
- `qa-member@example.com`

The shared password is printed by the seed script and is only meant for local emulator use.

For long-lived manual QA sessions, keep the emulators up in one terminal and the app in another:

```bash
npm run emulators:start
VITE_USE_FIREBASE_EMULATORS=true \\
npm run dev -- --host 127.0.0.1
```

When `VITE_USE_FIREBASE_EMULATORS=true`, the auth screen also exposes emulator-only quick access buttons for those accounts plus a `Fresh Tester` path for anonymous smoke testing.

## Demo Seeding

To seed a demo household into the emulator or your configured project:

```bash
npm run seed:demo -- --uid demo-owner --name "Demo Household"
```

Optional:

- `--household <id>` to force a specific household ID

## Playwright Session Entry Point

For repeatable browser audit sessions using the local Playwright CLI wrapper:

```bash
npm run e2e:open
npm run e2e:snapshot
npm run e2e:screenshot
npm run e2e:console
npm run e2e:close
```

These commands expect the local dev server to be running at `http://127.0.0.1:5173` unless `BASE_URL` is overridden.

## Audit Docs

Launch-audit coordination lives in:

- [docs/prelaunch-audit-runbook.md](/Users/ellishuff/.codex/worktrees/9cfc/Stow/docs/prelaunch-audit-runbook.md)
- [docs/prelaunch-audit-ledger.md](/Users/ellishuff/.codex/worktrees/9cfc/Stow/docs/prelaunch-audit-ledger.md)

## Functions Secret Encryption

- Production: set `KMS_KEY_NAME` to a Cloud KMS key resource.
- Local/dev: falls back to AES-GCM using `LOCAL_SECRET_ENCRYPTION_KEY`.

## Notes

- `visionCategorizeItemImage` requires the household LLM config to be enabled and an API key stored via settings.
- Offline mode supports core Firestore-backed inventory edits; image upload and vision categorization remain online-only.
