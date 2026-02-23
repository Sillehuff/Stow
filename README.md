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
- Security-rule emulator tests (scenarios are planned; harness not fully implemented yet)
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

3. Start Firebase emulators (from repo root):

```bash
firebase emulators:start
```

4. In another terminal, run the frontend:

```bash
npm run dev
```

## Demo Seeding

To seed a demo household into the emulator or your configured project:

```bash
npm run seed:demo -- --uid demo-owner --name "Demo Household"
```

Optional:

- `--household <id>` to force a specific household ID

## Functions Secret Encryption

- Production: set `KMS_KEY_NAME` to a Cloud KMS key resource.
- Local/dev: falls back to AES-GCM using `LOCAL_SECRET_ENCRYPTION_KEY`.

## Notes

- `visionCategorizeItemImage` requires the household LLM config to be enabled and an API key stored via settings.
- Offline mode supports core Firestore-backed inventory edits; image upload and vision categorization remain online-only.
