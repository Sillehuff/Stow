# Pre-Launch Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 37 findings from `docs/reviews/2026-06-09-pre-launch-review.md` so Stow is safe and pleasant for first real users.

**Architecture:** Four stacked PRs, each independently green and shippable: (1) P0 client launch-blockers, (2) Functions security hardening, (3) Rules/PWA/config, (4) UX flow bugs and polish. Client fixes center on offline-aware write completion and bootstrap seeding; backend fixes center on Firestore transactions for every read-check-write invariant.

**Tech Stack:** React 19 + TypeScript + Vite PWA, Firebase (Auth/Firestore/Storage/Functions v2), zod, Vitest, Playwright, `@firebase/rules-unit-testing`.

**Branch strategy:** Branch `fix/p0-launch-blockers` off `codex/stow-next-organizer-redesign` (current canonical state, in sync with origin). Each subsequent PR branches off the previous (`fix/functions-hardening` → `fix/rules-pwa-config` → `fix/ux-flows`). Keep base branches alive until ALL stacked PRs merge (GitHub auto-closes PRs whose base is deleted).

**Gates per PR (run before opening each PR):**
```bash
npm test && npm run typecheck && npm run build && npm run functions:build && npm run functions:test && npm run test:rules && npm run test:smoke
```

## Finding → Task coverage map

| Finding | Task | | Finding | Task |
|---|---|---|---|---|
| 1 onboarding cliff | 1.2 | | 20 iOS icons | 3.2 |
| 2 literal escapes | 1.1 | | 21 SW update | 3.3 |
| 3 offline save hang | 1.4 | | 22 SW cache TTL | 3.4 |
| 4 white screen | 1.3 | | 23 shelf frame leak | 4.7 |
| 5 invite race/binding | 2.1, 2.2 | | 24 vite.config.js | 3.5 |
| 6 member tx | 2.3 | | 25 backend deploy | 3.8 |
| 7 storage rules | 3.1 | | 26 sheet reset | 4.8 |
| 8 timeouts/rate limit | 2.6, 2.7 | | 27 capture attr | 4.9 |
| 9 llm forge | 2.5 | | 28 recent sort | 4.10 |
| 10 origin fallback | 2.4 | | 29 zod bounds | 2.8 |
| 11 QR dead end | 4.1 | | 30 mapError | 2.9 |
| 12 back button | 4.2 | | 31 KMS guard | 2.10 |
| 13 camera button | 4.3 | | 32 deleteSpace 500 | 4.11 |
| 14 packing counts | 4.4 | | 33 doc guards | 4.12 |
| 15 double-insert | 1.4, 4.5 | | 34 email cleanup | 4.13 |
| 16 lent status | 4.6 | | 35 dead index | 3.6 |
| 17 bootstrap race | 1.2 | | 36 stow-v3.jsx | 3.7 |
| 18 reorder fails | 4.11 | | 37 deleted item view | 4.1 |
| 19 raw errors | 4.5 | | | |

---

# PR 1 — `fix/p0-launch-blockers` (findings 1, 2, 3, 4, 17, part of 15)

```bash
git checkout codex/stow-next-organizer-redesign && git pull && git checkout -b fix/p0-launch-blockers
```

### Task 1.1: Fix literal `·` / `—` escapes in EditSpaceSheet

**Files:**
- Modify: `src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx:495,529,751`

JSX raw text does not interpret `\uXXXX` escapes — users see the literal characters. Line 615 (`{"—"}`) shows the correct braced pattern.

- [ ] **Step 1: Apply the three fixes**

Line 495: `Areas · drag to reorder` → `Areas {"·"} drag to reorder`
Line 529: `No areas yet — tap Add.` → `No areas yet {"—"} tap Add.`
Line 751: `This space has {itemCount} items — choose where they go:` → `This space has {itemCount} items {"—"} choose where they go:`

- [ ] **Step 2: Verify no raw escapes remain in JSX text**

Run: `grep -n 'u00b7\|u2014' src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx`
Expected: every remaining match is inside `{"..."}` braces.

- [ ] **Step 3: Run checks and commit**

Run: `npm run typecheck && npm test`
Expected: PASS
```bash
git add src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx
git commit -m "fix: render middle-dot/em-dash escapes as characters in EditSpaceSheet"
```

### Task 1.2: Seed starter spaces/areas in a transactional bootstrap

**Files:**
- Modify: `src/features/stow/seed.ts` (add `buildStarterSpaces`)
- Modify: `src/features/household/useHouseholdBootstrap.ts`
- Test: `src/features/stow/seed.test.ts` (new)

Fixes finding 1 (empty household = cannot add items, since AddItemSheet requires space+area) and finding 17 (non-transactional create races invite-accept / second device). Seed **spaces + areas only** — no fake items, no external image URLs.

- [ ] **Step 1: Write the failing test**

Create `src/features/stow/seed.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { buildStarterSpaces, seedSpaceTemplates } from "./seed";

describe("buildStarterSpaces", () => {
  it("produces one space per template with contiguous positions and no items/images", () => {
    const { spaces, areas } = buildStarterSpaces("h1");
    expect(spaces).toHaveLength(seedSpaceTemplates.length);
    spaces.forEach((space, index) => {
      expect(space.householdId).toBe("h1");
      expect(space.position).toBe(index);
      expect("image" in space && space.image !== undefined).toBe(false);
    });
  });

  it("produces areas linked to their space with per-space positions", () => {
    const { areas } = buildStarterSpaces("h1");
    const livingRoomAreas = areas.filter((area) => area.spaceId === "r1");
    expect(livingRoomAreas.map((area) => area.position)).toEqual([0, 1, 2]);
    areas.forEach((area) => expect(area.householdId).toBe("h1"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/stow/seed.test.ts`
Expected: FAIL — `buildStarterSpaces` is not exported.

- [ ] **Step 3: Implement `buildStarterSpaces` in `src/features/stow/seed.ts`**

Add below `normalizeSeedForHousehold`:
```ts
/** Starter layout for a brand-new household: spaces + areas only — no demo items, no external images. */
export function buildStarterSpaces(householdId: string): {
  spaces: Array<Omit<Space, "createdAt" | "updatedAt" | "image">>;
  areas: Array<Omit<Area, "createdAt" | "updatedAt" | "image">>;
} {
  const spaces = seedSpaceTemplates.map((space, index) => ({
    id: space.id,
    householdId,
    name: space.name,
    icon: space.icon,
    color: space.color,
    position: index
  }));
  const areas = seedSpaceTemplates.flatMap((space) =>
    space.areas.map((area, index) => ({
      id: area.id,
      householdId,
      spaceId: space.id,
      name: area.name,
      position: index
    }))
  );
  return { spaces, areas };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/stow/seed.test.ts`
Expected: PASS

- [ ] **Step 5: Make the bootstrap create path transactional and seed it**

In `src/features/household/useHouseholdBootstrap.ts`:

1. Update imports:
```ts
import { deleteField, doc, getDoc, getDocFromServer, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import { buildStarterSpaces } from "@/features/stow/seed";
import { toUserErrorMessage } from "@/lib/firebase/errors";
```

2. Read the user doc server-first so a just-accepted invite isn't masked by cache, falling back to cache so returning users still bootstrap offline. Replace `const userSnap = await getDoc(userRef);` with:
```ts
let userSnap;
try {
  userSnap = await getDocFromServer(userRef);
} catch {
  userSnap = await getDoc(userRef); // offline: cached doc keeps returning users working
}
```

3. Replace the create-path `writeBatch` block (from `const batch = writeBatch(db);` through `await batch.commit();`) with a transaction that re-checks `currentHouseholdId` and seeds starter spaces/areas:
```ts
  const winnerHouseholdId = await runTransaction(db, async (tx) => {
    const fresh = await tx.get(userRef);
    const current = fresh.exists() ? (fresh.data().currentHouseholdId as string | undefined) : undefined;
    if (current) return current; // another device or invite-accept won the race

    tx.set(householdRef, {
      name: `${user.displayName ?? "My"} Household`,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    tx.set(memberRef, {
      uid: user.uid,
      role: "OWNER",
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    tx.set(userRef, {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      currentHouseholdId: householdId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    tx.set(llmRef, {
      enabled: false,
      providerType: "gemini",
      model: "gemini-2.5-flash",
      promptProfile: "default_inventory",
      temperature: 0.2,
      maxTokens: 400
    });

    const starter = buildStarterSpaces(householdId);
    for (const space of starter.spaces) {
      tx.set(doc(db, householdPaths.space(householdId, space.id)), {
        ...space,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    for (const area of starter.areas) {
      tx.set(doc(db, householdPaths.area(householdId, area.spaceId, area.id)), {
        ...area,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return householdId;
  });

  if (winnerHouseholdId !== householdId) {
    // Lost the race — validate the winning household the same way the top of this function does.
    return ensureBootstrap(user);
  }
  return householdId;
```

4. In the hook's `.catch`, map the error for users (offline first-launch now fails fast with a clear message instead of spinning):
```ts
error: toUserErrorMessage(error, "Failed to set up your household")
```

- [ ] **Step 6: Run gates**

Run: `npm run typecheck && npm test && npm run test:smoke`
Expected: PASS. The smoke suite exercises bootstrap; a new user now lands with 4 starter spaces.

- [ ] **Step 7: Commit**

```bash
git add src/features/stow/seed.ts src/features/stow/seed.test.ts src/features/household/useHouseholdBootstrap.ts
git commit -m "fix: seed starter spaces/areas and make bootstrap transactional"
```

### Task 1.3: Render the app even when Firebase init fails

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/lib/firebase/client.ts` (guard `setPersistence`)

- [ ] **Step 1: Guard `setPersistence` in `client.ts`**

Replace the last line of `initializeFirebaseClient` (`await setPersistence(auth, browserLocalPersistence);`) with:
```ts
  try {
    await setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    // Storage-restricted contexts (private mode, blocked IndexedDB): fall back to in-memory session.
    console.error("Auth persistence unavailable, continuing without it", error);
  }
```

- [ ] **Step 2: Make `renderApp` failure visible instead of a white screen**

In `src/main.tsx`, replace `void renderApp();` and the body of `renderApp` so init failure still renders, and a total failure shows recovery UI:
```tsx
async function renderApp() {
  try {
    await initializeFirebaseClient();
  } catch (error) {
    console.error("Firebase initialization failed; rendering anyway", error);
  }

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RootErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </RootErrorBoundary>
    </React.StrictMode>
  );
}

renderApp().catch((error) => {
  console.error("Failed to start Stow", error);
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="font-family:system-ui;padding:32px;text-align:center">' +
      "<h1>Stow couldn’t start</h1>" +
      "<p>Please reload. If you’re in a private window, try a regular one.</p>" +
      '<button onclick="location.reload()" style="padding:8px 20px">Reload</button></div>';
  }
});
```

- [ ] **Step 3: Run gates and commit**

Run: `npm run typecheck && npm test && npm run build`
Expected: PASS
```bash
git add src/main.tsx src/lib/firebase/client.ts
git commit -m "fix: never white-screen when Firebase init/persistence fails"
```

### Task 1.4: Offline-aware write completion for create flows

**Files:**
- Create: `src/lib/firebase/completeWrite.ts`
- Test: `src/lib/firebase/completeWrite.test.ts` (new)
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx` (AddItemSheet `onCreate`, AddSpaceSheet/AddAreaSheet create handlers)
- Modify: `src/features/stow/ui/mobile/capture/QuickCapture.tsx` (commit)

With `persistentLocalCache`, `setDoc` resolves only on **server ack** — offline, every "Saving…" spinner hangs forever while the optimistic write already shows in the list. Also folds in finding 15 for the create path: activity logging becomes best-effort so its failure can't fake a save failure and cause duplicate items on retry.

- [ ] **Step 1: Write the failing test**

Create `src/lib/firebase/completeWrite.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { completeWrite } from "./completeWrite";

describe("completeWrite", () => {
  it("awaits the write and reports committed when online", async () => {
    await expect(completeWrite(Promise.resolve("id"), () => true)).resolves.toBe(true);
  });

  it("resolves immediately as not-committed when offline, even if the write never settles", async () => {
    const never = new Promise(() => {});
    await expect(completeWrite(never, () => false)).resolves.toBe(false);
  });

  it("swallows background rejection when offline (no unhandled rejection)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = Promise.reject(new Error("boom"));
    await expect(completeWrite(failing, () => false)).resolves.toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("propagates rejection when online", async () => {
    await expect(completeWrite(Promise.reject(new Error("boom")), () => true)).rejects.toThrow("boom");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/firebase/completeWrite.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/firebase/completeWrite.ts`**

```ts
/**
 * With persistent local cache, Firestore write promises resolve only on SERVER ack.
 * Offline, the local (optimistic) write has already applied — block the UI on the
 * server ack only when online. Returns whether the write is server-committed.
 */
export function completeWrite(
  write: Promise<unknown>,
  isOnline: () => boolean = () => navigator.onLine
): Promise<boolean> {
  if (isOnline()) {
    return write.then(() => true);
  }
  write.catch((error) => console.error("Queued offline write failed", error));
  return Promise.resolve(false);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/firebase/completeWrite.test.ts`
Expected: PASS

- [ ] **Step 5: Apply to the AddItemSheet `onCreate` handler in StowMobileApp**

In `src/features/stow/ui/mobile/StowMobileApp.tsx`, add import `import { completeWrite } from "@/lib/firebase/completeWrite";` and replace the `AddItemSheet` `onCreate` body (currently `const itemId = await data.actions.createItem({...}); await data.actions.logActivity({...}); flash("Item added"); nav.closeOverlay();`) with:
```tsx
onCreate={async (input) => {
  const destinationSpace = data.spaces.find((space) => space.id === input.spaceId) ?? null;
  const write = data.actions
    .createItem({
      householdId,
      userId,
      name: input.name,
      spaceId: input.spaceId,
      areaId: input.areaId,
      areaNameSnapshot: input.areaNameSnapshot,
      value: input.value ?? undefined,
      tags: input.tags,
      notes: input.notes,
      image: input.image ?? undefined,
      entryMode: input.entryMode
    })
    .then((itemId) => {
      // Best-effort: an activity-log failure must not look like a failed save (it caused duplicate items on retry).
      data.actions
        .logActivity({
          householdId,
          entry: buildActivityEntry({
            type: "item_added",
            actorUid: userId,
            actorName,
            itemName: input.name,
            spaceName: destinationSpace?.name,
            areaName: input.areaNameSnapshot,
            spaceId: input.spaceId,
            areaId: input.areaId,
            itemId
          })
        })
        .catch((error) => console.error("Activity log failed", error));
      return itemId;
    });
  const committed = await completeWrite(write);
  flash(committed ? "Item added" : "Item saved — will sync when you’re online");
  nav.closeOverlay();
}}
```

- [ ] **Step 6: Apply the same pattern to AddSpaceSheet / AddAreaSheet handlers**

Find the AddSpaceSheet/AddAreaSheet `onCreate` handlers in `StowMobileApp.tsx` (the area handler ends with `.then(() => flash("Area added"))` near line 530). Rewrite each as:
```tsx
const committed = await completeWrite(data.actions.createSpace({ /* unchanged args */ }));
flash(committed ? "Space added" : "Space saved — will sync");
nav.closeOverlay();
```
(and equivalently `createArea` / `"Area added"`). Keep all existing arguments unchanged; only the await/flash structure changes. If the handler is not `async`, make it `async`.

- [ ] **Step 7: Apply to QuickCapture commit**

In `src/features/stow/ui/mobile/capture/QuickCapture.tsx`, locate the `commit` function (calls the batch-create around lines 268-291). Wrap the batch write:
```tsx
const committed = await completeWrite(createPromise);
```
where `createPromise` is the existing batch-create call, and pass `committed` into the existing success path so the completion flash reads `committed ? <existing text> : "Saved — will sync when you’re online"`. The error path (`setCommitError`) is unchanged — it now only fires for real (online) failures.

- [ ] **Step 8: Run gates and commit**

Run: `npm run typecheck && npm test && npm run test:smoke`
Expected: PASS
```bash
git add src/lib/firebase/completeWrite.ts src/lib/firebase/completeWrite.test.ts src/features/stow/ui/mobile/StowMobileApp.tsx src/features/stow/ui/mobile/capture/QuickCapture.tsx
git commit -m "fix: don't hang create flows on server ack while offline; best-effort activity log"
```

### Task 1.5: Open PR 1

- [ ] Run the full gate block (top of plan). Expected: all PASS.
- [ ] ```bash
git push -u origin fix/p0-launch-blockers
gh pr create --draft --title "P0 launch blockers: onboarding seed, escape text, offline saves, init fallback" --body "Fixes findings 1, 2, 3, 4, 17 (+15 create path) from docs/reviews/2026-06-09-pre-launch-review.md"
```

---

# PR 2 — `fix/functions-hardening` (findings 5, 6, 8, 9, 10, 29, 30, 31)

```bash
git checkout fix/p0-launch-blockers && git checkout -b fix/functions-hardening
```

All tests in this PR follow the existing `functions/test/*.test.ts` pattern: `vi.mock("../src/shared/firestore.js", ...)` / `vi.mock("../src/shared/authz.js", ...)` then `await import` the handler (see `functions/test/members.test.ts` for the canonical mock shape). Extend the firestore mock with `runTransaction: vi.fn(async (fn) => fn(tx))` where `tx = { get: vi.fn(), set: vi.fn(), update: vi.fn(), delete: vi.fn() }`.

### Task 2.1: Transactional single-use invite acceptance

**Files:**
- Modify: `functions/src/invites.ts` (`acceptHouseholdInviteHandler`)
- Test: `functions/test/invites.test.ts`

- [ ] **Step 1: Write the failing test**

In `functions/test/invites.test.ts`, extend the firestore mock with `runTransaction` (per pattern above) and add:
```ts
it("rejects acceptance when the invite was already accepted at transaction time", async () => {
  // Query (outside tx) returns a pending invite; the transactional re-read sees acceptedAt set.
  tx.get.mockResolvedValue({
    exists: true,
    data: () => ({ role: "MEMBER", acceptedAt: "already" }),
    get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
  });
  await expect(
    acceptHouseholdInviteHandler({ householdId: "h1", token: "a".repeat(32) }, { uid: "u2", token: { email: "u2@example.com" } })
  ).rejects.toMatchObject({ code: "already-exists" });
  expect(tx.set).not.toHaveBeenCalled();
});

it("writes member, user, and invite updates inside the transaction on success", async () => {
  tx.get.mockResolvedValue({
    exists: true,
    data: () => ({ role: "MEMBER" }),
    get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
  });
  await acceptHouseholdInviteHandler({ householdId: "h1", token: "a".repeat(32) }, { uid: "u2", token: { email: "u2@example.com" } });
  expect(tx.set).toHaveBeenCalledTimes(2); // member + user
  expect(tx.update).toHaveBeenCalledTimes(1); // invite acceptedAt
});
```
Adapt the invite-query mock so the initial `collection().where().limit().get()` resolves with one doc whose `.ref` is a sentinel the `tx.get` mock recognizes.

- [ ] **Step 2: Run to verify failure**

Run: `npm run functions:test`
Expected: new tests FAIL (handler still uses `db.batch()`; `tx.*` never called).

- [ ] **Step 3: Implement**

In `acceptHouseholdInviteHandler`, keep the tokenHash query to locate `inviteDoc.ref`, then replace everything from the `inviteData` cast through `await batch.commit();` with:
```ts
  const inviteRef = inviteDoc.ref;
  const memberRef = db.doc(paths.member(input.householdId, uid));
  const userRef = db.doc(paths.user(uid));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(inviteRef);
    if (!snap.exists) throw new HttpsError("not-found", "Invite not found or invalid");
    const inviteData = snap.data() as {
      role: string;
      expiresAt?: { toDate?: () => Date } | Date;
      acceptedAt?: unknown;
      invitedEmail?: string | null;
    };

    if (inviteData.acceptedAt) throw new HttpsError("already-exists", "Invite has already been used");

    const expiresDate =
      inviteData.expiresAt instanceof Date ? inviteData.expiresAt : inviteData.expiresAt?.toDate?.();
    if (expiresDate && expiresDate.getTime() < Date.now()) {
      throw new HttpsError("deadline-exceeded", "Invite has expired");
    }

    tx.set(
      memberRef,
      {
        uid,
        role: inviteData.role,
        email: requestAuth?.token?.email ?? null,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: snap.get("createdBy") ?? null
      },
      { merge: true }
    );
    tx.set(
      userRef,
      { currentHouseholdId: input.householdId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.update(inviteRef, { acceptedAt: FieldValue.serverTimestamp(), acceptedBy: uid });
  });
  return { ok: true as const };
```

- [ ] **Step 4: Run to verify pass:** `npm run functions:test` → PASS
- [ ] **Step 5: Commit**
```bash
git add functions/src/invites.ts functions/test/invites.test.ts
git commit -m "fix: enforce single-use invite acceptance atomically"
```

### Task 2.2: Optional email binding for invites

**Files:**
- Modify: `functions/src/shared/schemas.ts` (`createInviteInputSchema`)
- Modify: `functions/src/invites.ts` (create + accept)
- Modify: `src/lib/firebase/functions.ts` (`createHouseholdInvite` input type)
- Modify: `src/features/stow/ui/mobile/screens/SettingsScreen.tsx` (optional email field)
- Test: `functions/test/invites.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("rejects acceptance when the invite is bound to a different email", async () => {
  tx.get.mockResolvedValue({
    exists: true,
    data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
    get: () => undefined
  });
  await expect(
    acceptHouseholdInviteHandler({ householdId: "h1", token: "a".repeat(32) }, { uid: "u2", token: { email: "mallory@example.com" } })
  ).rejects.toMatchObject({ code: "permission-denied" });
});

it("accepts case-insensitively when the bound email matches", async () => {
  tx.get.mockResolvedValue({
    exists: true,
    data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
    get: () => undefined
  });
  await expect(
    acceptHouseholdInviteHandler({ householdId: "h1", token: "a".repeat(32) }, { uid: "u2", token: { email: "Alice@Example.com" } })
  ).resolves.toEqual({ ok: true });
});
```

- [ ] **Step 2: Run to verify failure:** `npm run functions:test` → FAIL
- [ ] **Step 3: Implement**

`schemas.ts` — add to `createInviteInputSchema`:
```ts
  email: z.string().email().max(320).optional()
```
`invites.ts` create handler — add to the `inviteRef.set({...})` payload:
```ts
    invitedEmail: input.email?.trim().toLowerCase() ?? null,
```
`invites.ts` accept transaction — after the expiry check:
```ts
    if (inviteData.invitedEmail) {
      const callerEmail = (requestAuth?.token?.email ?? "").trim().toLowerCase();
      if (callerEmail !== inviteData.invitedEmail) {
        throw new HttpsError("permission-denied", "This invite was issued to a different email address");
      }
    }
```
`src/lib/firebase/functions.ts` — extend the `createHouseholdInvite` input type with `email?: string;`.

- [ ] **Step 4: Wire an optional email field into Settings invite creation**

In `SettingsScreen.tsx`, find the invite-creation UI (`grep -n "createHouseholdInvite\|Invite created" src/features/stow/ui/mobile/screens/SettingsScreen.tsx`). Add local state `const [inviteEmail, setInviteEmail] = useState("");`, render above the create button:
```tsx
<Field
  label="Restrict to email (optional)"
  value={inviteEmail}
  onChange={setInviteEmail}
  placeholder="name@example.com"
/>
```
and pass `email: inviteEmail.trim() || undefined` into the `createHouseholdInvite({...})` call, then `setInviteEmail("")` on success. Match the surrounding `Field`/`Button` usage already in the file.

- [ ] **Step 5: Run gates and commit**

Run: `npm run functions:test && npm run typecheck && npm test`
```bash
git add functions/src/shared/schemas.ts functions/src/invites.ts src/lib/firebase/functions.ts src/features/stow/ui/mobile/screens/SettingsScreen.tsx functions/test/invites.test.ts
git commit -m "feat: optional email-bound household invites"
```

### Task 2.3: Transactional member role changes and removal

**Files:**
- Modify: `functions/src/members.ts`
- Test: `functions/test/members.test.ts`

- [ ] **Step 1: Write the failing test**

Extend the firestore mock in `members.test.ts` with `runTransaction: vi.fn(async (fn) => fn(tx))` and `tx = { get: vi.fn(), set: vi.fn(), delete: vi.fn() }`. `tx.get` must handle both a doc ref (member) and a query (owners count) — branch on the argument:
```ts
it("blocks last-owner demotion using the owner count read inside the transaction", async () => {
  requireHouseholdAdmin.mockResolvedValue("OWNER");
  tx.get.mockImplementation(async (refOrQuery: unknown) => {
    if (refOrQuery === memberRef) {
      return { exists: true, get: (f: string) => (f === "role" ? "OWNER" : undefined), data: () => ({ role: "OWNER" }) };
    }
    return { size: 1 }; // owners query: this is the last owner
  });
  await expect(
    updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "MEMBER" }, "owner-1")
  ).rejects.toMatchObject({ code: "failed-precondition" });
  expect(tx.set).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run to verify failure:** `npm run functions:test` → FAIL
- [ ] **Step 3: Implement**

Rewrite both handlers so read → invariant → write happens inside one transaction. Shape for `updateHouseholdMemberRoleHandler` (mirror for remove, using `tx.delete(memberRef)` and the user-doc cleanup `tx.set`):
```ts
export async function updateHouseholdMemberRoleHandler(raw: unknown, actorUid: string) {
  const input = updateMemberRoleInputSchema.parse(raw);
  const actorRole = (await requireHouseholdAdmin(input.householdId, actorUid)) as Role;
  const memberRef = db.doc(paths.member(input.householdId, input.uid));
  const ownersQuery = db.collection(paths.members(input.householdId)).where("role", "==", "OWNER");

  await db.runTransaction(async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) throw new HttpsError("not-found", "Household member not found");
    const targetRole = memberSnap.get("role") as Role;
    if (targetRole !== "OWNER" && targetRole !== "ADMIN" && targetRole !== "MEMBER") {
      throw new HttpsError("failed-precondition", "Household member role is invalid");
    }

    if (actorRole === "ADMIN") assertAdminTargetAllowed(targetRole, input.role);

    const isOwnerDemotion = targetRole === "OWNER" && input.role !== "OWNER";
    if (actorRole !== "ADMIN" && isOwnerDemotion) {
      const owners = await tx.get(ownersQuery);
      if (owners.size <= 1) {
        throw new HttpsError("failed-precondition", "This household must keep at least one owner");
      }
    }

    if (targetRole === input.role) return;
    tx.set(
      memberRef,
      { uid: input.uid, role: input.role, updatedAt: FieldValue.serverTimestamp(), updatedBy: actorUid },
      { merge: true }
    );
  });
  return { ok: true as const };
}
```
For `removeHouseholdMemberHandler`: same structure; read the target member and (when owner-removal by an owner) the owners query inside the tx; read the user doc with `tx.get(db.doc(paths.user(input.uid)))`; then `tx.delete(memberRef)` and conditional `tx.set(userRef, { currentHouseholdId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true })`. Delete the now-unused `getMemberRecord`, `countOwners`, and `assertMemberManagementAllowed` helpers (keep `assertAdminTargetAllowed`).

- [ ] **Step 4: Update existing tests that stubbed `batch`/`countOwners`** to drive `tx.*` instead; all members tests green: `npm run functions:test` → PASS
- [ ] **Step 5: Commit**
```bash
git add functions/src/members.ts functions/test/members.test.ts
git commit -m "fix: enforce member-role invariants inside transactions (no zero-owner races)"
```

### Task 2.4: Require APP_BASE_URL in production for invite links

**Files:**
- Modify: `functions/src/invites.ts`
- Test: `functions/test/invites.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
it("refuses to build invite links from the Origin header in production", async () => {
  process.env.K_SERVICE = "stow-fn";
  delete process.env.APP_BASE_URL;
  try {
    await expect(
      createHouseholdInviteHandler({ householdId: "h1", role: "MEMBER" }, { uid: "admin-1" }, "https://evil.example")
    ).rejects.toMatchObject({ code: "failed-precondition" });
  } finally {
    delete process.env.K_SERVICE;
  }
});
```

- [ ] **Step 2: Run to verify failure:** `npm run functions:test` → FAIL
- [ ] **Step 3: Implement** — in `invites.ts`, replace `const baseUrl = process.env.APP_BASE_URL ?? originHeader ?? "http://localhost:5173";` with:
```ts
  const baseUrl = resolveInviteBaseUrl(originHeader);
```
and add:
```ts
function resolveInviteBaseUrl(originHeader?: string): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL;
  if (process.env.K_SERVICE) {
    // Never derive user-facing links from a client-controlled header in production.
    throw new HttpsError("failed-precondition", "Server is missing APP_BASE_URL configuration");
  }
  return originHeader ?? "http://localhost:5173";
}
```

- [ ] **Step 4: Run to verify pass**, then commit:
```bash
git add functions/src/invites.ts functions/test/invites.test.ts
git commit -m "fix: require APP_BASE_URL for invite links in production"
```

### Task 2.5: Stop clients forging LLM validation state

**Files:**
- Modify: `functions/src/shared/schemas.ts` (`saveLlmConfigInputSchema`)
- Test: `functions/test/schemas.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
it("rejects client-supplied validation/audit fields in saveLlmConfig input", () => {
  const result = saveLlmConfigInputSchema.safeParse({
    householdId: "h1",
    config: {
      enabled: true,
      providerType: "gemini",
      model: "gemini-2.5-flash",
      promptProfile: "default_inventory",
      lastValidatedAt: new Date(),
      lastValidatedBy: "forged"
    }
  });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure** (zod strips unknown-but-present keys silently today, and the fields are currently *in* the schema, so parse succeeds): `npm run functions:test` → FAIL
- [ ] **Step 3: Implement** — in `schemas.ts`:
```ts
export const saveLlmConfigInputSchema = z.object({
  householdId: z.string().min(1),
  config: llmConfigSchema.omit({ lastValidatedAt: true, lastValidatedBy: true }).strict()
});
```
`validateHouseholdLlmConfigHandler` keeps writing `lastValidatedAt/By` server-side — that path is unchanged.

- [ ] **Step 4: Run to verify pass** (also run `npm test` — the client sends full `HouseholdLlmConfig`; if `SettingsScreen` currently passes `lastValidatedAt` through on save, strip those two fields at the call site). Commit:
```bash
git add functions/src/shared/schemas.ts functions/test/schemas.test.ts
git commit -m "fix: only the validate handler may write LLM validation state"
```

### Task 2.6: Timeouts on all provider HTTP calls

**Files:**
- Modify: `functions/src/providers/common.ts` (add `providerFetch`)
- Modify: `functions/src/providers/anthropic.ts` (2 sites), `openaiCompatible.ts` (2 sites), `gemini.ts` (3 sites)
- Test: `functions/test/common-provider.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
it("aborts provider requests after the timeout with deadline-exceeded", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      })
    )
  );
  try {
    const pending = providerFetch("https://example.com", { method: "POST" });
    const assertion = expect(pending).rejects.toMatchObject({ code: "deadline-exceeded" });
    await vi.advanceTimersByTimeAsync(30_001);
    await assertion;
  } finally {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
```

- [ ] **Step 2: Run to verify failure:** `npm run functions:test` → FAIL (`providerFetch` not exported)
- [ ] **Step 3: Implement** in `common.ts`:
```ts
import { HttpsError } from "firebase-functions/v2/https";

const PROVIDER_TIMEOUT_MS = 30_000;

/** fetch with a hard timeout — a hung provider must not pin the function until the platform kills it. */
export async function providerFetch(url: string, init: RequestInit, timeoutMs = PROVIDER_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new HttpsError("deadline-exceeded", "AI provider request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
```
Then replace every bare `await fetch(` with `await providerFetch(` in `anthropic.ts:6,48`, `openaiCompatible.ts:11,52`, `gemini.ts:107,141,148` (import `providerFetch` from `./common.js`).

- [ ] **Step 4: Run to verify pass:** `npm run functions:test` → PASS (existing provider tests that stub `fetch` keep working — `providerFetch` delegates to global fetch)
- [ ] **Step 5: Commit**
```bash
git add functions/src/providers/
git commit -m "fix: 30s abort timeout on every provider HTTP call"
```

### Task 2.7: Per-household daily rate limit on vision calls

**Files:**
- Create: `functions/src/shared/rateLimit.ts`
- Modify: `functions/src/vision.ts` (both handlers)
- Test: `functions/test/rateLimit.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `functions/test/rateLimit.test.ts` (mock `../src/shared/firestore.js` per the members.test.ts pattern, with `runTransaction` driving a `tx` whose `get` returns a usage snapshot):
```ts
it("increments usage under the limit", async () => {
  tx.get.mockResolvedValue({ exists: false, get: () => undefined });
  await expect(consumeVisionQuota("h1")).resolves.toBeUndefined();
  expect(tx.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 1 }));
});

it("throws resource-exhausted at the daily cap", async () => {
  const today = new Date().toISOString().slice(0, 10);
  tx.get.mockResolvedValue({
    exists: true,
    get: (f: string) => (f === "day" ? today : f === "count" ? 200 : undefined)
  });
  await expect(consumeVisionQuota("h1")).rejects.toMatchObject({ code: "resource-exhausted" });
});

it("resets the counter on a new day", async () => {
  tx.get.mockResolvedValue({
    exists: true,
    get: (f: string) => (f === "day" ? "2020-01-01" : f === "count" ? 999 : undefined)
  });
  await expect(consumeVisionQuota("h1")).resolves.toBeUndefined();
  expect(tx.set).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 1 }));
});
```

- [ ] **Step 2: Run to verify failure:** `npm run functions:test` → FAIL
- [ ] **Step 3: Implement `functions/src/shared/rateLimit.ts`**
```ts
import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db } from "./firestore.js";

const DEFAULT_DAILY_LIMIT = 200;

/** Transactional per-household daily counter. settings/* is client-denied by rules, so only functions write it. */
export async function consumeVisionQuota(householdId: string): Promise<void> {
  const limit = Number(process.env.VISION_DAILY_LIMIT ?? DEFAULT_DAILY_LIMIT);
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`households/${householdId}/settings/visionUsage`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const sameDay = snap.exists && snap.get("day") === day;
    const used = sameDay ? Number(snap.get("count") ?? 0) : 0;
    if (used >= limit) {
      throw new HttpsError("resource-exhausted", "Daily AI scan limit reached for this household. Try again tomorrow.");
    }
    tx.set(ref, { day, count: used + 1, updatedAt: FieldValue.serverTimestamp() });
  });
}
```

- [ ] **Step 4: Call it in both vision handlers** — in `vision.ts`, immediately after the `requireHouseholdMember(...)` line in `visionCategorizeItemImageHandler` and `visionDetectShelfItemsHandler`:
```ts
  await consumeVisionQuota(input.householdId);
```
(import from `./shared/rateLimit.js`).

- [ ] **Step 5: Run to verify pass** (`npm run functions:test` — update `functions/test/vision.test.ts` mocks to stub `consumeVisionQuota` via `vi.mock("../src/shared/rateLimit.js", () => ({ consumeVisionQuota: vi.fn() }))` if they fail). Commit:
```bash
git add functions/src/shared/rateLimit.ts functions/src/vision.ts functions/test/
git commit -m "feat: per-household daily rate limit on vision calls"
```

### Task 2.8: Bound all input strings; strict input objects

**Files:**
- Modify: `functions/src/shared/schemas.ts`
- Test: `functions/test/schemas.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
it("rejects oversized ids and unknown fields", () => {
  expect(
    acceptInviteInputSchema.safeParse({ householdId: "x".repeat(200), token: "a".repeat(32) }).success
  ).toBe(false);
  expect(
    acceptInviteInputSchema.safeParse({ householdId: "h1", token: "a".repeat(32), extra: true }).success
  ).toBe(false);
});
```

- [ ] **Step 2: Run to verify failure:** `npm run functions:test` → FAIL
- [ ] **Step 3: Implement** — in `schemas.ts`, define shared bounded primitives at the top and apply throughout:
```ts
const idString = z.string().min(1).max(128);
const shortString = z.string().max(300);
```
Apply: every `householdId`/`uid`/`inviteId` → `idString`; `token` → `z.string().min(20).max(256)`; `model` → `z.string().min(1).max(200)`; `baseUrl` → `z.string().url().max(500).optional()`; `apiKey` → `z.string().min(8).max(500)`; vision `context` fields and `areaName` → `shortString.optional()` (keep `spaceId`/`areaId` as `idString.optional()`); `storagePath` → `z.string().min(1).max(1024)`. Add `.strict()` to every **input** schema object (`createInviteInputSchema`, `acceptInviteInputSchema`, `revokeInviteInputSchema`, `updateMemberRoleInputSchema`, `removeMemberInputSchema`, `saveLlmConfigInputSchema`, `setLlmSecretInputSchema`, `validateLlmConfigInputSchema`, `visionCategorizeInputSchema` + its nested `context`, `visionDetectShelfInputSchema`, `visionImageRefSchema`). Do NOT add `.strict()` to provider **output** schemas (`visionSuggestionSchema`, `shelfDetectionSchema`, `visionDetectShelfResultSchema`) — providers may add fields.

- [ ] **Step 4: Run all suites** (`npm run functions:test && npm test` — the client must not be sending extra fields; fix any call site the tests surface). Commit:
```bash
git add functions/src/shared/schemas.ts functions/test/schemas.test.ts
git commit -m "fix: bound and strictly validate all callable inputs"
```

### Task 2.9: Generic internal error messages to clients

**Files:**
- Modify: `functions/src/index.ts` (`mapError`)

- [ ] **Step 1: Implement** — replace the last line of `mapError`:
```ts
  logger.error("Unhandled function error", error);
  return new HttpsError("internal", "Something went wrong. Please try again.");
```
(Detail stays in server logs; raw `error.message` no longer reaches clients.)

- [ ] **Step 2: Run gates and commit**

Run: `npm run functions:build && npm run functions:test`
```bash
git add functions/src/index.ts
git commit -m "fix: never return raw internal error messages to clients"
```

### Task 2.10: Require KMS in true production runtimes

**Files:**
- Modify: `functions/src/crypto/kms.ts` (`assertLocalFallbackAllowed`)
- Test: `functions/test/kms.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
it("refuses local-key crypto in production even with a custom seed", async () => {
  process.env.K_SERVICE = "stow-fn";
  process.env.LOCAL_SECRET_ENCRYPTION_KEY = "custom-not-placeholder";
  delete process.env.KMS_KEY_NAME;
  delete process.env.FIREBASE_EMULATOR_HUB;
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await expect(encryptSecret("sk-test")).rejects.toThrow(/KMS_KEY_NAME/);
  } finally {
    delete process.env.K_SERVICE;
    delete process.env.LOCAL_SECRET_ENCRYPTION_KEY;
    process.env.NODE_ENV = prevNodeEnv;
  }
});
```
(Match the existing kms.test.ts env-juggling/reset pattern — it already manipulates these vars; if the module caches config, follow that file's existing `vi.resetModules()` approach.)

- [ ] **Step 2: Run to verify failure:** `npm run functions:test` → FAIL (custom seed currently bypasses the guard)
- [ ] **Step 3: Implement** — in `assertLocalFallbackAllowed`, delete the seed-bypass line so it reads:
```ts
function assertLocalFallbackAllowed() {
  if (getKmsKeyName()) return;
  if (isLocalRuntime()) return;
  throw new Error(
    "Secret encryption is misconfigured: KMS_KEY_NAME must be set in production runtimes."
  );
}
```

- [ ] **Step 4: Run to verify pass**, update any existing kms test that relied on the custom-seed bypass, commit:
```bash
git add functions/src/crypto/kms.ts functions/test/kms.test.ts
git commit -m "fix: production secret encryption requires KMS, no env-key fallback"
```

### Task 2.11: Open PR 2

- [ ] Run the full gate block. Expected: all PASS.
- [ ] ```bash
git push -u origin fix/functions-hardening
gh pr create --draft --base fix/p0-launch-blockers --title "Functions hardening: invite/member transactions, timeouts, rate limit, strict schemas" --body "Fixes findings 5, 6, 8, 9, 10, 29, 30, 31 from docs/reviews/2026-06-09-pre-launch-review.md"
```
- [ ] **Deploy note for later:** functions changes require `firebase deploy --only functions` AND setting `APP_BASE_URL` + `KMS_KEY_NAME` env config in prod **before** deploying Tasks 2.4/2.10, or invite creation and secret writes will fail closed. Get user approval before any deploy.

---

# PR 3 — `fix/rules-pwa-config` (findings 7, 20, 21, 22, 24, 25, 35, 36)

```bash
git checkout fix/functions-hardening && git checkout -b fix/rules-pwa-config
```

### Task 3.1: Storage upload size/MIME limits + storage rules tests

**Files:**
- Modify: `storage.rules`
- Create: `tests/storage.rules.test.ts`
- Modify: `package.json` (`test:rules` and `test` scripts)

**Important:** `allow write` covers create/update/**delete**, and delete has `request.resource == null` — a single combined condition would break `bestEffortDeleteImage` for every member. Split the verbs.

- [ ] **Step 1: Write the failing test**

Create `tests/storage.rules.test.ts` (mirror the `initializeTestEnvironment` setup in `tests/firestore.rules.test.ts`, but pass `storage: { rules: readFileSync("storage.rules", "utf8") }` and `firestore: { rules: readFileSync("firestore.rules", "utf8") }` — the storage rules call `firestore.exists`, so seed the member doc with `withSecurityRulesDisabled` exactly like the firestore suite does):
```ts
import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteObject, ref, uploadBytes } from "firebase/storage";

const PROJECT_ID = "stow-storage-rules-test";
const HOUSEHOLD_ID = "household-1";
const IMAGE_PATH = `households/${HOUSEHOLD_ID}/items/item-1/photo.jpg`;
let testEnv: RulesTestEnvironment;

// beforeAll: initializeTestEnvironment with firestore+storage rules;
// beforeEach: clearStorage + seed members/member-1 via withSecurityRulesDisabled (firestore);
// afterAll: cleanup. Mirror tests/firestore.rules.test.ts.

const smallJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

describe("storage rules", () => {
  it("lets members upload small images", async () => {
    const storage = testEnv.authenticatedContext("member-1").storage();
    await assertSucceeds(uploadBytes(ref(storage, IMAGE_PATH), smallJpeg, { contentType: "image/jpeg" }));
  });

  it("rejects non-image content types", async () => {
    const storage = testEnv.authenticatedContext("member-1").storage();
    await assertFails(uploadBytes(ref(storage, IMAGE_PATH), smallJpeg, { contentType: "text/plain" }));
  });

  it("rejects uploads over 10 MB", async () => {
    const storage = testEnv.authenticatedContext("member-1").storage();
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    await assertFails(uploadBytes(ref(storage, IMAGE_PATH), big, { contentType: "image/jpeg" }));
  });

  it("still lets members delete objects", async () => {
    const storage = testEnv.authenticatedContext("member-1").storage();
    await assertSucceeds(uploadBytes(ref(storage, IMAGE_PATH), smallJpeg, { contentType: "image/jpeg" }));
    await assertSucceeds(deleteObject(ref(storage, IMAGE_PATH)));
  });

  it("denies non-members entirely", async () => {
    const storage = testEnv.authenticatedContext("stranger").storage();
    await assertFails(uploadBytes(ref(storage, IMAGE_PATH), smallJpeg, { contentType: "image/jpeg" }));
  });
});
```

- [ ] **Step 2: Update scripts so the new suite runs under emulators (and never under `npm test`)**

In `package.json`:
```json
"test": "vitest run --exclude 'tests/**'",
"test:rules": "./scripts/with-java.sh firebase emulators:exec --project demo-stow --only firestore,storage \"vitest run tests/firestore.rules.test.ts tests/storage.rules.test.ts\"",
```
(`--exclude 'tests/**'` replaces the two per-path excludes and also covers the new file; `scripts/backfill.test.ts` is unaffected.)

- [ ] **Step 3: Run to verify the size/MIME tests fail**

Run: `npm run test:rules`
Expected: "rejects non-image content types" and "rejects uploads over 10 MB" FAIL (current rules allow them); the rest pass.

- [ ] **Step 4: Implement** — replace the match block in `storage.rules`:
```
    match /households/{householdId}/{allPaths=**} {
      allow read: if isMember(householdId);
      allow create, update: if isMember(householdId)
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow delete: if isMember(householdId);
    }
```

- [ ] **Step 5: Run to verify pass:** `npm run test:rules` → all PASS. Also `npm test` (exclusion change) and `npm run test:smoke` (uploads still work end to end).
- [ ] **Step 6: Commit**
```bash
git add storage.rules tests/storage.rules.test.ts package.json
git commit -m "fix: enforce image-only 10MB uploads in storage rules, with emulator tests"
```

### Task 3.2: Real PNG icons + apple-touch-icon for iOS installs

**Files:**
- Create: `scripts/generate-icons.mjs`
- Create (generated): `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon.png`
- Modify: `public/manifest.webmanifest`, `index.html`, `vite.config.ts` (`includeAssets`)

- [ ] **Step 1: Add sharp and the generation script**

Run: `npm install -D sharp`
Create `scripts/generate-icons.mjs`:
```js
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/icons/icon-512.svg");

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile("public/icons/icon-192.png");
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile("public/icons/icon-512.png");
await sharp(svg, { density: 300 }).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png");

// Maskable: icon at ~80% on a full-bleed brand background so circular masks don't clip it.
const inner = await sharp(svg, { density: 300 }).resize(410, 410).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#1A1A2E" } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/icons/icon-maskable-512.png");

console.log("Icons generated.");
```

- [ ] **Step 2: Generate and eyeball**

Run: `node scripts/generate-icons.mjs && ls -la public/icons/`
Expected: four PNGs exist with non-trivial sizes. Open them to confirm they render (not blank).

- [ ] **Step 3: Update the manifest** — replace the `icons` array in `public/manifest.webmanifest`:
```json
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
```

- [ ] **Step 4: Add the iOS link** — in `index.html` `<head>`, next to the existing icon link:
```html
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```
And in `vite.config.ts`, extend `includeAssets`:
```ts
      includeAssets: ["icons/icon-192.svg", "icons/icon-512.svg", "icons/*.png"],
```

- [ ] **Step 5: Build, verify, commit**

Run: `npm run build && ls dist/icons/`
Expected: PNGs present in `dist/icons/`.
```bash
git add scripts/generate-icons.mjs public/icons/ public/manifest.webmanifest index.html vite.config.ts package.json package-lock.json
git commit -m "fix: PNG manifest icons + apple-touch-icon so iOS installs get a real icon"
```

### Task 3.3: Periodic service-worker update checks

**Files:**
- Modify: `src/lib/pwa/usePwaInstall.ts`

- [ ] **Step 1: Implement** — replace `const { needRefresh, updateServiceWorker } = useRegisterSW();` with:
```ts
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Long-lived installed PWAs never re-navigate; poll hourly so deploys actually reach users.
      setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    }
  });
```

- [ ] **Step 2: Run gates and commit**

Run: `npm run typecheck && npm test && npm run build`
```bash
git add src/lib/pwa/usePwaInstall.ts
git commit -m "fix: hourly SW update check so installed clients pick up deploys"
```

### Task 3.4: Shorten Firebase Storage image cache TTL

**Files:**
- Modify: `vite.config.ts:55`

- [ ] **Step 1: Implement** — change `maxAgeSeconds: 60 * 60 * 24 * 30` to:
```ts
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days: balances offline access vs. media lingering after member removal
```

- [ ] **Step 2: Build and commit**

Run: `npm run build`
```bash
git add vite.config.ts
git commit -m "fix: cap SW image cache at 7 days (revoked members keep cached media shorter)"
```

### Task 3.5: Stop emitting `vite.config.js` artifacts that shadow `vite.config.ts`

**Files:**
- Modify: `tsconfig.node.json`
- Modify: `.gitignore`
- Delete (untracked artifacts): `vite.config.js`, `vite.config.d.ts`, `tsconfig.app.tsbuildinfo`, `tsconfig.node.tsbuildinfo`

Vite resolves `vite.config.js` **before** `vite.config.ts`; `tsc -b` currently emits a `.js` copy at the repo root, so a stale artifact silently overrides config edits in local dev.

- [ ] **Step 1: Redirect tsc output** — in `tsconfig.node.json` add inside `compilerOptions`:
```json
    "outDir": "./node_modules/.cache/tsconfig-node",
```

- [ ] **Step 2: Delete artifacts and ignore them**

Run: `rm -f vite.config.js vite.config.d.ts tsconfig.app.tsbuildinfo tsconfig.node.tsbuildinfo`
Append to `.gitignore`:
```
# tsc -b artifacts that would shadow vite.config.ts
vite.config.js
vite.config.d.ts
*.tsbuildinfo
```

- [ ] **Step 3: Verify nothing re-emits at root**

Run: `npm run typecheck && npm run build && ls vite.config.js 2>&1`
Expected: typecheck+build PASS; `ls` reports "No such file or directory".

- [ ] **Step 4: Commit**
```bash
git add tsconfig.node.json .gitignore
git commit -m "fix: tsc artifacts can no longer shadow vite.config.ts"
```

### Task 3.6: Drop the dead members composite index

**Files:**
- Modify: `firestore.indexes.json:28-35`

- [ ] **Step 1: Implement** — remove the `members` index on `role ASC, createdAt DESC` (no query uses it: app orders members by `createdAt` only; functions use a single-equality `role` filter, auto-indexed).
- [ ] **Step 2: Verify and commit**

Run: `npm run test:rules && npm run test:smoke`
```bash
git add firestore.indexes.json
git commit -m "chore: drop unused members composite index"
```
Note in PR description: index file changes only take effect after `firebase deploy --only firestore:indexes` (manual, user-approved).

### Task 3.7: Delete the committed prototype

**Files:**
- Delete: `stow-v3.jsx`

- [ ] **Step 1: Confirm nothing imports it**

Run: `grep -rn "stow-v3" src/ functions/ scripts/ tests/ index.html package.json vite.config.ts`
Expected: no matches.

- [ ] **Step 2: Remove and commit**
```bash
git rm stow-v3.jsx
npm run typecheck && npm test
git commit -m "chore: remove stow-v3 prototype from the shippable tree"
```

### Task 3.8: Backend deploy script + runbook

**Files:**
- Modify: `package.json` (scripts)
- Modify: `README.md` (deploy section)

CI deploys hosting only; functions/rules/indexes drift silently. Full CI automation needs deploy-capable service-account secrets — out of scope here; make the manual path explicit and one command.

- [ ] **Step 1: Add the script** — in `package.json` scripts:
```json
    "deploy:backend": "firebase deploy --only functions,firestore,storage",
```

- [ ] **Step 2: Document** — add to `README.md` under the deploy/quick-start area:
```markdown
## Deploying backend changes

CI deploys **hosting only** (on merge to main). Any change under `functions/`,
`firestore.rules`, `firestore.indexes.json`, or `storage.rules` must be deployed
manually after merge:

```bash
npm run deploy:backend
```

Required prod env (functions): `APP_BASE_URL` (invite links), `KMS_KEY_NAME`
(secret encryption — deploys without it fail closed), optional `VISION_DAILY_LIMIT`
(default 200/household/day), optional `FUNCTIONS_REGION` (default us-central1 —
must match the client's `VITE_FUNCTIONS_REGION`).
```

- [ ] **Step 3: Commit**
```bash
git add package.json README.md
git commit -m "docs: one-command backend deploy + required prod env"
```

### Task 3.9: Open PR 3

- [ ] Run the full gate block. Expected: all PASS.
- [ ] ```bash
git push -u origin fix/rules-pwa-config
gh pr create --draft --base fix/functions-hardening --title "Rules/PWA/config: storage limits, iOS icons, SW updates, config hygiene" --body "Fixes findings 7, 20, 21, 22, 24, 25, 35, 36 from docs/reviews/2026-06-09-pre-launch-review.md"
```

---

# PR 4 — `fix/ux-flows` (findings 11, 12, 13, 14, rest of 15, 16, 18, 19, 23, 26, 27, 28, 32, 33, 34, 37)

```bash
git checkout fix/rules-pwa-config && git checkout -b fix/ux-flows
```

### Task 4.1: Not-found handling for deleted spaces and items

**Files:**
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx`

- [ ] **Step 1: Space not-found state** — in the `nav.tab === "spaces"` branch (~line 214), before the `selectedSpace ?` ternary add:
```tsx
  const spaceMissing = Boolean(nav.selectedSpaceId && data.spaces.length > 0 && !selectedSpace);
```
and render a dead-end card instead of silently falling through to Home:
```tsx
    screen = spaceMissing ? (
      <div style={{ padding: "48px 24px", textAlign: "center", display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: "var(--stow-ink)" }}>Space not found</div>
        <div style={{ fontSize: 14, color: "var(--stow-ink-muted)" }}>
          It may have been deleted. QR labels for deleted spaces stop working.
        </div>
        <Button variant="primary" onClick={() => nav.navigateToTab("spaces")}>All Spaces</Button>
      </div>
    ) : selectedSpace ? (
      <RoomScreen ... /* unchanged */
```
(Import `Button` from the mobile components if not already imported in this file.)

- [ ] **Step 2: Item removed while viewing** — add an effect near the other effects in `StowMobileApp`:
```tsx
  useEffect(() => {
    if (nav.selectedItemId && data.items.length > 0 && !selectedItem) {
      flash("That item was removed");
      nav.navigateToTab("spaces");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav.selectedItemId, selectedItem, data.items.length]);
```

- [ ] **Step 3: Run gates and commit**

Run: `npm run typecheck && npm test && npm run test:smoke`
```bash
git add src/features/stow/ui/mobile/StowMobileApp.tsx
git commit -m "fix: dead QR links and deleted items get explicit not-found handling"
```

### Task 4.2: Back button falls back when there's no in-app history

**Files:**
- Modify: `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts:132-134`
- Test: `src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`

React Router maintains `window.history.state.idx` (0 for the first entry in the session). Deep-link/PWA entries have `idx === 0`, where `navigate(-1)` is a no-op.

- [ ] **Step 1: Write the failing test** — in the existing test file (reuse its established mock harness for `useNavigate`/route state; follow how current `back()`/navigation assertions are built there):
```ts
it("back() falls back to the spaces root when there is no in-app history", () => {
  window.history.replaceState({ idx: 0 }, "");
  // render the hook via the file's existing harness, then:
  result.back();
  expect(navigateMock).toHaveBeenCalledWith("/spaces"); // not -1
});

it("back() uses history when in-app history exists", () => {
  window.history.replaceState({ idx: 2 }, "");
  result.back();
  expect(navigateMock).toHaveBeenCalledWith(-1);
});
```

- [ ] **Step 2: Run to verify failure:** `npx vitest run src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts` → FAIL
- [ ] **Step 3: Implement**
```ts
  function back() {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) {
      navigate(-1);
      return;
    }
    navigate(buildMobilePath(basePath, {}));
  }
```

- [ ] **Step 4: Run to verify pass**, commit:
```bash
git add src/features/stow/ui/mobile/hooks/useMobileNavigation.ts src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts
git commit -m "fix: in-app back falls back to spaces root on deep-link entry"
```

### Task 4.3: Wire the Room header camera button to capture

**Files:**
- Modify: `src/features/stow/ui/mobile/screens/RoomScreen.tsx:142`

- [ ] **Step 1: Implement** — replace the coming-soon stub:
```tsx
          <IconButton label="Camera" onClick={() => onAddItem(isInArea ? selectedArea.id : null)}>
            <Camera size={18} color="var(--stow-ink-muted)" />
          </IconButton>
```
(`onAddItem(areaId)` already opens the `captureFirst` overlay scoped to this space — same flow as the Add Item tile.) If `onComingSoon` is now unused in this file (`grep -n onComingSoon src/features/stow/ui/mobile/screens/RoomScreen.tsx`), remove the prop here and at the `StowMobileApp` call site; check the prop type allows `null` areaId (widen to `(areaId?: string | null) => void` if needed).

- [ ] **Step 2: Run gates and commit**

Run: `npm run typecheck && npm test`
```bash
git add src/features/stow/ui/mobile/screens/RoomScreen.tsx src/features/stow/ui/mobile/StowMobileApp.tsx
git commit -m "fix: room camera button opens capture instead of a coming-soon toast"
```

### Task 4.4: Packing progress counts only items that still exist

**Files:**
- Modify: `src/features/stow/ui/mobile/screens/PackingScreen.tsx` (`packingProgress` + call sites)
- Test: `src/features/stow/ui/mobile/screens/packingProgress.test.ts` (new)

- [ ] **Step 1: Write the failing test**
```ts
import { describe, expect, it } from "vitest";
import { packingProgress } from "./PackingScreen";
import type { PackingList } from "@/types/domain";

const list = {
  itemIds: ["a", "b", "ghost"],
  packedItemIds: ["a", "ghost"]
} as unknown as PackingList;

describe("packingProgress", () => {
  it("ignores ids that no longer resolve to items", () => {
    const result = packingProgress(list, new Set(["a", "b"]));
    expect(result).toEqual({ done: 1, total: 2, pct: 50 });
  });

  it("returns zeros for an empty effective list", () => {
    expect(packingProgress(list, new Set())).toEqual({ done: 0, total: 0, pct: 0 });
  });
});
```

- [ ] **Step 2: Run to verify failure** (not exported / wrong signature): `npx vitest run src/features/stow/ui/mobile/screens/packingProgress.test.ts` → FAIL
- [ ] **Step 3: Implement**
```ts
export function packingProgress(list: PackingList, existingItemIds: Set<string>) {
  const ids = list.itemIds.filter((id) => existingItemIds.has(id));
  const packed = new Set(list.packedItemIds);
  const done = ids.filter((id) => packed.has(id)).length;
  const total = ids.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}
```
In the component, build once: `const existingItemIds = useMemo(() => new Set(items.map((item) => item.id)), [items]);` and pass it at every `packingProgress(list)` call site (`grep -n "packingProgress(" src/features/stow/ui/mobile/screens/PackingScreen.tsx`).

- [ ] **Step 4: Run to verify pass**, commit:
```bash
git add src/features/stow/ui/mobile/screens/PackingScreen.tsx src/features/stow/ui/mobile/screens/packingProgress.test.ts
git commit -m "fix: packing progress ignores deleted items"
```

### Task 4.5: Best-effort activity logging everywhere + mapped callable errors

**Files:**
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx` (remaining `await data.actions.logActivity` sites)
- Modify: `src/lib/firebase/functions.ts` (`callFunction`)

- [ ] **Step 1: Sweep the remaining awaited activity logs** (PR 1 fixed the item-create path)

Run: `grep -n "await data.actions.logActivity\|data.actions.logActivity" src/features/stow/ui/mobile/StowMobileApp.tsx`
Add one helper near the top of the component:
```tsx
  function logActivitySafe(entry: Parameters<typeof buildActivityEntry>[0]) {
    data.actions
      .logActivity({ householdId, entry: buildActivityEntry(entry) })
      .catch((error) => console.error("Activity log failed", error));
  }
```
Convert every remaining `await data.actions.logActivity({ householdId, entry: buildActivityEntry({...}) })` call (move, status-change, delete, batch-capture, lend/return, space/area CRUD — whatever the grep shows) to `logActivitySafe({...})` with the same entry args. The primary write's success/failure handling is unchanged.

- [ ] **Step 2: Map callable errors centrally** — in `src/lib/firebase/functions.ts`:
```ts
import { toLoggedUserErrorMessage } from "@/lib/firebase/errors";

async function callFunction<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
  const [{ httpsCallable }, functions] = await Promise.all([
    import("firebase/functions"),
    requireFunctions()
  ]);
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  try {
    const result = await callable(input);
    return result.data;
  } catch (error) {
    throw new Error(toLoggedUserErrorMessage(error, "That didn’t go through. Please try again."));
  }
}
```
SettingsScreen's `error.message` flashes now surface mapped copy automatically. Note: server `HttpsError` messages for expected cases ("Invite has expired", "This household must keep at least one owner") pass through `toUserErrorMessage` unchanged — that's intended; they're written for users.

- [ ] **Step 3: Run gates and commit**

Run: `npm run typecheck && npm test && npm run test:smoke`
```bash
git add src/features/stow/ui/mobile/StowMobileApp.tsx src/lib/firebase/functions.ts
git commit -m "fix: activity logs are best-effort; callable errors mapped to user copy"
```

### Task 4.6: Atomic lent-status transitions

**Files:**
- Modify: `src/features/stow/services/repository.ts` (`clearItemLoan`)
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx` (`onChangeStatus`, ~line 361)

- [ ] **Step 1: Extend `clearItemLoan`** — locate it (`grep -n "clearItemLoan" src/features/stow/services/repository.ts`). It currently writes `status: "home"` and deletes the loan. Add an optional target status so lent→repair etc. is ONE write:
```ts
  async clearItemLoan(input: { householdId: string; itemId: string; userId: string; nextStatus?: ItemStatus }) {
    // ...existing ref setup unchanged...
    // in the update payload, replace status: "home" with:
    status: input.nextStatus ?? "home",
```
Keep everything else in the function identical (loan `deleteField()`, timestamps, updatedBy).

- [ ] **Step 2: Fix the handler** — replace the `onChangeStatus` body in `StowMobileApp.tsx`:
```tsx
            onChangeStatus={async (next: ItemStatus) => {
              if (next === selectedItem.status) return; // re-tapping "lent" must not wipe the loan
              if (selectedItem.status === "lent") {
                await data.actions.clearItemLoan({ householdId, itemId: selectedItem.id, userId, nextStatus: next });
              } else {
                await data.actions.setItemStatus({ householdId, itemId: selectedItem.id, userId, status: next });
              }
              logActivitySafe({
                type: "item_status_changed",
                actorUid: userId,
                actorName,
                itemName: selectedItem.name,
                status: next,
                itemId: selectedItem.id
              });
            }}
```
(If `data.actions.clearItemLoan` is typed in `useWorkspaceData`, thread `nextStatus` through that wrapper too.)

- [ ] **Step 3: Run gates and commit**

Run: `npm run typecheck && npm test && npm run test:smoke` (the lending smoke spec covers this surface)
```bash
git add src/features/stow/services/repository.ts src/features/stow/ui/mobile/StowMobileApp.tsx
git commit -m "fix: lent-status transitions are a single write; same-status taps are no-ops"
```

### Task 4.7: Clean up orphaned shelf-capture frames

**Files:**
- Modify: `src/features/stow/ui/mobile/capture/QuickCapture.tsx`

- [ ] **Step 1: Implement** — `defaultUploadFrame` (line ~111) uploads each analyzed frame to `_shelf/` storage, but committed items never reference it. Track and delete it:
1. Add a ref: `const uploadedFrameRef = useRef<ImageRef | null>(null);`
2. Where the upload result lands (the call site of `uploadFrame`/`defaultUploadFrame` — `grep -n "uploadFrame" src/features/stow/ui/mobile/capture/QuickCapture.tsx`), store it: `uploadedFrameRef.current = imageRef;` (each new scan attempt overwrites — delete the previous one first if set: `if (uploadedFrameRef.current) void bestEffortDeleteImage(uploadedFrameRef.current);`).
3. After a successful commit and in the close/cancel path, release it:
```tsx
  if (uploadedFrameRef.current) {
    void bestEffortDeleteImage(uploadedFrameRef.current);
    uploadedFrameRef.current = null;
  }
```
(import `bestEffortDeleteImage` from the same module the other capture components use — `grep -rn "bestEffortDeleteImage" src/features/stow/ui/mobile/capture/` shows the import path.)

- [ ] **Step 2: Run gates and commit**

Run: `npm run typecheck && npm test && npm run test:smoke` (shelf-capture spec exercises this flow)
```bash
git add src/features/stow/ui/mobile/capture/QuickCapture.tsx
git commit -m "fix: delete orphaned shelf-scan frames from storage"
```

### Task 4.8: Reset Add Space / Add Area drafts when reopening

**Files:**
- Modify: `src/features/stow/ui/mobile/add/AddSpaceSheet.tsx`, `src/features/stow/ui/mobile/add/AddAreaSheet.tsx`

- [ ] **Step 1: Implement** — in `AddSpaceSheet`, add (and the single-field equivalent in `AddAreaSheet`):
```tsx
import { useEffect, useRef, useState } from "react";
// ...
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setName("");
      setAreas(""); // AddAreaSheet: only setName("")
    }
    wasOpen.current = open;
  }, [open]);
```

- [ ] **Step 2: Run gates and commit**

Run: `npm run typecheck && npm test`
```bash
git add src/features/stow/ui/mobile/add/AddSpaceSheet.tsx src/features/stow/ui/mobile/add/AddAreaSheet.tsx
git commit -m "fix: add-space/add-area sheets reset stale drafts on reopen"
```

### Task 4.9: Library fallback must not force the camera on iOS

**Files:**
- Modify: `src/features/stow/ui/mobile/capture/ScanOverlay.tsx:80`, `src/features/stow/ui/mobile/capture/CaptureFirst.tsx:205`

- [ ] **Step 1: Implement** — delete the `capture="environment"` line from both hidden file inputs. These inputs back the "Choose from library" fallback users reach **because** the camera was denied/unavailable; `capture` forces iOS back into the camera. (The iOS picker still offers "Take Photo" if wanted. `PhotoField.tsx:113` keeps its conditional — correct as is.)

- [ ] **Step 2: Run gates and commit**

Run: `npm run typecheck && npm test`
```bash
git add src/features/stow/ui/mobile/capture/ScanOverlay.tsx src/features/stow/ui/mobile/capture/CaptureFirst.tsx
git commit -m "fix: library fallback opens the photo library, not the denied camera"
```

### Task 4.10: Pending writes sort to the top of "Recently added"

**Files:**
- Modify: `src/features/stow/ui/mobile/screens/HomeScreen.tsx:20-22`

- [ ] **Step 1: Implement** — a just-added item has `createdAt: null` until the server timestamp resolves; treat it as newest, not oldest:
```ts
function timestampMillis(createdAt: Item["createdAt"] | null | undefined) {
  return createdAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
}
```

- [ ] **Step 2: Run gates and commit**

Run: `npm run typecheck && npm test`
```bash
git add src/features/stow/ui/mobile/screens/HomeScreen.tsx
git commit -m "fix: just-added items appear first in Recently added"
```

### Task 4.11: Chunked batches + tolerant reorders in the repository

**Files:**
- Modify: `src/features/stow/services/repository.ts` (`reorderSpaces`, `reorderAreas`, `deleteSpace`)
- Test: `src/features/stow/services/commitOps.test.ts` (new)

- [ ] **Step 1: Tolerant reorders** — in `reorderSpaces` (line ~411) and `reorderAreas` (line ~423), change `batch.update(ref, {...})` to `batch.set(ref, {...}, { merge: true })`. `update` rejects the whole batch when any id was deleted on another device mid-drag; `set+merge` writes positions for survivors. (Recreating a just-deleted doc as a position-only stub is acceptable: the snapshot listener already dropped it client-side and a position-only doc is filtered by the mapper from Task 4.12.)

- [ ] **Step 2: Write the failing chunking test**

Create `src/features/stow/services/commitOps.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { chunkOps } from "./repository";

describe("chunkOps", () => {
  it("splits operations into <=450-op chunks preserving order", () => {
    const ops = Array.from({ length: 1000 }, (_, i) => i);
    const chunks = chunkOps(ops, 450);
    expect(chunks.map((c) => c.length)).toEqual([450, 450, 100]);
    expect(chunks.flat()).toEqual(ops);
  });
});
```

- [ ] **Step 3: Run to verify failure**, then implement in `repository.ts`:
```ts
/** Firestore batches cap at 500 ops; stay under it with headroom. */
export function chunkOps<T>(ops: T[], size = 450): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ops.length; i += size) chunks.push(ops.slice(i, i + size));
  return chunks;
}
```
In `deleteSpace` (line ~472), build the work as an array of `(batch: WriteBatch) => void` closures instead of applying them to one batch, then:
```ts
    for (const chunk of chunkOps(ops)) {
      const batch = writeBatch(database);
      chunk.forEach((apply) => apply(batch));
      await batch.commit();
    }
```
Keep the operation order (item reassign/delete → area deletes → space delete last) so a mid-way failure never leaves a deleted space with orphaned children.

- [ ] **Step 4: Run to verify pass** (`npx vitest run src/features/stow/services/commitOps.test.ts` and the full `npm test`), commit:
```bash
git add src/features/stow/services/repository.ts src/features/stow/services/commitOps.test.ts
git commit -m "fix: reorders tolerate concurrent deletes; deleteSpace survives 500-op limit"
```

### Task 4.12: Defensive normalization at the Firestore read boundary

**Files:**
- Modify: `src/features/stow/services/repository.ts` (item/space/area mappers, ~lines 66-107)
- Test: extend `src/features/stow/services/repository.test.ts`

- [ ] **Step 1: Write the failing test** — follow the existing normalization tests in `repository.test.ts` (they already cover `status`/`tags` defaulting); add:
```ts
it("defaults malformed name/notes/value instead of crashing the UI", () => {
  const normalized = normalizeItemDoc({ ...validItemDoc, name: 42, notes: null, value: "abc" });
  expect(normalized.name).toBe("Untitled item");
  expect(normalized.notes).toBe("");
  expect(normalized.value).toBeNull();
});
```
(Reuse however the existing tests construct `validItemDoc` / invoke the normalizer — match their import and fixture names.)

- [ ] **Step 2: Run to verify failure**, then implement in the item normalizer:
```ts
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Untitled item",
    notes: typeof raw.notes === "string" ? raw.notes : "",
    value: typeof raw.value === "number" && Number.isFinite(raw.value) ? raw.value : null,
```
For spaces/areas, drop docs with a non-string `name` **or missing `createdAt`-era required fields produced by Task 4.11's position-only stubs**: in the snapshot mapper, filter `docs` where `typeof data.name !== "string"`.

- [ ] **Step 3: Run to verify pass**, commit:
```bash
git add src/features/stow/services/repository.ts src/features/stow/services/repository.test.ts
git commit -m "fix: tolerate malformed docs at the Firestore read boundary"
```

### Task 4.13: Clear stored email on terminal email-link failures

**Files:**
- Modify: `src/lib/firebase/auth.ts` (`completeEmailLinkSignIn`)

- [ ] **Step 1: Implement** — wrap the sign-in call:
```ts
export async function completeEmailLinkSignIn(currentUrl: string, email: string): Promise<User> {
  if (!auth || !isSignInWithEmailLink(auth, currentUrl)) {
    throw new Error("This sign-in link is invalid or has already been used");
  }
  if (!email.trim()) throw new Error("Email is required to complete sign-in");
  try {
    const result = await signInWithEmailLink(auth, email, currentUrl);
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
    window.localStorage.removeItem(EMAIL_LINK_RETURN_TO_STORAGE_KEY);
    return result.user;
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "";
    if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") {
      // Terminal for this link: a stale stored email would mislead the next attempt.
      window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      window.localStorage.removeItem(EMAIL_LINK_RETURN_TO_STORAGE_KEY);
    }
    throw error;
  }
}
```

- [ ] **Step 2: Run gates and commit**

Run: `npm run typecheck && npm test && npm run test:smoke`
```bash
git add src/lib/firebase/auth.ts
git commit -m "fix: clear stored email when an email link is terminally dead"
```

### Task 4.14: Open PR 4

- [ ] Run the full gate block. Expected: all PASS.
- [ ] ```bash
git push -u origin fix/ux-flows
gh pr create --draft --base fix/rules-pwa-config --title "UX flows: dead ends, packing counts, atomic status, capture cleanup" --body "Fixes findings 11-16, 18, 19, 23, 26-28, 32-34, 37 from docs/reviews/2026-06-09-pre-launch-review.md"
```

---

## Execution notes

- **One implementer at a time** per Ellis's process: spec-review then code-quality review per task before moving on (subagent-driven development).
- **Six "anchor + adapt" steps** (2.2 Step 4 Settings UI, 4.5 Step 1 sweep, 4.6 Step 1 `clearItemLoan`, 4.7 QuickCapture refs, 4.11 `deleteSpace` ops, 4.12 mapper names) give exact code but anchor it with grep because the surrounding file regions weren't read during planning — verify the anchor before editing.
- **Deploys are user-approved, manual, and ordered:** PR 2 needs `APP_BASE_URL` + `KMS_KEY_NAME` env set before `firebase deploy --only functions`; PR 3 needs `firebase deploy --only storage,firestore` for rules/indexes. Hosting deploys automatically on merge to main.
- **Stacked PRs:** do not delete `fix/p0-launch-blockers` / `fix/functions-hardening` / `fix/rules-pwa-config` until everything has merged.

## Self-review (done at plan time)

- All 37 findings map to a task (see coverage table); finding 15 is split: create path in 1.4, remaining sites in 4.5; finding 17 merged into 1.2 to avoid touching bootstrap twice.
- Storage-rules task explicitly splits `create, update` from `delete` — a naive combined `write` condition would have broken every image deletion (`request.resource` is null on delete).
- `completeWrite` is referenced with the same name/signature in Tasks 1.4 (defined) and used nowhere else; `chunkOps`, `buildStarterSpaces`, `providerFetch`, `consumeVisionQuota`, `logActivitySafe` each defined before first use within their PR.
- `npm test` exclusion change (3.1) is needed because the new `tests/storage.rules.test.ts` must not run without emulators.
