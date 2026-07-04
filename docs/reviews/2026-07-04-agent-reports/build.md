# Report: Build, tooling & tests (review-build agent)

### P1 — `jsqr` statically bundled into main workspace chunk, downloads on every app open
`StowMobileApp.tsx:24` static-imports `QrScanOverlay`, which imports `jsqr` (~15kB). Rides in the 100kB-gzip main chunk. Fix: `lazy()` the scan overlay + `<Suspense fallback={null}>` at render site (line 686). Native BarcodeDetector path unaffected.

### P1 — PWA precache eagerly caches ~1.3MB including feature-only chunks
`vite.config.ts:46` globPatterns caches all 33 assets on SW install. Fix: narrow globs to app shell + add runtimeCaching StaleWhileRevalidate for `/assets/.*\.js$`. (Lower-effort alt: accept the tradeoff.)

### P2 — Root `npm test` re-runs the entire `functions/test/**` suite
`package.json:11` only excludes `tests/**`; vitest still collects `functions/test/*`. Runs twice in CI + couples root pass/fail to functions esbuild-against-root-tsconfig. Fix: `vitest run src scripts` or add `functions/**` to root exclude.

### P2 — `scripts/**` (production-mutating backfills) never typechecked in CI
Not in any tsconfig include. Fix: add `tsconfig.scripts.json`, reference from root, resolve `seed.js`→`seed.ts` specifier.

### P2 — Rules tests never exercise collection-group `areas` query path or bootstrap `settings/llm` create path
`firestore.rules:124-129` and `:100` untested. Fix: add collectionGroup query assertSucceeds/assertFails + bootstrap settings/llm setDoc in batch test.

### P2 — Backfill scripts default to mutating EVERY household with no confirmation gate
`backfill-positions.ts:62-64`, `backfill-status.ts:39-41`. Fix: require explicit `--apply`, default dry-run, print affected count.

### P2 — CI deploys only hosting; rules/indexes/functions drift (unchanged from prior review #25)
Fix: add guarded `firebase deploy --only firestore,storage` on merge to main.

### Verified clean
- lucide named imports (tree-shakes to 6kB), firebase subpath imports, storage/functions lazy, qrcode dynamic-imported.
- Every route React.lazy; StowMobileApp lazy.
- index.html precached WITH revision hash (no stale-index bug); navigateFallback correct; storage runtime-cache host-scoped.
- tsconfig strict:true, isolatedModules, correct moduleResolution.
- firebase.json SPA rewrite correct; emulator ports consistent.
- CI runs unit+typecheck+functions+rules+playwright before deploy; Node24/JDK21 pinned.
- Playwright workers:1/fullyParallel:false avoids emulator races.
- seed-demo field names match domain.ts; 28 writes under batch limit.
- Backfill planners pure/idempotent/batched/tested.
- All 214 unit tests pass.
