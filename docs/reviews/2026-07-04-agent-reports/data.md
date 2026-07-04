# Report: Data & services layer (review-data agent)

## Data & services layer

Reviewed every file in scope against current code. The layer is in good shape — the pre-launch review's P0/P1/P2 data items I could reach (offline hang via `completeWrite`, activity-in-shared-catch double-insert, lent→status two-write rollback, `deleteSpace`/`createItemsBatch` batch chunking, transactional bootstrap, set+merge reorders) are all genuinely fixed in the code I read. Remaining findings below are ordered by severity.

---

### P1 — `useWorkspaceData` `sync` flags ignore the `activity` collection

`src/features/stow/hooks/useWorkspaceData.ts:271-293` — the `sync` memo ORs `fromCache`/`hasPendingWrites` across spaces, areas, items, itemDrafts, members, invites, packingLists, and llmConfig, but **omits `activityState`** entirely (`activityState` is declared at line 82 and never referenced in `sync`).

- **Failure scenario:** When the only pending write is an activity-log entry (e.g. every item add/move/delete/status change fans out a `logActivity`), `sync.hasPendingWrites` can read `false` and `sync.fromCache` can read stale even though a write is in flight / unsynced. Any "all synced" / "offline, will sync" affordance driven off `sync` misreports for the activity feed specifically. Low blast radius (activity is best-effort), hence P1 not P0, but it's a real correctness gap in the sync indicator.
- **Fix:** add `activityState.fromCache` to the `fromCache` OR-chain and `activityState.hasPendingWrites` to the `hasPendingWrites` OR-chain, and add `activityState` to the memo dependency array (line 292). Note `activity` is also excluded from `sync` deliberately-or-not — decide intentionally; if activity is meant to be excluded, drop `activityState` from the error surface too for consistency, but excluding it from `sync` while including it in `error`/`errorsBySource` is inconsistent.

---

### P2 — `Item.value` type diverges from what the read boundary produces (`null` vs `number | undefined`)

`src/types/domain.ts:77` declares `value?: number`, but `normalizeItemDoc` at `src/features/stow/services/repository.ts:113` writes `value: ... ? data.value : null`, and `createItem`/`createItemsBatch`/`completeItemDraft` persist `value: input.value ?? null` (lines 581, 624, 804). So the actual runtime shape of `Item.value` is `number | null`, never `undefined` for a normalized doc, yet the type says `number | undefined`.

- **Cost / failure scenario:** Consumers that do `item.value === undefined` to detect "no value" silently break (the value is `null`, not `undefined`); consumers typed on `number | undefined` that pass `item.value` into arithmetic or `.toFixed()` get no compiler warning about the `null`. The `as Item` cast at `repository.ts:117` suppresses the mismatch, so TS never flags it. It's latent, not currently crashing, hence P2.
- **Fix:** change the domain type to `value: number | null` (and update `NewBatchItem`/create input types if you want them to accept `null`), OR make `normalizeItemDoc` emit `undefined` instead of `null` when absent. Prefer `number | null` in the domain type since that is what Firestore actually stores and what every writer emits.

### P2 — Dead seed code: `normalizeSeedForHousehold` and the entire demo-item template set are unused

`src/features/stow/seed.ts` — `normalizeSeedForHousehold` (line 177), `seedItemTemplates` (line 57, ~100 lines with hard-coded Unsplash URLs), `seedSpaceColor` (163), `stripUndefined` (173), `toImageRef` (167), and the exported `SeedItemTemplate` type are referenced **nowhere** outside `seed.ts` (verified by grep across `src/`). Only `buildStarterSpaces` (line 225) is live — it's imported by `useHouseholdBootstrap.ts:7`, and it re-derives from `seedSpaceTemplates` without touching any of the dead helpers.

- **Cost:** ~130 lines of dead code that ships external Unsplash image URLs the app never uses; it also keeps the pre-launch review's P0 #1 confusion ("seeded demo household is dead code") alive in the source. `stripUndefined`/`toImageRef` exist only to serve `normalizeSeedForHousehold`.
- **Fix:** delete `normalizeSeedForHousehold`, `seedItemTemplates`, `SeedItemTemplate`, `seedSpaceColor`, `stripUndefined`, and `toImageRef`. Keep `seedSpaceTemplates`, `SeedSpaceTemplate`, and `buildStarterSpaces`. (Verify no test imports the deleted symbols before removing.)

### P2 — Unbounded item / draft / packing-list listeners (no pagination)

`repository.ts:280-291` (`subscribeItems`) and `294-310` (`subscribeItemDrafts`) and `833-840` (`subscribePackingLists`) attach `onSnapshot` on the full collection with `orderBy` but **no `limit`**. `subscribeActivity` (line 913) correctly takes a `max` and applies `limit(max)` (called with 50 from `useWorkspaceData.ts:224`); items/drafts/packingLists do not.

- **Cost:** For the target use case (garages, storage units, whole-home inventory) the items collection is the one that grows without bound — a household with thousands of items streams and re-materializes every doc into memory on every snapshot, and the `data: snap.docs.map(normalizeItemDoc)` handler (line 286) rebuilds the entire array on each change rather than applying `snap.docChanges()`. Both the payload and the per-update O(n) normalize cost scale with total inventory, not with what's on screen. This is the single largest efficiency risk in the layer as inventories grow.
- **Fix (two independent wins):** (1) Add a `limit`/pagination path for `subscribeItems` (e.g. cap the live listener and load older items on demand), matching the `subscribeActivity` pattern. (2) For the hot listeners, switch the snapshot handler to maintain the array incrementally via `snap.docChanges()` instead of re-mapping all docs each time. If a full-inventory live view is a hard product requirement, at minimum document the intended ceiling; the current code has none.

### P2 — `deleteItem` runs two unbounded `array-contains` queries on every single-item delete

`repository.ts:678-701` — deleting one item issues two `getDocs` queries against `packingLists` (`where("itemIds", "array-contains", itemId)` and `where("packedItemIds", "array-contains", itemId)`) before the delete batch, to strip the id from any list.

- **Cost:** Two collection queries per delete even when the household has zero or few packing lists; for a household that keeps many packing lists this is a read amplification on a common operation. It's correct, just not cheap.
- **Fix (optional, low priority):** If packing lists are typically few, subscribe once and filter client-side, or gate the queries behind "there is at least one packing list" state the client already holds via `subscribePackingLists`. Not a bug — flag only as a measurable read-cost reduction. Leave as-is if packing lists are expected to stay small.

---

### Verified clean

- **Listener lifecycle / leaks:** Every `onSnapshot` in `repository.ts` returns its `Unsubscribe`; every `useEffect` in `useWorkspaceData.ts` returns `() => unsub()` and is keyed on `householdId` (and `canManageHouseholdSettings` for invites/llmConfig), so listeners are torn down and rebuilt on workspace switch. The reset effect (lines 91-104) clears all state on `householdId` change. `AuthProvider` returns the `onAuthStateChanged` unsubscribe. No leaked subscriptions found.
- **Auth-state races:** `AuthProvider` sets `loading:false` in the callback and cleans up correctly; `useHouseholdBootstrap` guards with a `cancelled` flag and runs the create path inside `runTransaction` that re-reads `currentHouseholdId` and yields to a concurrent winner (lines 86-144), with `validateExistingHousehold` re-validation on the lost-race branch — the pre-launch P2 #17 orphan race is genuinely closed. `AuthFinishPage` dedupes StrictMode double-invoke via `completionKeyRef`.
- **Batched-write atomicity:** `deleteSpace` (520-549) and `createItemsBatch` (598-646) chunk at 450 ops with load-bearing ordering (reassign → area deletes → space delete last) documented and correct; `completeItemDraft` (795-819) and `deleteItem` (686-701) use single atomic batches. Reorders use `set(...,{merge:true})` to survive concurrent deletes (438-465), with `mapNamedSnapshot` filtering the resulting position-only stubs (84-92).
- **Error swallowing:** All `onSnapshot`s pass an `onError` that routes to `setSourceError`; `callFunction` logs and re-maps via `toUserErrorMessage`; `completeWrite` surfaces queued-write rejection via callback. No silent catches in the data path.
- **Optimistic rollback / status flows:** `onChangeStatus` short-circuits same-status and uses single-write `clearItemLoan(nextStatus)` (StowMobileApp.tsx:409-415); create/add flows use `completeWrite` + best-effort `logActivity` so an activity failure no longer masquerades as a failed save (pre-launch P2 #15/#16 fixed).
- **Data-integrity defaulting:** `normalizeItemDoc` / `itemMetadata.ts` defaults are defensive and correct (malformed docs get `"Untitled item"`, safe status/photoStatus/entryMode); `buildActivityEntry` omits undefined keys so Firestore never receives `undefined` (unit-tested). The only type divergence found is `Item.value` (reported above).
- **Config / env / boundaries:** `env.ts` `isFirebaseConfigured` gate is sound; `client.ts` persistence init has emulator-dedupe and auth-persistence fallback; `safeReturnTo` in `auth.ts` blocks open-redirect (cross-origin and `//` rejected); `paths.ts` is a single source of truth with no drift against repository usage.
