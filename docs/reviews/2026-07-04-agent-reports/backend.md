# Report: Backend functions & security rules (review-backend agent)

## Backend functions & security rules

Reviewed every file in scope against current code. The prior pre-launch review's backend P1 items (invite transaction + email binding, member-role transaction, storage size/content-type limit, provider fetch timeouts + vision rate limit, forged `validated` state, invite-URL origin fallback) are all **confirmed fixed** in current code. The findings below are new and survive verification.

---

### P0 — `areas` collection-group rule permits cross-household writes

**`firestore.rules:124-129`** (specifically the `update` at :127 and `create` at :126)

```
match /{path=**}/areas/{areaId} {
  allow read:   if isHouseholdMember(resource.data.householdId);          // OLD value — OK
  allow create: if isHouseholdMember(request.resource.data.householdId);  // NEW value — HOLE
  allow update: if isHouseholdMember(request.resource.data.householdId);  // NEW value — HOLE
  allow delete: if isHouseholdMember(resource.data.householdId);          // OLD value — OK
}
```

**Issue:** the recursive-wildcard rule gates `update`/`create` on membership of the *incoming* `householdId` payload, which the writer fully controls; Firestore OR's this rule with the path-scoped rule at :72, so it grants access the scoped rule denies.

**Scenario:** a member of household B issues a direct `updateDoc` (or `setDoc`) to the path `households/A/spaces/S/areas/X` — an area owned by household A they are *not* a member of — with a payload whose `householdId` field is `"B"`. The path-scoped rule (:72) fails, but the collection-group `update` rule evaluates `isHouseholdMember("B")` → true, so the write is **allowed**. The attacker overwrites another household's area (rename, reposition, or set `householdId:"B"` to orphan it from A's own reads). `create` is likewise exploitable to inject foreign docs into A's subtree. (`delete` and `read` correctly use `resource.data` = the stored value, so they are safe.) Area/space/household IDs surface in QR deep links and invite URLs, so the target path is obtainable.

**Fix:** the collection-group block should exist only to satisfy collection-group *queries* (reads); mutations should be denied here and left to the path-scoped rule. Simplest correct fix: set `allow create, update, delete: if false;` in the collection-group block and rely on the path-scoped rules (:71-73) for all writes — the wildcard is only needed for the `read`/query path.

**Test gap (same root cause):** `tests/firestore.rules.test.ts` covers non-member create denial only via the *path-scoped* rule (:234-248, writing with `householdId == HOUSEHOLD_ID`). No test writes to household A's area path with a *foreign* `householdId` in the payload, which is exactly the bypass. Add a case: seed household-1's `area-1`, authenticate as an outsider who is a member of a second seeded household-2, and `assertFails(updateDoc(doc(db,"households","household-1","spaces","space-1","areas","area-1"), { householdId: "household-2", name: "hijacked" }))`.

---

### P1 — KMS decrypt runs on every vision call with no warm-instance memoization

**`functions/src/llmConfig.ts:13-28`** (`loadConfigAndSecret`), called from `functions/src/vision.ts:89` and `:132`

**Issue:** every `visionCategorizeItemImage` / `visionDetectShelfItems` invocation does two Firestore reads (config + secret doc) **and** a KMS `decrypt` network call, none of which are cached across warm invocations of the same instance. `kms.ts:42` memoizes only the *client object*, not the decrypt result.

**Scenario:** a shelf scan of one photo can fan out to many categorize calls; a household hammering scans pays a Firestore read pair + a billed KMS decrypt (network latency + per-operation cost) on each, entirely redundant since the config and key rarely change. Measurable cost/latency on the hot path.

**Fix:** add a short-TTL in-module cache keyed by `householdId` around `loadConfigAndSecret` (e.g. `Map<householdId, {value, expires}>` with ~60s TTL), returning the cached `{config, apiKey}` within the window. Invalidate on `setHouseholdLlmSecret`/`saveHouseholdLlmConfig` if same-instance freshness matters, or accept up-to-TTL staleness (acceptable for a rarely-rotated key). Keep the plaintext key only in memory, never logged.

---

### P1 — Shelf detection has no cap on returned array size (token/cost + payload waste)

**`functions/src/providers/gemini.ts:177-179`** and **`functions/src/vision.ts:146`**

**Issue:** `maxOutputTokens` defaults to `1024` (:154), but a model can still emit dozens of detections; the result array is returned to the client with no upper bound. `visionSuggestionSchema.tags` is capped at 15 (schemas.ts:194) but the *detections array itself* has no `.max()`.

**Fix:** cap in `visionDetectShelfItemsHandler` after mapping, e.g. `.slice(0, 50)`, and add `.max(50)` to `visionDetectShelfResultSchema.detections` in schemas.ts:226 for symmetry.

---

### P2 — `extractJsonObject` fallback `JSON.parse` can throw a raw `SyntaxError`

**`functions/src/providers/common.ts:50-51`**

**Issue:** the bracket-extraction fallback parses `trimmed.slice(start, end+1)` without its own try/catch. When a model returns text like `prefix {a: {b} garbage` where the outermost brace span is still invalid JSON, this throws a native `SyntaxError`, not the intended `HttpsError("internal", "Provider response was not valid JSON")` on :53. (Gemini's `extractDetectionArray` at gemini.ts:29-31 does wrap its equivalent slice-parse, so this is inconsistent.)

**Fix:** wrap the fallback in try/catch and throw the `HttpsError("internal", "Provider response was not valid JSON")` on failure, mirroring gemini.ts.

---

### P2 — note (verified clean, hardening suggestion)

`saveHouseholdLlmConfig` input path is bounded — `saveLlmConfigInputSchema.config` applies `.omit({lastValidatedAt,lastValidatedBy}).strict()`, so forged validation/audit fields are rejected. Consider adding `.strict()` to `llmConfigSchema` itself as belt-and-suspenders so a future edit that swaps schemas doesn't reintroduce the forgery hole.

---

### Verified clean

- **Callable authZ:** every callable in `index.ts` verifies auth before dispatch; all handlers resolve role server-side via `requireHouseholdMember`/`requireHouseholdAdmin` (`authz.ts`), never from client input.
- **Invite flow:** single-use enforced via in-transaction re-read + version check; expiry checked in-tx; email binding rejects unverified/mismatched/absent email claims; token stored as SHA-256 only; revoke hard-deletes.
- **Member role transitions:** owner-count invariant enforced inside `runTransaction` for both demote and remove; admin-cannot-touch/assign-OWNER holds.
- **Rate limit:** `consumeVisionQuota` is a per-household transactional daily counter on a rules-denied `settings/visionUsage` doc; quota reserved only after validation so disabled-config/bad-image never burns quota.
- **SSRF:** `isPublicHttpsUrl` blocks non-https, loopback, private IPv4, link-local/metadata, IPv6 unique-local/link-local/loopback, and IPv4-mapped-IPv6 literals; re-validated at call time; `providerFetch` sets `redirect:"error"`. Well tested.
- **API key handling:** secret stored only as ciphertext under `settings/llmSecret`, denied to all clients; client never reads it back; KMS-required-in-prod guard; no key logged.
- **Storage rules:** enforce `size <= 10MB` and `contentType matches image/.*` on create/update, member-scoped.
- **Firestore isolation (non-`areas` paths):** every household subcollection gates on `isHouseholdMember(householdId)` bound from the path; `settings/llmSecret` and catch-all denied; `activity`/`visionJobs` append-only with `createdBy` forgery blocked.
- **Provider response parsing:** malformed/schema-invalid LLM output caught and mapped to `internal`; malformed detections dropped individually; tested.
- **Cold start:** only heavy dep is `@google-cloud/kms`, lazily constructed and skipped in local runtime.
- **Input validation:** every callable applies a `.strict()` zod schema with `.max()` bounds before any Firestore or provider use.
- **Dead index removed:** the `members(role, createdAt)` composite index from the prior review is gone from `firestore.indexes.json`.
