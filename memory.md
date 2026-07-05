# Stow Reliability-First Remediation

Updated: 2026-03-30

## What Changed

- Added backend member administration callables in `functions/src/members.ts` and routed settings member management through callable wrappers in `src/lib/firebase/functions.ts`.
- Hardened member role/remove invariants so admins cannot edit or remove owners, admins cannot assign `OWNER`, owners cannot remove or demote the last remaining owner, and client-side direct member mutation is blocked by Firestore rules except bootstrap owner creation.
- Reworked invite handling so Firestore stores only `tokenHash` plus metadata, added callable invite revocation, and removed direct client invite deletion.
- Locked down household settings access so `settings/llmSecret` is never client-readable or writable, and `settings/llm` is limited to owners/admins plus bootstrap creation.
- Tightened KMS local-secret behavior so the placeholder local encryption key is rejected outside local/dev/emulator/test contexts.
- Narrowed unsafe schemas in `functions/src/shared/schemas.ts`, including stricter vision input validation.
- Restricted vision processing to household storage-backed images only, with MIME, size, and timeout checks, and blocked arbitrary external URL fetching.
- Updated item/space/area media flows to use real document ids before upload and added best-effort cleanup for replaced, removed, and abandoned draft images.
- Added packing-list cleanup when deleting items so stale `itemIds` and `packedItemIds` references are removed, and UI counts now reflect resolved existing items.
- Hardened household bootstrap so `users/{uid}.currentHouseholdId` is validated and repaired instead of trusted blindly.
- Added a root React error boundary and improved startup/auth recovery UX, including valid email-link checks, actionable startup failure states, and iOS install guidance.
- Split the monolithic `src/features/stow/ui/StowApp.tsx` into smaller tab, item, shared modal, and navigation-state units while preserving behavior.
- Replaced browser `window.confirm` / `window.prompt` flows with in-app UI flows for auth/admin interactions.
- Fixed `iconForSpace` so every declared `SpaceIcon` maps to a distinct icon and improved packed-state copy consistency.
- Added backend tests, Firestore rules emulator tests, authenticated browser smoke coverage, npm-based functions CI support, and GitHub Actions checks before Hosting deploy.

## Key Files

- `functions/src/members.ts`
- `functions/src/invites.ts`
- `functions/src/vision.ts`
- `functions/src/crypto/kms.ts`
- `firestore.rules`
- `src/features/stow/services/repository.ts`
- `src/features/household/useHouseholdBootstrap.ts`
- `src/routes/AuthFinishPage.tsx`
- `src/features/stow/ui/StowApp.tsx`
- `src/features/stow/hooks/useStowNavigationState.ts`
- `tests/firestore.rules.test.ts`
- `tests/smoke/authenticated-smoke.spec.ts`
- `.github/workflows/firebase-hosting-pull-request.yml`
- `.github/workflows/firebase-hosting-merge.yml`

## Verified

- `npm test`
- `npm run typecheck`
- `npm run build`
- `npm run functions:build`
- `npm run functions:test`
- `npm run test:rules`
- `npm run test:smoke`

## Notes

- `functions/package-lock.json` is now part of the npm-based functions CI path and should be kept with the workflow updates.
- Existing untracked `.playwright-cli/` workspace artifacts were intentionally left alone.
