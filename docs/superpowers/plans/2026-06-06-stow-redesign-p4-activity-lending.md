# Stow Mobile Redesign — P4 Retention Bets (Activity Feed + Status/Lending) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the "reason to come back" layer of the new mobile Stow app: a household **activity feed** (bell target), first-class item **lifecycle status** (`home`/`packed`/`lent`/`repair`/`lost`), **lending/loan** tracking, and a home **"Away from home"** strip — all wired into the existing call sites created by P1–P3 so adds/moves/deletes/status-changes/space-adds/space-deletes log activity.

**Architecture:** Extend the shared data layer (`src/types/domain.ts`, `src/lib/firebase/paths.ts`, `src/features/stow/services/repository.ts`, `src/features/stow/hooks/useWorkspaceData.ts`, `firestore.rules`) with the P4 contract additions, then add the P4 mobile UI under `src/features/stow/ui/mobile/`: a routed `ActivityScreen`, an "Away from home" strip in `HomeScreen`, and status + lending controls in `ItemDetail`. Activity writes are **client-side** for v1 (a Functions-trigger upgrade is a later option). The new `activity` collection uses only the automatic single-field `createdAt` index — **no composite index is added**.

**Tech Stack:** React 19 + TypeScript, react-router-dom v7, lucide-react, Firebase (Firestore/Auth), Vite, Vitest (node env, pure-function tests — repo has no jsdom/RTL), `@firebase/rules-unit-testing` for the rules test, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md` (esp. §6.12 Activity, §7.2 status, §7.3 lending, §7.4 activity feed)
**Roadmap:** `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md` ("P4 — Retention bets")
**Contract (LOCKED):** `docs/superpowers/plans/2026-06-06-stow-redesign-shared-contract.md` — obey §3 (activity nav helper), §4 + §4.1 (P4 domain + normalization), §5.3 (repo), §6.3 (hook), §10 (UI + rules).

**Conventions (contract §0):**
- TDD bite-sized steps: write failing test → run (expect FAIL) → minimal/full impl → run (expect PASS) → commit. One action per step (2–5 min).
- Run a single test file with `npx vitest run <path>`; the full unit suite with `npm test` (excludes rules + smoke).
- Rules test: `npm run test:rules` (boots the Firestore emulator via `scripts/with-java.sh` then runs `vitest run tests/firestore.rules.test.ts`).
- There is **no `verify` script**; "verify" = `npm run typecheck && npm test && npm run build`.
- Tests are **pure-function / node-env only** (Vitest). Test domain/entry shaping, repo helpers, selectors, relative-time, status/loan helpers, nav parsing, and the Firestore rules. UI components (`ActivityScreen`, Away strip, lending sheet) are validated by manual dev load + Playwright, not unit DOM tests.
- All new mobile code lives under `src/features/stow/ui/mobile/`; imports use the `@/` alias.
- Token translation (contract §1.3): prototype `P.x` → `var(--stow-x)`; `P.radius+8` → `var(--stow-radius-card)`, `+6` → `var(--stow-radius-button)`, `+2` → `var(--stow-radius-input)`, bare `P.radius` → `var(--stow-radius)`; alpha tints `color + "1A"` → `color-mix(in srgb, <color> 10%, transparent)` (`16`/`22`≈13%, `2E`/`33`≈20%, `55`≈33%); fonts wordmark/headers `fontFamily: "var(--stow-display)"`, body inherits `--stow-body`. Components read CSS vars (no `P` prop).
- **Do not touch** legacy `src/features/stow/ui/StowApp.tsx`, `ui/next/StowNextApp.tsx`, `ui/tabs`, `ui/item`, `ui/shared`, or canonical routes (that is P5).
- Commit trailer on every commit message:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

**Prototype sources (visual source of truth, §11 mapping applies):**
- Lending + status + away strip: `docs/superpowers/design-reference/prototype/enhance/maintain.jsx` (`M1_AwayHome`, `M2_StatusSheet`, `M3_Loans`) and its shared primitives `enhance/parts.jsx` (`STATUS` vocabulary, `Avatar`, `StatusPill`, `Eyebrow`, `Card`).
- Attach points: `screens-core.jsx` `RetrievalHome` (Away strip slots above `SpacesManagedList`), `screens-detail.jsx` `ItemDetail` (status/lending controls slot under the location hero card).
- Activity feed has no dedicated prototype frame; its row shape derives from `M3_Loans` grouped rows + spec §6.12 examples ("Sam added 3 items to Garage", "You moved Drill to Garage › Toolbox", "Jess marked Tent lent to …"). Reuse `Avatar` + relative time.

**Dependency note (cross-phase, no sibling plan reads required):** P1 created `createItem`/`updateItem` call sites for item add and move/delete (within Add sheets, `ItemDetail`, `RoomScreen`, `SpaceActionSheet`/`EditSpaceSheet`), and `createSpace`/`deleteSpace`. P3 created `createItemsBatch` and its single call site in `capture/QuickCapture.tsx` (`onCommitted`). Task 9 wires `actions.logActivity(...)` at each of those existing call sites using the contract-named functions; you locate the call site by the action it already invokes (e.g. the place that calls `actions.createItem(...)`), and add a `logActivity` call immediately after the awaited write resolves.

---

## Task 1: Domain types + activity paths

**Files:**
- Modify: `src/types/domain.ts`
- Modify: `src/lib/firebase/paths.ts`
- Modify: `src/features/stow/seed.ts`

- [x] **Step 1: Add the P4 domain types** (no test — type-only; verified by `npm run typecheck` in later steps and consumed by Task 2 tests)

In `src/types/domain.ts`, **after** the existing `export interface PackingList { … }` block (keep `SpaceIcon` exported untouched), add:

```ts
export type ItemStatus = "home" | "packed" | "lent" | "repair" | "lost";

export interface ItemLoan {
  to: string;
  toUid?: string;
  since: Timestamp;
  due?: Timestamp;
  note?: string;
}

export type ActivityType =
  | "item_added"
  | "items_added_batch"
  | "item_moved"
  | "item_deleted"
  | "item_status_changed"
  | "space_added"
  | "space_deleted";

export interface ActivityEntry {
  id: string;
  householdId: string;
  type: ActivityType;
  actorUid: string;
  actorName: string;
  summary: string;
  spaceId?: string;
  areaId?: string;
  itemId?: string;
  count?: number;
  createdAt: Timestamp;
}
```

- [x] **Step 2: Extend the `Item` interface with `status` + `loan`**

In `src/types/domain.ts`, inside `export interface Item { … }`, the existing `isPacked: boolean;` line becomes annotated as deprecated and two fields are added directly after it:

Find:
```ts
  isPacked: boolean;
  photoStatus: ItemPhotoStatus;
```
Replace with:
```ts
  /** @deprecated kept until P5 cutover; new packing UI does not write this. Use `status`. */
  isPacked: boolean;
  status: ItemStatus;
  loan?: ItemLoan;
  photoStatus: ItemPhotoStatus;
```

- [x] **Step 3: Add the activity paths to `paths.ts`**

In `src/lib/firebase/paths.ts`, inside the `householdPaths` object, add two entries directly after the `packingList` line (before `llmConfig`):

```ts
  activity: (householdId: string) => `households/${householdId}/activity`,
  activityDoc: (householdId: string, activityId: string) =>
    `households/${householdId}/activity/${activityId}`,
```

- [x] **Step 4: Default seeded item status from `isPacked`**

In `src/features/stow/seed.ts`, add `status: item.isPacked ? "packed" : "home"` to the `items` mapper so strongly typed seed data satisfies the required `Item.status` contract before Task 2 introduces normalized read defaults.

- [x] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (The new `Item.status` is not yet defaulted in `normalizeItemDoc`; that is Task 2. TypeScript still compiles because the spread cast in `normalizeItemDoc` is `as Item`. The `setItemStatus`/loan repo methods do not exist yet but nothing references them.)

- [x] **Step 6: Commit**

```bash
git add src/types/domain.ts src/lib/firebase/paths.ts src/features/stow/seed.ts
git commit -m "feat(mobile): add P4 activity/status/loan domain types and activity paths

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `normalizeItemDoc` status default

**Files:**
- Create: `src/features/stow/services/normalizeItemStatus.test.ts`
- Modify: `src/features/stow/services/itemMetadata.ts`
- Modify: `src/features/stow/services/repository.ts`

> A pure helper `defaultItemStatus` is added to `itemMetadata.ts` so the default rule (`isPacked ? "packed" : "home"`) is unit-testable without Firestore, mirroring the existing `defaultPhotoStatus`/`defaultEntryMode` pattern. `normalizeItemDoc` calls it.

- [x] **Step 1: Write the failing test**

```ts
// src/features/stow/services/normalizeItemStatus.test.ts
import { describe, expect, it } from "vitest";
import { defaultItemStatus } from "@/features/stow/services/itemMetadata";

describe("defaultItemStatus", () => {
  it("preserves an explicit valid status", () => {
    expect(defaultItemStatus({ status: "lent" })).toBe("lent");
    expect(defaultItemStatus({ status: "repair", isPacked: false })).toBe("repair");
    expect(defaultItemStatus({ status: "lost" })).toBe("lost");
    expect(defaultItemStatus({ status: "home" })).toBe("home");
    expect(defaultItemStatus({ status: "packed" })).toBe("packed");
  });

  it("derives a missing status from isPacked", () => {
    expect(defaultItemStatus({ isPacked: true })).toBe("packed");
    expect(defaultItemStatus({ isPacked: false })).toBe("home");
    expect(defaultItemStatus({})).toBe("home");
  });

  it("ignores an unrecognized status value and falls back to the isPacked derivation", () => {
    expect(defaultItemStatus({ status: "bogus", isPacked: true })).toBe("packed");
    expect(defaultItemStatus({ status: 7 as unknown, isPacked: false })).toBe("home");
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/services/normalizeItemStatus.test.ts`
Expected: FAIL — `defaultItemStatus` is not exported from `itemMetadata`.

- [x] **Step 3: Add `defaultItemStatus` to `itemMetadata.ts`**

In `src/features/stow/services/itemMetadata.ts`, update the type import line and append the helper:

Find:
```ts
import type { ImageRef, ItemEntryMode, ItemPhotoStatus } from "@/types/domain";
```
Replace with:
```ts
import type { ImageRef, ItemEntryMode, ItemPhotoStatus, ItemStatus } from "@/types/domain";
```

Append at the end of the file:
```ts
const ITEM_STATUSES: readonly ItemStatus[] = ["home", "packed", "lent", "repair", "lost"];

export function defaultItemStatus(input: { status?: unknown; isPacked?: unknown }): ItemStatus {
  if (typeof input.status === "string" && (ITEM_STATUSES as readonly string[]).includes(input.status)) {
    return input.status as ItemStatus;
  }
  return input.isPacked === true ? "packed" : "home";
}
```

- [x] **Step 4: Wire `defaultItemStatus` into `normalizeItemDoc`**

In `src/features/stow/services/repository.ts`, update the import from `itemMetadata` and the `normalizeItemDoc` return.

Find:
```ts
import { defaultEntryMode, defaultPhotoStatus } from "@/features/stow/services/itemMetadata";
```
Replace with:
```ts
import { defaultEntryMode, defaultItemStatus, defaultPhotoStatus } from "@/features/stow/services/itemMetadata";
```

Find:
```ts
function normalizeItemDoc(snap: { id: string; data(): DocumentData }): Item {
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    ...(data as Omit<Item, "id" | "photoStatus" | "entryMode">),
    photoStatus: defaultPhotoStatus({ photoStatus: data.photoStatus, image: data.image }),
    entryMode: defaultEntryMode({ entryMode: data.entryMode, vision: data.vision })
  } as Item;
}
```
Replace with:
```ts
function normalizeItemDoc(snap: { id: string; data(): DocumentData }): Item {
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    ...(data as Omit<Item, "id" | "photoStatus" | "entryMode" | "status">),
    status: defaultItemStatus({ status: data.status, isPacked: data.isPacked }),
    photoStatus: defaultPhotoStatus({ photoStatus: data.photoStatus, image: data.image }),
    entryMode: defaultEntryMode({ entryMode: data.entryMode, vision: data.vision })
  } as Item;
}
```

- [x] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/services/normalizeItemStatus.test.ts`
Expected: PASS (3 tests).

- [x] **Step 6: Commit**

```bash
git add src/features/stow/services/itemMetadata.ts src/features/stow/services/normalizeItemStatus.test.ts src/features/stow/services/repository.ts
git commit -m "feat(mobile): default Item.status from isPacked in normalizeItemDoc

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `createItem` writes `status: "home"`; `updateItem` patch gains `status`/`loan`

**Files:**
- Modify: `src/features/stow/services/repository.ts`

> No new unit test here: `createItem`/`updateItem` write through the Firestore SDK (covered by manual + Playwright + the rules test in Task 5). This step keeps the field defaults consistent with the contract (§4.1 "New `createItem` writes `status: \"home\"`") and extends the `updateItem` patch `Pick` so `setItemStatus`/`setItemLoan`/`clearItemLoan` (Task 4) can pass `status` and `loan`.

- [x] **Step 1: `createItem` sets `status: "home"`**

In `inventoryRepository.createItem`, in the `setDoc(itemRef, { … })` payload, add `status: "home",` directly after the existing `isPacked: false,` line:

Find (inside `createItem`):
```ts
      isPacked: false,
      photoStatus: defaultPhotoStatus({ photoStatus: input.photoStatus, image: input.image }),
```
Replace with:
```ts
      isPacked: false,
      status: "home",
      photoStatus: defaultPhotoStatus({ photoStatus: input.photoStatus, image: input.image }),
```

- [x] **Step 2: `createItemsBatch` sets `status: "home"`** (batch-captured items mirror `createItem` defaults)

In `inventoryRepository.createItemsBatch`, in the `batch.set(itemRef, { … })` payload, add `status: "home",` directly after the `isPacked: false,` line:

Find (inside `createItemsBatch`):
```ts
        isPacked: false,
        photoStatus: defaultPhotoStatus({ image: item.image }),
```
Replace with:
```ts
        isPacked: false,
        status: "home",
        photoStatus: defaultPhotoStatus({ image: item.image }),
```

- [x] **Step 3: `completeItemDraft` sets `status: "home"`** (drafts complete into items; keep them consistent)

In `inventoryRepository.completeItemDraft`, in the `batch.set(itemRef, { … })` payload, add `status: "home",` directly after the `isPacked: false,` line:

Find (inside `completeItemDraft`):
```ts
      isPacked: false,
      photoStatus: "attached",
```
Replace with:
```ts
      isPacked: false,
      status: "home",
      photoStatus: "attached",
```

- [x] **Step 4: Extend the `updateItem` patch type**

In `inventoryRepository.updateItem`, extend the `Pick` to include `status` and add an optional `loan` to the intersection:

Find:
```ts
    patch: Partial<
      Pick<Item, "name" | "notes" | "value" | "tags" | "isPacked" | "spaceId" | "areaId" | "areaNameSnapshot" | "kind" | "isPriceless">
    > & {
      image?: ImageRef | null;
      photoStatus?: Item["photoStatus"];
      entryMode?: Item["entryMode"];
      vision?: Item["vision"] | null;
    };
```
Replace with:
```ts
    patch: Partial<
      Pick<Item, "name" | "notes" | "value" | "tags" | "isPacked" | "status" | "spaceId" | "areaId" | "areaNameSnapshot" | "kind" | "isPriceless">
    > & {
      image?: ImageRef | null;
      loan?: ItemLoan | null;
      photoStatus?: Item["photoStatus"];
      entryMode?: Item["entryMode"];
      vision?: Item["vision"] | null;
    };
```

- [x] **Step 5: Import `ItemLoan` and `ActivityEntry` types in the repository**

Update the domain type import to include the new types used by `updateItem` (now) and Task 4 (`logActivity`/`subscribeActivity`):

Find:
```ts
import type { Area, Household, HouseholdInvite, HouseholdMember, ImageRef, Item, ItemDraft, PackingList, Space } from "@/types/domain";
```
Replace with:
```ts
import type {
  ActivityEntry,
  Area,
  Household,
  HouseholdInvite,
  HouseholdMember,
  ImageRef,
  Item,
  ItemDraft,
  ItemLoan,
  ItemStatus,
  PackingList,
  Space
} from "@/types/domain";
```

- [x] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`ItemStatus`/`ActivityEntry` are imported but not yet used until Task 4 — TypeScript does not error on unused *type* imports under the repo's config, but if `noUnusedLocals` flags them, that resolves in Task 4 when they are consumed. If a transient error appears here, proceed to Task 4 in the same working session before committing — or temporarily commit Tasks 3+4 together.)

- [x] **Step 7: Commit**

```bash
git add src/features/stow/services/repository.ts
git commit -m "feat(mobile): write status=home on item create; extend updateItem patch with status/loan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Repository — `logActivity`, `subscribeActivity`, `setItemStatus`, `setItemLoan`, `clearItemLoan`

**Files:**
- Create: `src/features/stow/services/activity.test.ts`
- Modify: `src/features/stow/services/repository.ts`

> The Firestore-touching methods (`logActivity`, `subscribeActivity`) are validated by the rules test (Task 5) + manual/Playwright. The unit test here covers a **pure entry-shaping helper** `buildActivityEntry` that constructs the `Omit<ActivityEntry,"id"|"householdId"|"createdAt">` payload deterministically from inputs — this is the load-bearing logic (summary + type + ids) that the call-site wiring (Task 9) depends on. `setItemStatus`/`setItemLoan`/`clearItemLoan` are thin wrappers over `updateItem` and are checked by typecheck + the loan-helper unit test in Task 8.

- [x] **Step 1: Write the failing test for `buildActivityEntry`**

```ts
// src/features/stow/services/activity.test.ts
import { describe, expect, it } from "vitest";
import { buildActivityEntry } from "@/features/stow/services/repository";

const actor = { actorUid: "u1", actorName: "Sam Rivera" };

describe("buildActivityEntry", () => {
  it("shapes an item_added entry", () => {
    const e = buildActivityEntry({
      type: "item_added",
      ...actor,
      itemName: "Drill",
      spaceName: "Garage",
      areaName: "Toolbox",
      spaceId: "s1",
      areaId: "a1",
      itemId: "i1"
    });
    expect(e).toEqual({
      type: "item_added",
      actorUid: "u1",
      actorName: "Sam Rivera",
      summary: "Sam added Drill to Garage › Toolbox",
      spaceId: "s1",
      areaId: "a1",
      itemId: "i1"
    });
  });

  it("shapes an items_added_batch entry with a count", () => {
    const e = buildActivityEntry({
      type: "items_added_batch",
      ...actor,
      count: 3,
      spaceName: "Garage",
      areaName: "Toolbox",
      spaceId: "s1",
      areaId: "a1"
    });
    expect(e.summary).toBe("Sam added 3 items to Garage › Toolbox");
    expect(e.count).toBe(3);
    expect(e.itemId).toBeUndefined();
  });

  it("singularizes a batch of one", () => {
    const e = buildActivityEntry({
      type: "items_added_batch",
      ...actor,
      count: 1,
      spaceName: "Garage",
      areaName: "Toolbox"
    });
    expect(e.summary).toBe("Sam added 1 item to Garage › Toolbox");
  });

  it("shapes an item_moved entry", () => {
    const e = buildActivityEntry({
      type: "item_moved",
      ...actor,
      itemName: "Drill",
      spaceName: "Garage",
      areaName: "Toolbox",
      spaceId: "s1",
      areaId: "a1",
      itemId: "i1"
    });
    expect(e.summary).toBe("Sam moved Drill to Garage › Toolbox");
  });

  it("shapes an item_deleted entry (no location)", () => {
    const e = buildActivityEntry({ type: "item_deleted", ...actor, itemName: "Drill" });
    expect(e.summary).toBe("Sam deleted Drill");
    expect(e.spaceId).toBeUndefined();
  });

  it("shapes an item_status_changed entry using the status label", () => {
    const lent = buildActivityEntry({
      type: "item_status_changed",
      ...actor,
      itemName: "Tent",
      status: "lent",
      loanTo: "Marcus",
      itemId: "i9"
    });
    expect(lent.summary).toBe("Sam marked Tent lent to Marcus");

    const repair = buildActivityEntry({
      type: "item_status_changed",
      ...actor,
      itemName: "Mic",
      status: "repair",
      itemId: "i8"
    });
    expect(repair.summary).toBe("Sam marked Mic in repair");

    const home = buildActivityEntry({
      type: "item_status_changed",
      ...actor,
      itemName: "Mic",
      status: "home",
      itemId: "i8"
    });
    expect(home.summary).toBe("Sam marked Mic back home");
  });

  it("shapes space_added / space_deleted entries", () => {
    expect(
      buildActivityEntry({ type: "space_added", ...actor, spaceName: "Garage", spaceId: "s1" }).summary
    ).toBe("Sam added the Garage space");
    expect(
      buildActivityEntry({ type: "space_deleted", ...actor, spaceName: "Garage" }).summary
    ).toBe("Sam deleted the Garage space");
  });

  it("uses the actor's first name only", () => {
    expect(
      buildActivityEntry({ type: "item_deleted", actorUid: "u2", actorName: "Jess Park", itemName: "X" }).summary
    ).toBe("Jess deleted X");
  });

  it("omits undefined optional id/count keys (so Firestore never sees undefined)", () => {
    const e = buildActivityEntry({ type: "item_deleted", ...actor, itemName: "Drill" });
    expect(Object.prototype.hasOwnProperty.call(e, "spaceId")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, "areaId")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, "itemId")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(e, "count")).toBe(false);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/services/activity.test.ts`
Expected: FAIL — `buildActivityEntry` is not exported.

- [x] **Step 3: Add `buildActivityEntry` + the activity/status/loan repo methods**

In `src/features/stow/services/repository.ts`:

**(a)** Add `limit` and `deleteField` to the `firebase/firestore` import. Find the import block opener:
```ts
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot
} from "firebase/firestore";
```
Replace with:
```ts
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot
} from "firebase/firestore";
```

**(b)** Add the pure helper above `export const inventoryRepository = {` (after `requireDb()`):

```ts
const STATUS_LABELS: Record<ItemStatus, string> = {
  home: "back home",
  packed: "packed",
  lent: "lent",
  repair: "in repair",
  lost: "missing"
};

function firstName(actorName: string): string {
  const trimmed = actorName.trim();
  if (!trimmed) return "Someone";
  return trimmed.split(/\s+/)[0];
}

function locationSuffix(spaceName?: string, areaName?: string): string {
  if (spaceName && areaName) return `${spaceName} › ${areaName}`;
  return spaceName ?? "";
}

export interface BuildActivityEntryInput {
  type: ActivityType;
  actorUid: string;
  actorName: string;
  itemName?: string;
  spaceName?: string;
  areaName?: string;
  status?: ItemStatus;
  loanTo?: string;
  count?: number;
  spaceId?: string;
  areaId?: string;
  itemId?: string;
}

/**
 * Pure: builds the activity entry payload (everything except id/householdId/createdAt).
 * Summary copy mirrors spec §6.12. Optional id/count keys are only included when defined
 * so the Firestore write never carries an `undefined` (which Firestore rejects).
 */
export function buildActivityEntry(
  input: BuildActivityEntryInput
): Omit<ActivityEntry, "id" | "householdId" | "createdAt"> {
  const who = firstName(input.actorName);
  const loc = locationSuffix(input.spaceName, input.areaName);
  let summary = "";
  switch (input.type) {
    case "item_added":
      summary = `${who} added ${input.itemName ?? "an item"}${loc ? ` to ${loc}` : ""}`;
      break;
    case "items_added_batch": {
      const n = input.count ?? 0;
      summary = `${who} added ${n} item${n === 1 ? "" : "s"}${loc ? ` to ${loc}` : ""}`;
      break;
    }
    case "item_moved":
      summary = `${who} moved ${input.itemName ?? "an item"}${loc ? ` to ${loc}` : ""}`;
      break;
    case "item_deleted":
      summary = `${who} deleted ${input.itemName ?? "an item"}`;
      break;
    case "item_status_changed": {
      const label = input.status ? STATUS_LABELS[input.status] : "updated";
      const to = input.status === "lent" && input.loanTo ? ` to ${input.loanTo}` : "";
      summary = `${who} marked ${input.itemName ?? "an item"} ${label}${to}`;
      break;
    }
    case "space_added":
      summary = `${who} added the ${input.spaceName ?? "new"} space`;
      break;
    case "space_deleted":
      summary = `${who} deleted the ${input.spaceName ?? ""} space`.replace("  ", " ");
      break;
  }

  const entry: Omit<ActivityEntry, "id" | "householdId" | "createdAt"> = {
    type: input.type,
    actorUid: input.actorUid,
    actorName: input.actorName,
    summary
  };
  if (input.spaceId !== undefined) entry.spaceId = input.spaceId;
  if (input.areaId !== undefined) entry.areaId = input.areaId;
  if (input.itemId !== undefined) entry.itemId = input.itemId;
  if (input.count !== undefined) entry.count = input.count;
  return entry;
}
```

**(c)** Add the methods to the `inventoryRepository` object. Insert directly after the `clearPackingListPacked` method (the last method, before the closing `};`). Add a leading comma after the previous method's closing brace as needed:

```ts
  // ── Activity feed ──────────────────────────────────────────────

  async logActivity(input: {
    householdId: string;
    entry: Omit<ActivityEntry, "id" | "householdId" | "createdAt">;
  }) {
    await addDoc(collection(requireDb(), householdPaths.activity(input.householdId)), {
      ...input.entry,
      householdId: input.householdId,
      createdAt: serverTimestamp()
    });
  },

  subscribeActivity(
    householdId: string,
    max: number,
    onData: (state: SnapshotState<ActivityEntry>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(requireDb(), householdPaths.activity(householdId)),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    return onSnapshot(q, (snap) => onData(mapSnapshot<ActivityEntry>(snap)), onError);
  },

  // ── Item status & lending ──────────────────────────────────────

  async setItemStatus(input: { householdId: string; itemId: string; userId: string; status: ItemStatus }) {
    await inventoryRepository.updateItem({
      householdId: input.householdId,
      itemId: input.itemId,
      userId: input.userId,
      patch: { status: input.status }
    });
  },

  async setItemLoan(input: { householdId: string; itemId: string; userId: string; loan: ItemLoan }) {
    await inventoryRepository.updateItem({
      householdId: input.householdId,
      itemId: input.itemId,
      userId: input.userId,
      patch: { status: "lent", loan: input.loan }
    });
  },

  async clearItemLoan(input: { householdId: string; itemId: string; userId: string }) {
    await updateDoc(doc(requireDb(), householdPaths.item(input.householdId, input.itemId)), {
      status: "home",
      loan: deleteField(),
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  }
```

> **Why `clearItemLoan` uses `deleteField()` directly instead of `updateItem`:** the contract (§5.3) says "use `loan: null` (normalizeItemDoc treats null/absent as undefined)". Writing `deleteField()` is the cleaner Firestore equivalent and avoids storing an explicit `null`. `normalizeItemDoc` already treats an absent `loan` as `undefined` because it spreads `data` and `loan` simply isn't present. `updateItem`'s patch also accepts `loan?: ItemLoan | null` (Task 3) so a `loan: null` form is type-valid if a future caller prefers it. Both render identically.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/services/activity.test.ts`
Expected: PASS (10 tests).

- [x] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS (`ItemStatus`, `ItemLoan`, `ActivityEntry` are now all consumed).

- [x] **Step 6: Commit**

```bash
git add src/features/stow/services/activity.test.ts src/features/stow/services/repository.ts
git commit -m "feat(mobile): add logActivity/subscribeActivity/setItemStatus/setItemLoan/clearItemLoan repo methods

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Firestore rules — `activity` block + rules test

**Files:**
- Modify: `firestore.rules`
- Modify: `tests/firestore.rules.test.ts`

> No new composite index is required: `subscribeActivity` queries the `activity` collection with `orderBy("createdAt","desc")` only, which Firestore serves from the **automatic single-field index**. Do **not** edit `firestore.indexes.json`.

- [x] **Step 1: Write the failing rules test**

In `tests/firestore.rules.test.ts`:

**(a)** seed one activity doc in `seedHousehold()` — add directly after the `invites/invite-1` `setDoc(...)` (still inside `withSecurityRulesDisabled`):
```ts
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "activity", "activity-1"), {
      householdId: HOUSEHOLD_ID,
      type: "item_added",
      actorUid: "owner-1",
      actorName: "Owner One",
      summary: "Owner added Camera to Closet › Shelf",
      itemId: "item-1",
      createdAt: new Date()
    });
```

**(b)** add a new `it(...)` block inside `describe("firestore rules", () => { … })`, after the existing `"keeps normal member reads and writes limited to allowed inventory paths"` test:
```ts
  it("lets members read and create activity but never update or delete it", async () => {
    await seedHousehold();
    const memberDb = testEnv.authenticatedContext("member-1").firestore();

    // read existing
    await assertSucceeds(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "activity", "activity-1")));

    // create new
    await assertSucceeds(
      setDoc(doc(memberDb, "households", HOUSEHOLD_ID, "activity", "activity-2"), {
        householdId: HOUSEHOLD_ID,
        type: "item_moved",
        actorUid: "member-1",
        actorName: "Member One",
        summary: "Member moved Tripod to Office › Desk",
        itemId: "item-1",
        createdAt: new Date()
      })
    );

    // cannot mutate or remove
    await assertFails(
      updateDoc(doc(memberDb, "households", HOUSEHOLD_ID, "activity", "activity-1"), { summary: "tampered" })
    );
    await assertFails(deleteDoc(doc(memberDb, "households", HOUSEHOLD_ID, "activity", "activity-1")));
  });

  it("denies activity reads and writes to non-members", async () => {
    await seedHousehold();
    const outsiderDb = testEnv.authenticatedContext("outsider-1").firestore();
    await assertFails(getDoc(doc(outsiderDb, "households", HOUSEHOLD_ID, "activity", "activity-1")));
    await assertFails(
      setDoc(doc(outsiderDb, "households", HOUSEHOLD_ID, "activity", "activity-3"), {
        householdId: HOUSEHOLD_ID,
        type: "item_added",
        actorUid: "outsider-1",
        actorName: "Outsider",
        summary: "Outsider should not write",
        createdAt: new Date()
      })
    );
  });
```

- [x] **Step 2: Run the rules test to verify it fails**

Run: `npm run test:rules`
Expected: FAIL — the `activity` create/read currently falls through to default-deny (no `match /activity` block yet), so `assertSucceeds(getDoc(...))` and `assertSucceeds(setDoc(...))` fail.

- [x] **Step 3: Add the `activity` rules block**

In `firestore.rules`, inside `match /households/{householdId} { … }`, add directly after the `match /packingLists/{listId} { … }` block:
```
      match /activity/{activityId} {
        allow read: if isHouseholdMember(householdId);
        allow create: if isHouseholdMember(householdId);
        allow update, delete: if false;
      }
```

- [x] **Step 4: Run the rules test to verify it passes**

Run: `npm run test:rules`
Expected: PASS — all existing rules tests plus the two new activity tests pass.

- [x] **Step 5: Commit**

```bash
git add firestore.rules tests/firestore.rules.test.ts
git commit -m "feat(mobile): allow member read/create on activity, forbid update/delete (+ rules test)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `useWorkspaceData` — activity subscription, actions, error source

**Files:**
- Modify: `src/features/stow/hooks/useWorkspaceData.ts`

> No new unit test (this hook has none today and is React-stateful; covered by manual + Playwright). The change mirrors the existing `packingLists` subscription effect exactly, adds the four P4 actions to the `actions` memo + the `WorkspaceActions` type, and threads `"activity"` through `WorkspaceErrorSource`, `emptyErrors()`, and the `error` precedence order (contract §6.3).

- [x] **Step 1: Add the four P4 actions to the `WorkspaceActions` type**

Find (end of the `WorkspaceActions` type, the last few members):
```ts
  togglePackingListItem: typeof inventoryRepository.togglePackingListItem;
  clearPackingListPacked: typeof inventoryRepository.clearPackingListPacked;
};
```
Replace with:
```ts
  togglePackingListItem: typeof inventoryRepository.togglePackingListItem;
  clearPackingListPacked: typeof inventoryRepository.clearPackingListPacked;
  logActivity: typeof inventoryRepository.logActivity;
  setItemStatus: typeof inventoryRepository.setItemStatus;
  setItemLoan: typeof inventoryRepository.setItemLoan;
  clearItemLoan: typeof inventoryRepository.clearItemLoan;
};
```

- [x] **Step 2: Add `"activity"` to the error-source type and `emptyErrors()`**

Find:
```ts
type WorkspaceErrorSource = "household" | "spaces" | "areas" | "items" | "itemDrafts" | "members" | "invites" | "llmConfig" | "packingLists";
```
Replace with:
```ts
type WorkspaceErrorSource = "household" | "spaces" | "areas" | "items" | "itemDrafts" | "members" | "invites" | "llmConfig" | "packingLists" | "activity";
```

Find (in `emptyErrors()`):
```ts
    llmConfig: null,
    packingLists: null
  };
```
Replace with:
```ts
    llmConfig: null,
    packingLists: null,
    activity: null
  };
```

- [x] **Step 3: Import `ActivityEntry` and add `activityState`**

Find:
```ts
import type { Area, Household, HouseholdInvite, HouseholdMember, Item, ItemDraft, PackingList, Space, SpaceWithAreas } from "@/types/domain";
```
Replace with:
```ts
import type { ActivityEntry, Area, Household, HouseholdInvite, HouseholdMember, Item, ItemDraft, PackingList, Space, SpaceWithAreas } from "@/types/domain";
```

Find:
```ts
  const [packingListsState, setPackingListsState] = useState<CollectionState<PackingList>>(emptyState());
```
Add directly below it:
```ts
  const [activityState, setActivityState] = useState<CollectionState<ActivityEntry>>(emptyState());
```

- [x] **Step 4: Reset `activityState` in the household-change effect**

Find (in the reset `useEffect` keyed on `[householdId]`):
```ts
    setPackingListsState(emptyState());
    setLlmConfig(null);
```
Replace with:
```ts
    setPackingListsState(emptyState());
    setActivityState(emptyState());
    setLlmConfig(null);
```

- [x] **Step 5: Add the activity subscription effect** (mirror the `packingLists` effect)

Find the entire `packingLists` subscription effect:
```ts
  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribePackingLists(
      householdId,
      (state) => {
        setPackingListsState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("packingLists", null);
      },
      (e) => setSourceError("packingLists", e.message)
    );
    return () => unsub();
  }, [householdId]);
```
Add directly **after** it:
```ts
  useEffect(() => {
    if (!householdId) return;
    const unsub = inventoryRepository.subscribeActivity(
      householdId,
      50,
      (state) => {
        setActivityState({ items: state.data, fromCache: state.fromCache, hasPendingWrites: state.hasPendingWrites });
        setSourceError("activity", null);
      },
      (e) => setSourceError("activity", e.message)
    );
    return () => unsub();
  }, [householdId]);
```

- [x] **Step 6: Add `"activity"` to the `error` precedence order**

Find:
```ts
    const order: WorkspaceErrorSource[] = ["household", "spaces", "areas", "items", "itemDrafts", "members", "invites", "llmConfig", "packingLists"];
```
Replace with:
```ts
    const order: WorkspaceErrorSource[] = ["household", "spaces", "areas", "items", "itemDrafts", "members", "invites", "llmConfig", "packingLists", "activity"];
```

- [x] **Step 7: Add the four actions to the `actions` memo**

Find:
```ts
      togglePackingListItem: inventoryRepository.togglePackingListItem,
      clearPackingListPacked: inventoryRepository.clearPackingListPacked
    }),
    []
  );
```
Replace with:
```ts
      togglePackingListItem: inventoryRepository.togglePackingListItem,
      clearPackingListPacked: inventoryRepository.clearPackingListPacked,
      logActivity: inventoryRepository.logActivity,
      setItemStatus: inventoryRepository.setItemStatus,
      setItemLoan: inventoryRepository.setItemLoan,
      clearItemLoan: inventoryRepository.clearItemLoan
    }),
    []
  );
```

- [x] **Step 8: Return `activity` from the hook**

Find:
```ts
    packingLists: packingListsState.items,
    llmConfig,
```
Replace with:
```ts
    packingLists: packingListsState.items,
    activity: activityState.items,
    llmConfig,
```

> Note: `activityState` is intentionally **not** added to the `sync` memo's `fromCache`/`hasPendingWrites` aggregation — the feed is non-critical and its cache state should not gate the global offline banner. (If a later phase wants it included, add `activityState.fromCache`/`hasPendingWrites` there.)

- [x] **Step 9: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 10: Run the unit suite** (ensures nothing regressed; new repo tests included)

Run: `npm test`
Expected: PASS, including `activity.test.ts` and `normalizeItemStatus.test.ts`.

- [x] **Step 11: Commit**

```bash
git add src/features/stow/hooks/useWorkspaceData.ts
git commit -m "feat(mobile): subscribe to activity and expose status/loan actions in useWorkspaceData

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Navigation — `isActivityPath` helper + `goActivity` + bell wiring

**Files:**
- Modify: `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts`
- Modify: `src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`

> Contract §3 (P4): add a **pure** helper `isActivityPath(pathname, basePath): boolean` and a `goActivity()` navigator; the bell calls `navigate(\`${basePath}/activity\`)` via `goActivity()`. Keep `MobileRoute` shape stable — do **not** add a route field; `StowMobileApp` (Task 8 wiring) checks `isActivityPath` to render `ActivityScreen` as a full-screen routed view.

- [x] **Step 1: Write the failing test**

In `src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`, add a new `describe` block at the end of the file:
```ts
import { isActivityPath } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";

describe("isActivityPath", () => {
  it("matches the activity path under the default base", () => {
    expect(isActivityPath("/app/activity", "/app")).toBe(true);
    expect(isActivityPath("/app/activity/", "/app")).toBe(true);
  });
  it("is false for other paths", () => {
    expect(isActivityPath("/app", "/app")).toBe(false);
    expect(isActivityPath("/app/search", "/app")).toBe(false);
    expect(isActivityPath("/app/spaces/s1", "/app")).toBe(false);
    expect(isActivityPath("/app/items/i1", "/app")).toBe(false);
  });
  it("is prefix-aware for cutover with an empty base", () => {
    expect(isActivityPath("/activity", "")).toBe(true);
    expect(isActivityPath("/", "")).toBe(false);
  });
});
```
(If `useMobileNavigation.test.ts` already imports `parseMobileRoute, buildMobilePath` from the module, extend that import to include `isActivityPath` instead of adding a second import line.)

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`
Expected: FAIL — `isActivityPath` is not exported.

- [x] **Step 3: Add `isActivityPath` (pure) + `goActivity` (hook)**

In `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts`:

**(a)** Add the pure helper near `parseMobileRoute` (it reuses the existing `stripBase` helper):
```ts
export function isActivityPath(pathname: string, basePath = "/app"): boolean {
  const rel = stripBase(pathname, basePath);
  return rel === "/activity" || rel === "/activity/";
}
```

**(b)** In the `useMobileNavigation` hook body, add a `goActivity` navigator next to `navigateToTab` (it uses the existing `navigate` + `basePath`):
```ts
  function goActivity() {
    const b = basePath === "/" ? "" : basePath;
    navigate(`${b}/activity`);
  }
```

**(c)** Add `goActivity` to the hook's returned object. Find the return block and add `goActivity,` after `navigateToTab,`:
```ts
    navigateToTab,
    goActivity,
    openSpace,
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts`
Expected: PASS (existing nav tests + 3 new `isActivityPath` cases).

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/hooks/useMobileNavigation.ts src/features/stow/ui/mobile/hooks/useMobileNavigation.test.ts
git commit -m "feat(mobile): add isActivityPath helper and goActivity navigator

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Relative-time helper + `selectAwayItems` selector (pure)

**Files:**
- Create: `src/features/stow/ui/mobile/screens/activitySelectors.ts`
- Create: `src/features/stow/ui/mobile/screens/activitySelectors.test.ts`

> Two pure helpers used by the P4 screens, tested in node: `formatRelativeTime(ts, now)` (for the feed + away strip + loan duration) and `selectAwayItems(items)` (status `!== "home"`, for the home strip). `formatRelativeTime` accepts a Firestore-`Timestamp`-like value (anything with `.toMillis()`) **or** a millis number **or** a `Date`, so it is callable from both live `ActivityEntry.createdAt`/`ItemLoan.since` (Firestore `Timestamp`) and tests (plain numbers).

- [ ] **Step 1: Write the failing test**

```ts
// src/features/stow/ui/mobile/screens/activitySelectors.test.ts
import { describe, expect, it } from "vitest";
import { formatRelativeTime, selectAwayItems } from "@/features/stow/ui/mobile/screens/activitySelectors";
import type { Item } from "@/types/domain";

const NOW = 1_700_000_000_000; // fixed "now" in ms

describe("formatRelativeTime", () => {
  it("returns 'just now' under a minute", () => {
    expect(formatRelativeTime(NOW - 5_000, NOW)).toBe("just now");
    expect(formatRelativeTime(NOW, NOW)).toBe("just now");
  });
  it("formats minutes, hours, days, weeks", () => {
    expect(formatRelativeTime(NOW - 3 * 60_000, NOW)).toBe("3m ago");
    expect(formatRelativeTime(NOW - 2 * 3_600_000, NOW)).toBe("2h ago");
    expect(formatRelativeTime(NOW - 1 * 3_600_000, NOW)).toBe("1h ago");
    expect(formatRelativeTime(NOW - 3 * 86_400_000, NOW)).toBe("3d ago");
    expect(formatRelativeTime(NOW - 14 * 86_400_000, NOW)).toBe("2w ago");
  });
  it("accepts a Timestamp-like value with toMillis()", () => {
    const ts = { toMillis: () => NOW - 60_000 };
    expect(formatRelativeTime(ts, NOW)).toBe("1m ago");
  });
  it("accepts a Date", () => {
    expect(formatRelativeTime(new Date(NOW - 86_400_000), NOW)).toBe("1d ago");
  });
  it("guards null/undefined/un-coercible input", () => {
    expect(formatRelativeTime(null, NOW)).toBe("");
    expect(formatRelativeTime(undefined, NOW)).toBe("");
    expect(formatRelativeTime({} as unknown, NOW)).toBe("");
  });
});

function item(partial: Partial<Item> & Pick<Item, "id" | "status">): Item {
  return {
    householdId: "h1",
    spaceId: "s1",
    areaId: "a1",
    areaNameSnapshot: "Shelf",
    name: partial.name ?? partial.id,
    kind: "item",
    tags: [],
    isPacked: false,
    photoStatus: "later",
    entryMode: "manual",
    createdBy: "u1",
    updatedBy: "u1",
    createdAt: { toMillis: () => 0 } as unknown as Item["createdAt"],
    updatedAt: { toMillis: () => 0 } as unknown as Item["updatedAt"],
    ...partial
  } as Item;
}

describe("selectAwayItems", () => {
  it("keeps only items whose status is not home", () => {
    const items = [
      item({ id: "a", status: "home" }),
      item({ id: "b", status: "lent" }),
      item({ id: "c", status: "packed" }),
      item({ id: "d", status: "repair" }),
      item({ id: "e", status: "lost" })
    ];
    expect(selectAwayItems(items).map((i) => i.id)).toEqual(["b", "c", "d", "e"]);
  });
  it("treats a missing status as home (excluded)", () => {
    const stray = item({ id: "x", status: undefined as unknown as Item["status"] });
    expect(selectAwayItems([stray])).toEqual([]);
  });
  it("returns a new array and does not mutate the input", () => {
    const items = [item({ id: "a", status: "lent" })];
    const out = selectAwayItems(items);
    expect(out).not.toBe(items);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/screens/activitySelectors.test.ts`
Expected: FAIL — module cannot be resolved.

- [ ] **Step 3: Write the implementation**

```ts
// src/features/stow/ui/mobile/screens/activitySelectors.ts
import type { Item } from "@/types/domain";

type TimeInput = number | Date | { toMillis: () => number } | null | undefined;

function toMillis(value: TimeInput): number | null {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof (value as { toMillis?: unknown }).toMillis === "function") {
    const ms = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 7 * DAY;

/** Compact relative time: "just now", "3m ago", "2h ago", "5d ago", "2w ago".
 *  Accepts a Firestore Timestamp (toMillis), a millis number, or a Date. Empty string if un-coercible. */
export function formatRelativeTime(value: TimeInput, now: number = Date.now()): string {
  const then = toMillis(value);
  if (then == null) return "";
  const diff = Math.max(0, now - then);
  if (diff < MIN) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < WEEK) return `${Math.floor(diff / DAY)}d ago`;
  return `${Math.floor(diff / WEEK)}w ago`;
}

/** Items that are not currently "at home" — drives the home "Away from home" strip. */
export function selectAwayItems(items: Item[]): Item[] {
  return items.filter((it) => it.status !== "home" && it.status != null);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/screens/activitySelectors.test.ts`
Expected: PASS (formatRelativeTime: 5 cases; selectAwayItems: 3 cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/screens/activitySelectors.ts src/features/stow/ui/mobile/screens/activitySelectors.test.ts
git commit -m "feat(mobile): add formatRelativeTime and selectAwayItems pure helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Wire `logActivity` at all P1/P2/P3 call sites

**Files:**
- Modify: `src/features/stow/ui/mobile/add/AddItemSheet.tsx` (item_added)
- Modify: `src/features/stow/ui/mobile/screens/ItemDetail.tsx` (item_moved, item_deleted; status changes handled in Task 11)
- Modify: `src/features/stow/ui/mobile/spaces/SpaceActionSheet.tsx` and/or `src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx` (space_deleted; item_moved on delete-with-reassignment is logged by the caller as a single `item_moved` per reassigned item is **not** required — log only `space_deleted`)
- Modify: `src/features/stow/ui/mobile/add/AddSpaceSheet.tsx` (space_added)
- Modify: `src/features/stow/ui/mobile/capture/QuickCapture.tsx` (items_added_batch)
- Modify (if item delete also lives there): `src/features/stow/ui/mobile/screens/RoomScreen.tsx`

> These mobile files were created in P1–P3. Each already calls a `useWorkspaceData()` action (`actions.createItem`, `actions.updateItem` for a move, `actions.deleteItem`, `actions.createSpace`, `actions.deleteSpace`, `actions.createItemsBatch`). For each, after the awaited write resolves, call `actions.logActivity({ householdId, entry: buildActivityEntry({ … }) })`. Import `buildActivityEntry` from the repository: `import { buildActivityEntry } from "@/features/stow/services/repository";`. The actor name comes from the current member: resolve it once via the `members` array — `members.find(m => m.uid === userId)?.displayName ?? members.find(m => m.uid === userId)?.email ?? "Someone"`. (Define a small local `actorName` const where each call site has `userId`/`members` in scope; if a screen lacks `members`, read it from `useWorkspaceData()`.) **There is no unit test for this task** (these are UI call sites); correctness is verified by the Playwright test in Task 12 and manual smoke.

- [ ] **Step 1: `item_added` — in `AddItemSheet` (and `CaptureFirst` if it creates items directly)**

After the `await actions.createItem({...})` resolves (it returns the new `itemId`), and using the space/area chosen in the sheet, add:
```ts
const newItemId = await actions.createItem({ /* …existing args… */ });
await actions.logActivity({
  householdId,
  entry: buildActivityEntry({
    type: "item_added",
    actorUid: userId,
    actorName,
    itemName: name.trim(),
    spaceName: selectedSpace?.name,
    areaName: areaNameSnapshot,
    spaceId,
    areaId,
    itemId: newItemId
  })
});
```
where `selectedSpace` is the chosen `SpaceWithAreas` and `areaNameSnapshot` is the snapshot already passed to `createItem`. (`CaptureFirst` in P2 completes a draft via `actions.completeItemDraft` — log the same `item_added` entry there after it resolves, using its returned item id.)

- [ ] **Step 2: `item_moved` — in `ItemDetail` move action**

The move sub-mode calls `actions.updateItem({ … patch: { spaceId, areaId, areaNameSnapshot } })`. After it resolves:
```ts
await actions.updateItem({ householdId, itemId, userId, patch: { spaceId: destSpaceId, areaId: destAreaId, areaNameSnapshot: destAreaName } });
await actions.logActivity({
  householdId,
  entry: buildActivityEntry({
    type: "item_moved",
    actorUid: userId,
    actorName,
    itemName: item.name,
    spaceName: destSpace?.name,
    areaName: destAreaName,
    spaceId: destSpaceId,
    areaId: destAreaId,
    itemId
  })
});
```

- [ ] **Step 3: `item_deleted` — in `ItemDetail` (or `RoomScreen`) delete action**

After `await actions.deleteItem({ householdId, itemId, userId })` resolves (capture `item.name` **before** deletion):
```ts
const deletedName = item.name;
await actions.deleteItem({ householdId, itemId, userId });
await actions.logActivity({
  householdId,
  entry: buildActivityEntry({ type: "item_deleted", actorUid: userId, actorName, itemName: deletedName, itemId })
});
```

- [ ] **Step 4: `space_added` — in `AddSpaceSheet`**

After `const newSpaceId = await actions.createSpace({...})` resolves:
```ts
await actions.logActivity({
  householdId,
  entry: buildActivityEntry({ type: "space_added", actorUid: userId, actorName, spaceName: name.trim(), spaceId: newSpaceId })
});
```

- [ ] **Step 5: `space_deleted` — in `SpaceActionSheet`/`EditSpaceSheet` delete confirm**

After `await actions.deleteSpace({ householdId, spaceId, userId, reassignTo? })` resolves (capture `space.name` first):
```ts
const deletedSpaceName = space.name;
await actions.deleteSpace({ householdId, spaceId, userId, reassignTo });
await actions.logActivity({
  householdId,
  entry: buildActivityEntry({ type: "space_deleted", actorUid: userId, actorName, spaceName: deletedSpaceName, spaceId })
});
```

- [ ] **Step 6: `items_added_batch` — in `QuickCapture` commit (P3 call site)**

`QuickCapture`'s Done step calls `await actions.createItemsBatch({ householdId, userId, items })` and then `onCommitted(count)`. Between the resolve and `onCommitted`, log one batch entry with the **destination** captured in the reducer state and the count of committed items:
```ts
const ids = await actions.createItemsBatch({ householdId, userId, items: committedItems });
await actions.logActivity({
  householdId,
  entry: buildActivityEntry({
    type: "items_added_batch",
    actorUid: userId,
    actorName,
    count: ids.length,
    spaceName: destSpace?.name,
    areaName: destination.areaNameSnapshot,
    spaceId: destination.spaceId ?? undefined,
    areaId: destination.areaId ?? undefined
  })
});
onCommitted(ids.length);
```
(`destination` is `captureReducer` state's `destination`; `destSpace` is the `SpaceWithAreas` for `destination.spaceId`.)

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: PASS. Resolve any "actorName/members not in scope" by reading `members` from `useWorkspaceData()` in that component and deriving `actorName` as described in the task intro.

- [ ] **Step 8: Commit**

```bash
git add src/features/stow/ui/mobile/add/AddItemSheet.tsx src/features/stow/ui/mobile/add/AddSpaceSheet.tsx src/features/stow/ui/mobile/screens/ItemDetail.tsx src/features/stow/ui/mobile/screens/RoomScreen.tsx src/features/stow/ui/mobile/spaces/SpaceActionSheet.tsx src/features/stow/ui/mobile/spaces/EditSpaceSheet.tsx src/features/stow/ui/mobile/capture/QuickCapture.tsx
git commit -m "feat(mobile): log activity at item/space add, move, delete, and batch-capture call sites

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: `ActivityScreen` — routed household feed

**Files:**
- Create: `src/features/stow/ui/mobile/screens/ActivityScreen.tsx`
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx` (render `ActivityScreen` when `isActivityPath` matches; bell → `goActivity`)

> Full-screen routed view at `${basePath}/activity` (bell target, contract §3 + §10). Reads `activity` from `useWorkspaceData`. Each row: actor `Avatar`-style initials circle, `summary`, relative time (`formatRelativeTime`), and a deep-link via `openItem(itemId)` (or `openSpace(spaceId)` when no `itemId`). No dedicated prototype frame exists; derive the row treatment from `enhance/maintain.jsx` `M3_Loans` grouped rows + `enhance/parts.jsx` `Avatar`/`Eyebrow`/`Card`, translating tokens per §1.3.

- [ ] **Step 1: Define the prop interface + data wiring**

`ActivityScreen` props:
```ts
interface ActivityScreenProps {
  activity: ActivityEntry[];          // from useWorkspaceData().activity (already createdAt-desc)
  members: HouseholdMember[];         // to color the actor initials chip by member
  onBack: () => void;                 // nav.back
  onOpenItem: (itemId: string) => void;   // nav.openItem
  onOpenSpace: (spaceId: string) => void; // nav.openSpace
}
```
Consumes from `useWorkspaceData`: `activity`, `members`. Consumes from `useMobileNavigation`: `back`, `openItem`, `openSpace`. (`StowMobileApp` passes these down — see Step 4.)

- [ ] **Step 2: Section-by-section structure**

1. **Sticky glass header** — back chevron button (calls `onBack`), title "Activity" in `var(--stow-display)`, top-padded for safe area (`calc(env(safe-area-inset-top) + …)`). Same glass treatment as other screens: `background: color-mix(in srgb, var(--stow-surface) 90%, transparent)`, `backdrop-filter: blur(20px)`, bottom border `var(--stow-border-l)`.
2. **Empty state** — when `activity.length === 0`: centered muted icon (`Clock`/`Bell` from `theme/icons`), "No activity yet", subtext "Adds, moves, and status changes will show up here."
3. **Feed list** — vertical list of rows inside a `Card`-style surface (or day-grouped sections — optional; a single chronological list satisfies the spec). Each **row**:
   - Leading initials chip: a 34–38px rounded circle, background derived from the actor (hash `actorUid` to one of the space-accent swatches, or `var(--stow-accent)` fallback), white initials from `actorName` (first letters of up to two words). Reuse the derivation logic from `enhance/parts.jsx` `Avatar` (initials = name split on spaces, first char of each, slice 2).
   - Body: `summary` in `var(--stow-ink)` weight 600/700; below it the relative time `formatRelativeTime(entry.createdAt)` in `var(--stow-warm)`.
   - Trailing: a `ChevronRight` when the row is deep-linkable.
   - Row `onClick`: if `entry.itemId` → `onOpenItem(entry.itemId)`; else if `entry.spaceId` → `onOpenSpace(entry.spaceId)`; else no-op (not clickable; omit chevron, `cursor: default`).
4. Content area pads bottom ~150px to clear the floating nav (matches `RetrievalHome`).

- [ ] **Step 3: Non-obvious code (initials + accent + deep-link guard)**

```tsx
const SWATCHES = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB", "#D6336C"];
function actorColor(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return SWATCHES[h % SWATCHES.length];
}
function initials(name: string): string {
  return name.trim().split(/\s+/).map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase() || "?";
}
function deepLink(entry: ActivityEntry, onOpenItem: (id: string) => void, onOpenSpace: (id: string) => void) {
  if (entry.itemId) return () => onOpenItem(entry.itemId!);
  if (entry.spaceId) return () => onOpenSpace(entry.spaceId!);
  return undefined;
}
```
Render each row with `const onRow = deepLink(entry, onOpenItem, onOpenSpace);` and only attach `onClick={onRow}` + show the chevron when `onRow` is defined. Use `formatRelativeTime(entry.createdAt)` for the timestamp (already imported from `./activitySelectors`).

- [ ] **Step 4: Port the markup**

Port the row/card/empty-state markup by adapting `enhance/maintain.jsx` `M3_Loans` (the grouped `Card` + per-row `display:flex` with leading tile, flex body of two stacked lines, trailing action) into a flat chronological list, and the `Avatar` initials chip from `enhance/parts.jsx`. Translate tokens per §1.3 (`P.surface` → `var(--stow-surface)`, `P.borderL` → `var(--stow-border-l)`, `P.ink`/`P.warm` → `var(--stow-ink)`/`var(--stow-warm)`, `P.radius + 8` → `var(--stow-radius-card)`). The header mirrors `screens-core.jsx` `RetrievalHome`'s sticky glass header structure (back button replaces the wordmark).

- [ ] **Step 5: Wire into `StowMobileApp`**

In `src/features/stow/ui/mobile/StowMobileApp.tsx`:

**(a)** Import the screen + helper:
```ts
import { ActivityScreen } from "@/features/stow/ui/mobile/screens/ActivityScreen";
import { isActivityPath } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { useLocation } from "react-router-dom";
```
(If `StowMobileApp` already derives the location/pathname, reuse it instead of importing `useLocation` again.)

**(b)** Compute the activity flag and render it as a full-screen overlay above the tab content (so the bell can open it over any tab), before/above the `ItemDetail` overlay in the render tree but using the same z-tier as a routed screen (it replaces the screen content; the bottom nav can remain). Sketch:
```tsx
const location = useLocation();
const activityOpen = isActivityPath(location.pathname, nav.basePath);
// …inside the viewport, after the main screen switch:
{activityOpen ? (
  <ActivityScreen
    activity={data.activity}
    members={data.members}
    onBack={nav.back}
    onOpenItem={nav.openItem}
    onOpenSpace={(spaceId) => nav.openSpace(spaceId)}
  />
) : null}
```
Render `ActivityScreen` with `position: absolute; inset: 0; z-index: 25` (below the nav at 30 so the user can still tab away, matching how a routed screen behaves; deep-links navigate away which clears `activityOpen`).

**(c)** Wire the **bell** to `nav.goActivity`. The bell lives in `HomeScreen`'s header (P1). Pass an `onBell` prop down to `HomeScreen` from `StowMobileApp` (`onBell={nav.goActivity}`) and bind it to the existing bell button's `onClick`. (If `HomeScreen` already accepts a nav object, call `nav.goActivity` directly on the bell.)

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Manual smoke**

Run: `npm run dev`, open `/app`, tap the bell on the Home header → URL becomes `/app/activity` and the feed renders (empty state if no activity yet). Add an item (P1 flow) → return to Home → tap bell → the "added" entry appears with relative time; tapping it deep-links to the item.

- [ ] **Step 8: Commit**

```bash
git add src/features/stow/ui/mobile/screens/ActivityScreen.tsx src/features/stow/ui/mobile/StowMobileApp.tsx
git commit -m "feat(mobile): add ActivityScreen routed feed and wire the bell to /activity

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Status control + lending sheet in `ItemDetail`

**Files:**
- Create: `src/features/stow/ui/mobile/screens/StatusVocab.ts` (shared status label/color/icon map)
- Create: `src/features/stow/ui/mobile/screens/LendingSheet.tsx`
- Modify: `src/features/stow/ui/mobile/screens/ItemDetail.tsx` (status control + open lending sheet)

> Spec §7.2/§7.3 + contract §10: `ItemDetail` gains a **status control** (the five `ItemStatus` values) and, when status becomes `lent`, a **lending sheet** to capture borrower (a household member or free-text name) + `since`/`due`/`note`. Wiring: choosing a non-lent status → `actions.setItemStatus`; choosing `lent` (and confirming the sheet) → `actions.setItemLoan`; clearing back to home from a lent item → `actions.clearItemLoan`. Each status change also logs `item_status_changed` activity. Port the status list + loan-details treatment from `enhance/maintain.jsx` `M2_StatusSheet`; the status vocabulary (label/color/soft/icon) comes from `enhance/parts.jsx` `STATUS`. Validated by manual + the Playwright test in Task 12 (no unit DOM test).

- [ ] **Step 1: Add the shared status vocabulary**

```ts
// src/features/stow/ui/mobile/screens/StatusVocab.ts
import type { ItemStatus } from "@/types/domain";
import { Home, Package, Users, Wrench, Search } from "@/features/stow/ui/mobile/theme/icons";
import type { LucideIcon } from "lucide-react";

export interface StatusMeta { label: string; color: string; soft: string; Icon: LucideIcon; }

// Mirrors enhance/parts.jsx STATUS, with our token-friendly colors.
export const STATUS_META: Record<ItemStatus, StatusMeta> = {
  home:   { label: "At home",   color: "var(--stow-ink-muted)", soft: "var(--stow-border-l)", Icon: Home },
  packed: { label: "Packed",    color: "#5B6ABF", soft: "#ECEEF8", Icon: Package },
  lent:   { label: "Lent out",  color: "var(--stow-accent)", soft: "var(--stow-accent-soft)", Icon: Users },
  repair: { label: "In repair", color: "#C4883A", soft: "#F8F0E2", Icon: Wrench },
  lost:   { label: "Missing",   color: "var(--stow-danger)", soft: "var(--stow-danger-soft)", Icon: Search }
};

export const STATUS_ORDER: ItemStatus[] = ["home", "packed", "lent", "repair", "lost"];
```
(If `Users` is not yet re-exported from `theme/icons`, add it to the `lucide-react` import + the shell/UI glyph re-export in `theme/icons.tsx` — it is a real lucide export. Same for `Wrench`/`Search`/`Package`/`Home` if any are missing.)

- [ ] **Step 2: Build the `LendingSheet` component**

Props:
```ts
interface LendingSheetProps {
  open: boolean;
  members: HouseholdMember[];
  initial?: { to?: string; due?: string; note?: string }; // prefill when editing an existing loan
  onCancel: () => void;
  onConfirm: (loan: { to: string; toUid?: string; dueMs?: number; note?: string }) => void;
}
```
Structure (port from `M2_StatusSheet`'s "Loan details" block, wrapped in the shared `Sheet` primitive from `shell/Sheet.tsx`):
- **Borrower row** — horizontal list of member `Avatar`-style chips (initials + name; selecting one sets `to = displayName/email`, `toUid = uid`) plus an "Other" chip that reveals a free-text `Field` for a name (clears `toUid`). Reuse the initials/`actorColor` approach from Task 10 or the `Avatar` from `enhance/parts.jsx`.
- **Since** is implicit (`serverTimestamp` at write time — not collected; `ItemLoan.since` is set by the caller, see Step 4).
- **Due (optional)** — a date `Field` (`type="date"`); parse to millis on confirm (`dueMs`).
- **Note (optional)** — a multiline `Field`.
- **Confirm button** — disabled until a borrower is chosen; label "Save · Lent to {firstName}" (mirrors the prototype). Calls `onConfirm({ to, toUid, dueMs, note })`.

- [ ] **Step 3: Add the status control to `ItemDetail` view mode**

In `ItemDetail` (the location-first view sub-mode, **after** the Location hero card and the demoted value line, before Notes), add a **Status** control:
- A row of the five statuses rendered from `STATUS_ORDER`/`STATUS_META` (compact pill buttons or a single tappable "Status" card that opens an `ActionSheet` listing the five — either is acceptable; the prototype uses a full sheet). The current `item.status` is highlighted (selected = filled `meta.color` tile + check, mirroring `M2_StatusSheet`).
- When the item is currently `lent` and `item.loan` exists, show a small loan summary line under the control: borrower + `formatRelativeTime(item.loan.since)` ("Lent to Marcus · 3w ago"), reusing `formatRelativeTime` from `./activitySelectors`.

- [ ] **Step 4: Wire the status/loan handlers**

In `ItemDetail`, with `householdId`, `item`, `userId`, `members`, and `actions` (+ `actorName` derived as in Task 9) in scope:

```ts
async function changeStatus(next: ItemStatus) {
  if (next === "lent") { setLendingOpen(true); return; }      // collect loan details first
  if (item.status === "lent") {
    await actions.clearItemLoan({ householdId, itemId: item.id, userId });
    if (next !== "home") {
      await actions.setItemStatus({ householdId, itemId: item.id, userId, status: next });
    }
  } else {
    await actions.setItemStatus({ householdId, itemId: item.id, userId, status: next });
  }
  await actions.logActivity({
    householdId,
    entry: buildActivityEntry({ type: "item_status_changed", actorUid: userId, actorName, itemName: item.name, status: next, itemId: item.id })
  });
}

async function confirmLoan(loan: { to: string; toUid?: string; dueMs?: number; note?: string }) {
  setLendingOpen(false);
  await actions.setItemLoan({
    householdId,
    itemId: item.id,
    userId,
    loan: {
      to: loan.to,
      ...(loan.toUid ? { toUid: loan.toUid } : {}),
      since: serverTimestamp() as unknown as Timestamp,
      ...(loan.dueMs ? { due: Timestamp.fromMillis(loan.dueMs) } : {}),
      ...(loan.note ? { note: loan.note } : {})
    }
  });
  await actions.logActivity({
    householdId,
    entry: buildActivityEntry({ type: "item_status_changed", actorUid: userId, actorName, itemName: item.name, status: "lent", loanTo: loan.to, itemId: item.id })
  });
}
```
Imports in `ItemDetail`: `import { serverTimestamp, Timestamp } from "firebase/firestore";` and `import { buildActivityEntry } from "@/features/stow/services/repository";`. State: `const [lendingOpen, setLendingOpen] = useState(false);`. Render `<LendingSheet open={lendingOpen} members={members} initial={loanInitial} onCancel={() => setLendingOpen(false)} onConfirm={confirmLoan} />`.

> **`serverTimestamp()` in a nested map:** Firestore accepts a sentinel `serverTimestamp()` as a field value inside the object passed to `updateDoc`/`setDoc` (the `loan.since` slot). The `as unknown as Timestamp` cast satisfies the `ItemLoan` type at the call boundary; the actual stored value resolves server-side. `due` uses a concrete `Timestamp.fromMillis` (sentinels are not allowed for non-top-level future-due values, and `due` is user-chosen, not "now").

- [ ] **Step 5: Port the markup**

Port the status list + selected treatment from `enhance/maintain.jsx` `M2_StatusSheet` (the `order.map(...)` status rows with the filled tile + check) and the loan-details block into `LendingSheet`, translating tokens per §1.3 and reading colors from `STATUS_META`. The status control inside `ItemDetail` follows the same card/row idiom already used by the Location hero card.

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Manual smoke**

Run `npm run dev`, open an item, change status to "In repair" → status reflects + an `item_status_changed` entry shows in Activity. Change status to "Lent out" → lending sheet opens; pick a member, optionally set due/note, Save → item shows "Lent to {name}", appears in the Home Away strip (Task 12 verifies), and Activity shows "… marked {item} lent to {name}". Set it back to "At home" → loan clears, item leaves the Away strip.

- [ ] **Step 8: Commit**

```bash
git add src/features/stow/ui/mobile/screens/StatusVocab.ts src/features/stow/ui/mobile/screens/LendingSheet.tsx src/features/stow/ui/mobile/screens/ItemDetail.tsx src/features/stow/ui/mobile/theme/icons.tsx
git commit -m "feat(mobile): add item status control + lending sheet wired to setItemStatus/setItemLoan/clearItemLoan

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Home "Away from home" strip

**Files:**
- Create: `src/features/stow/ui/mobile/screens/AwayStrip.tsx`
- Modify: `src/features/stow/ui/mobile/screens/HomeScreen.tsx` (render the strip in the idle state)

> Spec §7.3 + contract §10: a glanceable strip on the home screen listing items that are not at home (`selectAwayItems`), each with a `StatusPill`-style badge and (for lent items) borrower + duration; tapping opens the item. Renders in `RetrievalHome`'s idle branch, above `SpacesManagedList`. Port from `enhance/maintain.jsx` `M1_AwayHome` (the "Away from home" `Eyebrow` + `Card` with per-row status pill + meta). Validated by manual + Playwright.

- [ ] **Step 1: Define the prop interface + data wiring**

```ts
interface AwayStripProps {
  items: Item[];                       // pass useWorkspaceData().items; strip filters via selectAwayItems
  members: HouseholdMember[];          // to render the borrower's name on lent rows
  onOpenItem: (itemId: string) => void;
}
```
Internally: `const away = selectAwayItems(items);` (from `./activitySelectors`). If `away.length === 0`, render `null` (no empty strip). Status visuals come from `STATUS_META` (Task 11). Borrower name on a lent row: `item.loan?.to` (already a display string) with `formatRelativeTime(item.loan?.since)`.

- [ ] **Step 2: Section-by-section structure**

1. **Eyebrow** — "Away from home" with a trailing count chip (count = `away.length`), accent-colored (port `enhance/parts.jsx` `Eyebrow` with `count`/`countColor`).
2. **Card list** — one row per away item:
   - Leading thumb: `item.image?.downloadUrl` → `<img>`; else a glyph tile (`iconForKey`-style placeholder / `Box` fallback) on `var(--stow-canvas)`.
   - Body: item name (ellipsised) + a second line with the `StatusPill` (status dot + label from `STATUS_META`) and, when lent, the borrower first name + duration ("Marcus · 3w ago"); use `var(--stow-danger)` text when a `due` exists and is in the past (overdue), else `var(--stow-warm)`.
   - Row `onClick` → `onOpenItem(item.id)`; trailing `ChevronRight`.

- [ ] **Step 3: Non-obvious code (overdue + pill)**

```tsx
function isOverdue(item: Item, now = Date.now()): boolean {
  const due = item.loan?.due;
  if (!due) return false;
  const ms = typeof (due as { toMillis?: () => number }).toMillis === "function"
    ? (due as { toMillis: () => number }).toMillis()
    : NaN;
  return Number.isFinite(ms) && ms < now;
}
```
Render a small inline `StatusPill` (dot + `STATUS_META[item.status].label`) inline in the row; reuse `formatRelativeTime(item.loan?.since)` for the lent duration. (A standalone `StatusPill` component may be extracted from `enhance/parts.jsx`; inlining is fine since only the strip and `ItemDetail` use it — if both need it, extract `components/StatusPill.tsx`.)

- [ ] **Step 4: Port the markup**

Port the away-list `Card` + rows from `enhance/maintain.jsx` `M1_AwayHome` (the `away.map(...)` block: thumb/glyph, name, `StatusPill small` + meta with optional avatar, optional "Nudge" chip — the Nudge chip is **optional** for v1 and may be omitted), translating tokens per §1.3 and sourcing status colors from `STATUS_META`.

- [ ] **Step 5: Render in `HomeScreen`**

In `RetrievalHome`/`HomeScreen`'s **idle** branch (the `!searching` fragment), render `<AwayStrip items={items} members={members} onOpenItem={openItem} />` directly **above** the "Recently added" rail (so "away" is the first glanceable thing), or above `SpacesManagedList` — match the prototype, which places Away above Your Spaces. Ensure `HomeScreen` receives `members` from `useWorkspaceData` (add to its props/wiring if not already present).

- [ ] **Step 6: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/stow/ui/mobile/screens/AwayStrip.tsx src/features/stow/ui/mobile/screens/HomeScreen.tsx
git commit -m "feat(mobile): add Away-from-home strip to the home screen

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Playwright — mark an item lent → away strip + activity feed

**Files:**
- Create: `tests/smoke/app-lending.spec.ts` (or extend the existing `/app` smoke spec if one exists from P1)

> E2E against the emulator-backed app at `/app`: add an item, open it, mark it lent to a member, then assert it appears in the Home "Away from home" strip **and** as an entry in the Activity feed. Runs under `npm run test:smoke` (Firestore/Auth/Storage emulators). Use stable `data-testid`s added in the UI tasks where ambiguous (e.g. `data-testid="away-strip"`, `data-testid="activity-row"`, `data-testid="status-lent"`).

- [ ] **Step 1: Add test ids (if not already present)** to the relevant elements:
  - `AwayStrip` container → `data-testid="away-strip"`; each away row → `data-testid="away-item"` with the item name as text.
  - `ActivityScreen` rows → `data-testid="activity-row"`.
  - `ItemDetail` status buttons → `data-testid={\`status-\${status}\`}` (e.g. `status-lent`).
  - `LendingSheet` confirm → `data-testid="loan-save"`; member chip → `data-testid={\`borrower-\${uid}\`}`.

- [ ] **Step 2: Write the spec** (mirror the structure of the existing authenticated smoke spec under `tests/smoke/` — reuse its auth/seed helpers)

```ts
// tests/smoke/app-lending.spec.ts
import { test, expect } from "@playwright/test";
// reuse the project's existing auth/bootstrap helper from tests/smoke (e.g. signInTestUser)

test("@app marking an item lent surfaces it in the away strip and activity feed", async ({ page }) => {
  // 1. Sign in + land on /app (reuse the existing smoke auth helper).
  await page.goto("/app");
  // …authenticate via the shared helper…

  // 2. Create a space + an item (reuse the P1 add flows, or seed via the emulator before navigating).
  //    Open the item detail.
  // 3. Set status to Lent out, pick the current user as borrower, save.
  await page.getByTestId("status-lent").click();
  await page.getByTestId(/^borrower-/).first().click();
  await page.getByTestId("loan-save").click();

  // 4. Back to Home → the item appears in the Away strip.
  await page.goto("/app");
  await expect(page.getByTestId("away-strip")).toBeVisible();
  await expect(page.getByTestId("away-item").filter({ hasText: "Cordless Drill" })).toBeVisible();

  // 5. Open Activity via the bell → a "lent" entry is present.
  await page.goto("/app/activity");
  await expect(page.getByTestId("activity-row").filter({ hasText: /marked .* lent/i })).toBeVisible();
});
```
(Item name "Cordless Drill" is illustrative — use whatever the add step created. Prefer driving the UI for the add/lend steps so the activity write happens through the real call sites wired in Tasks 9/11; only seed via emulator if the P1 add flow is not yet test-stable.)

- [ ] **Step 3: Run the smoke suite**

Run: `npm run test:smoke`
Expected: PASS — the new lending spec plus existing smoke specs (the command boots Auth/Firestore/Storage emulators).

- [ ] **Step 4: Commit**

```bash
git add tests/smoke/app-lending.spec.ts
git commit -m "test(mobile): e2e mark item lent -> away strip + activity feed

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Full verification

- [ ] **Step 1: Unit suite**

Run: `npm test`
Expected: PASS, including `normalizeItemStatus.test.ts`, `activity.test.ts`, `activitySelectors.test.ts`, and the extended `useMobileNavigation.test.ts`.

- [ ] **Step 2: Rules**

Run: `npm run test:rules`
Expected: PASS, including the two new `activity` tests.

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 4: Smoke (e2e)**

Run: `npm run test:smoke`
Expected: PASS, including `app-lending.spec.ts`.

- [ ] **Step 5: Manual smoke checklist** (`npm run dev`, open `/app`)
  - Bell on Home → `/app/activity`; feed renders (empty state when fresh).
  - Add an item → Activity shows "{you} added {item} to {Space} › {Area}"; tapping the row opens the item.
  - Move the item → Activity shows "{you} moved {item} to {dest}".
  - Delete an item → Activity shows "{you} deleted {item}".
  - Add a space → "{you} added the {Space} space"; delete a space → "{you} deleted the {Space} space".
  - Whole-shelf batch commit (P3) → one "{you} added N items to {dest}" entry.
  - Item detail: set status repair/lost/packed → reflected + `item_status_changed` entry; set lent (pick borrower, optional due/note) → "Lent to {name}", appears in Home Away strip; set back home → loan cleared, leaves Away strip.
  - Legacy `/spaces` and desktop `/next` still load unchanged.

- [ ] **Step 6: Final commit (if any manual fixups were needed)**

```bash
git add -A
git commit -m "chore(mobile): P4 activity + status/lending verified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (P4 plan vs roadmap + contract)

**Roadmap "P4 — Retention bets" tasks:**
- (1) Types + paths + rules + index → Task 1 (types + paths), Task 5 (rules + the explicit no-composite-index note: single-field `createdAt` is automatic; `firestore.indexes.json` untouched). ✓
- (2) Repo `logActivity`/`subscribeActivity` + wire call sites → Task 4 (repo) + Task 9 (all call sites: `item_added`, `items_added_batch`, `item_moved`, `item_deleted`, `space_added`, `space_deleted`) + Task 11 (`item_status_changed`). ✓
- (3) `ActivityScreen` (bell target at `/app/activity`) — chronological feed with actor, summary, relative time, deep-link → Task 10 (+ Task 7 nav helper, Task 8 `formatRelativeTime`). ✓
- (4) `setItemStatus`/loan repo + item-detail status control + lending sheet (borrower = member or free name, since/due/note) → Task 4 (repo) + Task 11 (UI). ✓
- (5) Home "Away from home" strip (`status !== "home"`) → Task 12 (+ Task 8 `selectAwayItems`). ✓
- (6) Status backfill migration → contract assigns the backfill **script** to P5; this plan's responsibility is that **readers default correctly** before backfill — Task 2 (`normalizeItemDoc` defaults `status` from `isPacked`) + `defaultItemStatus` test. Verified here. ✓

**Contract sections:**
- §3 (nav): `isActivityPath` pure helper + `goActivity` + bell → `${basePath}/activity`; `MobileRoute` shape unchanged; `StowMobileApp` renders `ActivityScreen` when the path matches → Task 7 + Task 10. ✓
- §4 (P4 domain): `ItemStatus`, `ItemLoan`, `ActivityType`, `ActivityEntry`, `Item.status`/`loan`, `isPacked` kept-but-deprecated → Task 1 (exact field order + signatures matched). ✓
- §4.1 (normalization): `normalizeItemDoc` defaults missing `status` to `isPacked ? "packed" : "home"`; new `createItem` writes `status: "home"` → Task 2 + Task 3. No `orderBy("position")`/index churn introduced. ✓
- §5.3 (repo): `logActivity`, `subscribeActivity`, `setItemStatus`, `setItemLoan`, `clearItemLoan` with exact signatures; `updateItem` patch `Pick` extended with `status` + `loan?: ItemLoan | null`; `clearItemLoan` clears via `deleteField()` (contract-equivalent to `loan: null`); `paths.activity`/`activityDoc` added → Task 1, 3, 4. ✓
- §6.3 (hook): `activity` subscription effect (mirrors `packingLists`), `activity` in return, `"activity"` error source in type + `emptyErrors()` + precedence order, actions `logActivity`/`setItemStatus`/`setItemLoan`/`clearItemLoan` in type + memo → Task 6. ✓
- §10 (UI + rules): `ActivityScreen` (Task 10), Away strip in `HomeScreen` (Task 12), `ItemDetail` status + lending (Task 11), `logActivity` write hooks (Task 9 + 11), `firestore.rules` activity block + rules test (member create; cannot update/delete) (Task 5). ✓

**Depth/format compliance:** FULL code given for domain types, `paths.activity`, repo `logActivity`/`subscribeActivity`/`setItemStatus`/`setItemLoan`/`clearItemLoan` + `buildActivityEntry`, `normalizeItemDoc`/`defaultItemStatus` change, `updateItem` patch extension, the `useWorkspaceData` subscription/actions/error-source, the `firestore.rules` block, the rules test, `isActivityPath`, `selectAwayItems`, and `formatRelativeTime` (each with tests). UI markup (ActivityScreen, LendingSheet, AwayStrip, ItemDetail status control) given as prop interface + bindings + section structure + non-obvious code + a named prototype port instruction (translate per §1.3). No placeholders; every commit carries the required trailer. Tests are pure/node (entry shaping, selectors, relative-time, status default) + rules via `npm run test:rules`; UI via manual + Playwright (mark lent → away strip + activity). ✓

**Known risks / deviations:**
- **`clearItemLoan` uses `deleteField()`** rather than literally writing `loan: null`. The contract permits this ("use `loan: null` … normalizeItemDoc treats null/absent as undefined"); `deleteField()` is the cleaner equivalent and both render identically. Noted inline in Task 4.
- **`actorName` resolution** depends on `members` carrying `displayName`/`email`; falls back to "Someone". If a member doc lacks both, the summary degrades gracefully (still valid copy).
- **`item_moved` on delete-with-reassignment** is intentionally **not** emitted per reassigned item (only `space_deleted`/area-delete) to avoid feed spam; if per-item move records are later wanted, add them at the reassignment loop. Noted in Task 9.
- **Task 9/11/12 touch P1–P3 files not on disk in this branch snapshot.** They are described as Modify steps keyed to the action each call site already invokes (per the task context: P0–P3 assumed complete). If a referenced file/path differs at implementation time, locate the call site by its existing `actions.<name>` usage and apply the same `logActivity` follow-up.
- **`firestore.indexes.json` is deliberately not modified** — the only new query is `activity orderBy(createdAt desc) limit(n)`, served by the automatic single-field index.
