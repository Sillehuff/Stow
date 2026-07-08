import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore
} from "firebase/firestore";

// Same harness/runner as firestore.rules.test.ts. These tests reproduce concurrency
// RACES (not security rules), so every client runs with security rules disabled: two
// disabled contexts give us two independent "clients" whose writes can interleave the
// same way two devices would in production, without rules getting in the way of the
// interleaving we are trying to observe.

const PROJECT_ID = "stow-races-test";

let testEnv: RulesTestEnvironment;

/** A fresh household id per test so tests never share state (mirrors rules-test isolation). */
function freshHouseholdId(label: string): string {
  return `household-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Mirror of repository.reorderSpaces' write shape: set+merge position-only writes.
 * Using the real shape is load-bearing for Invariant B — set+merge is exactly what
 * re-creates a position-only stub for a doc a concurrent client just deleted.
 */
async function reorderSpaces(db: Firestore, householdId: string, orderedIds: string[]): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, position) => {
    batch.set(
      doc(db, "households", householdId, "spaces", id),
      { position, updatedAt: serverTimestamp() },
      { merge: true }
    );
  });
  await batch.commit();
}

/** Mirror of repository.reorderAreas' write shape (set+merge under a space). */
async function reorderAreas(
  db: Firestore,
  householdId: string,
  spaceId: string,
  orderedIds: string[]
): Promise<void> {
  const batch = writeBatch(db);
  orderedIds.forEach((id, position) => {
    batch.set(
      doc(db, "households", householdId, "spaces", spaceId, "areas", id),
      { position, updatedAt: serverTimestamp() },
      { merge: true }
    );
  });
  await batch.commit();
}

/**
 * Mirror of repository.deleteItem's real write set: find every packing list that
 * references the item (via array-contains on itemIds/packedItemIds), arrayRemove the
 * id from both arrays, then delete the item doc — all in one batch.
 */
async function deleteItem(db: Firestore, householdId: string, itemId: string, userId: string): Promise<void> {
  const packingListsRef = collection(db, "households", householdId, "packingLists");
  const [itemListsSnap, packedListsSnap] = await Promise.all([
    getDocs(query(packingListsRef, where("itemIds", "array-contains", itemId))),
    getDocs(query(packingListsRef, where("packedItemIds", "array-contains", itemId)))
  ]);

  const batch = writeBatch(db);
  const touchedListIds = new Set<string>();
  for (const listDoc of [...itemListsSnap.docs, ...packedListsSnap.docs]) {
    if (touchedListIds.has(listDoc.id)) continue;
    touchedListIds.add(listDoc.id);
    batch.update(listDoc.ref, {
      itemIds: arrayRemove(itemId),
      packedItemIds: arrayRemove(itemId),
      updatedAt: serverTimestamp(),
      updatedBy: userId
    });
  }
  batch.delete(doc(db, "households", householdId, "items", itemId));
  await batch.commit();
}

/**
 * Mirror of repository.togglePackingListItem (packed=true branch): blind arrayUnion of
 * the item id into the list's packedItemIds. It does NOT verify the item still exists —
 * that unconditional union is exactly what can resurrect a dangling id (Invariant C).
 */
async function togglePackingListItemOn(
  db: Firestore,
  householdId: string,
  listId: string,
  itemId: string,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, "households", householdId, "packingLists", listId), {
    packedItemIds: arrayUnion(itemId),
    updatedAt: serverTimestamp(),
    updatedBy: userId
  });
}

/**
 * App-level filter, copied verbatim from PackingScreen.packingProgress. Invariant C's
 * safety net lives here: any id that does not resolve to a live item is dropped from
 * both the total and the done count. (Duplicated rather than imported so this test
 * never depends on the concurrently-edited src/features/stow/ui tree.)
 */
function packingProgress(
  list: { itemIds: string[]; packedItemIds: string[] },
  existingItemIds: Set<string>
): { done: number; total: number; pct: number } {
  const ids = list.itemIds.filter((id) => existingItemIds.has(id));
  const packed = new Set(list.packedItemIds);
  const done = ids.filter((id) => packed.has(id)).length;
  const total = ids.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

describe("firestore concurrency races", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  // -- Invariant A: concurrent bootstrap has exactly one winner --
  it("A: two clients racing the bootstrap transaction leave exactly one household", async () => {
    const uid = "race-user-A";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;

      // Each client proposes its OWN candidate household id, mirroring ensureBootstrap:
      // read the user doc inside a transaction; if currentHouseholdId is already set,
      // yield to the winner; otherwise create household + member + user profile.
      async function bootstrap(candidateHouseholdId: string): Promise<string> {
        const userRef = doc(db, "users", uid);
        return runTransaction(db, async (tx) => {
          const fresh = await tx.get(userRef);
          const current = fresh.exists()
            ? (fresh.data().currentHouseholdId as string | undefined)
            : undefined;
          if (current) return current; // another client already won the race

          tx.set(doc(db, "households", candidateHouseholdId), {
            name: "Race Household",
            createdAt: serverTimestamp(),
            createdBy: uid
          });
          tx.set(doc(db, "households", candidateHouseholdId, "members", uid), {
            uid,
            role: "OWNER",
            createdAt: serverTimestamp(),
            createdBy: uid
          });
          tx.set(
            userRef,
            {
              currentHouseholdId: candidateHouseholdId,
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
          return candidateHouseholdId;
        });
      }

      const candidate1 = freshHouseholdId("A1");
      const candidate2 = freshHouseholdId("A2");

      const [winner1, winner2] = await Promise.all([bootstrap(candidate1), bootstrap(candidate2)]);

      // Both transactions must agree on the same winning household id (the emulator's
      // real optimistic-concurrency retry forces the loser to re-read and yield).
      expect(winner1).toBe(winner2);
      const winner = winner1;
      expect([candidate1, candidate2]).toContain(winner);
      const loser = winner === candidate1 ? candidate2 : candidate1;

      // The user doc points at the winner.
      const userSnap = await getDoc(doc(db, "users", uid));
      expect(userSnap.exists()).toBe(true);
      expect(userSnap.data()?.currentHouseholdId).toBe(winner);

      // Exactly one household exists for this user: the winner's exists, the loser's
      // was never created (the losing transaction aborted before writing).
      const winnerSnap = await getDoc(doc(db, "households", winner));
      const loserSnap = await getDoc(doc(db, "households", loser));
      expect(winnerSnap.exists()).toBe(true);
      expect(loserSnap.exists()).toBe(false);

      // And exactly one owner-member doc under the winner household.
      const membersSnap = await getDocs(collection(db, "households", winner, "members"));
      expect(membersSnap.size).toBe(1);
      expect(membersSnap.docs[0].id).toBe(uid);
    });
  });

  // -- Invariant B: reorder-vs-delete leaves no name-bearing resurrection --
  it("B (spaces): reordering while another client deletes a space never resurrects it with a name", async () => {
    const householdId = freshHouseholdId("Bspaces");
    const spaceIds = ["space-1", "space-2", "space-3"];

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      for (let i = 0; i < spaceIds.length; i++) {
        await setDoc(doc(db, "households", householdId, "spaces", spaceIds[i]), {
          householdId,
          name: `Space ${i + 1}`,
          icon: "box",
          color: "#222",
          position: i,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    // Two independent clients. Client 1 reorders all three spaces (set+merge positions);
    // client 2 concurrently deletes space-2. Firing them together lets the emulator
    // serialize the two batches in whichever order it picks -- the invariant must hold
    // for both orders.
    await Promise.all([
      testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore() as unknown as Firestore;
        await reorderSpaces(db, householdId, ["space-3", "space-2", "space-1"]);
      }),
      testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore() as unknown as Firestore;
        await deleteDoc(doc(db, "households", householdId, "spaces", "space-2"));
      })
    ]);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const snap = await getDoc(doc(db, "households", householdId, "spaces", "space-2"));
      // App-level invariant: space-2 is EITHER gone (delete landed last) OR present only
      // as a position-only stub with NO name (reorder's set+merge re-created it). It must
      // never come back bearing a name -- that would be a true resurrection.
      if (snap.exists()) {
        const data = snap.data();
        expect(typeof data.name === "string").toBe(false); // mapNamedSnapshot's drop predicate
        expect(data.name).toBeUndefined();
        expect(typeof data.position).toBe("number");
      }
      // Survivors keep their names (no collateral damage).
      const s1 = await getDoc(doc(db, "households", householdId, "spaces", "space-1"));
      const s3 = await getDoc(doc(db, "households", householdId, "spaces", "space-3"));
      expect(s1.data()?.name).toBe("Space 1");
      expect(s3.data()?.name).toBe("Space 3");
    });
  });

  it("B (areas): reordering while another client deletes an area never resurrects it with a name", async () => {
    const householdId = freshHouseholdId("Bareas");
    const spaceId = "space-1";
    const areaIds = ["area-1", "area-2", "area-3"];

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "households", householdId, "spaces", spaceId), {
        householdId,
        name: "Space 1",
        icon: "box",
        color: "#222",
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      for (let i = 0; i < areaIds.length; i++) {
        await setDoc(doc(db, "households", householdId, "spaces", spaceId, "areas", areaIds[i]), {
          householdId,
          spaceId,
          name: `Area ${i + 1}`,
          position: i,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    });

    await Promise.all([
      testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore() as unknown as Firestore;
        await reorderAreas(db, householdId, spaceId, ["area-3", "area-2", "area-1"]);
      }),
      testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore() as unknown as Firestore;
        await deleteDoc(doc(db, "households", householdId, "spaces", spaceId, "areas", "area-2"));
      })
    ]);

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const snap = await getDoc(doc(db, "households", householdId, "spaces", spaceId, "areas", "area-2"));
      if (snap.exists()) {
        const data = snap.data();
        expect(typeof data.name === "string").toBe(false);
        expect(data.name).toBeUndefined();
        expect(typeof data.position).toBe("number");
      }
      const a1 = await getDoc(doc(db, "households", householdId, "spaces", spaceId, "areas", "area-1"));
      const a3 = await getDoc(doc(db, "households", householdId, "spaces", spaceId, "areas", "area-3"));
      expect(a1.data()?.name).toBe("Area 1");
      expect(a3.data()?.name).toBe("Area 3");
    });
  });

  // -- Invariant C: packing-toggle vs item-delete --
  // Interleaving 1 (toggle THEN delete): deleteItem's array-contains query runs after
  // the toggle has committed, so it finds and cleans the list. No dangling id survives.
  it("C1: toggle-then-delete -- deleteItem cleans the id it can see", async () => {
    const householdId = freshHouseholdId("C1");
    const itemId = "item-1";
    const listId = "list-1";
    const userId = "race-user-C1";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "households", householdId, "items", itemId), {
        householdId,
        name: "Camera",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await setDoc(doc(db, "households", householdId, "packingLists", listId), {
        householdId,
        name: "Trip",
        itemIds: [itemId],
        packedItemIds: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    // Serialize: toggle commits first, THEN delete runs its query + cleanup.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await togglePackingListItemOn(db, householdId, listId, itemId, userId);
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await deleteItem(db, householdId, itemId, userId);
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const listSnap = await getDoc(doc(db, "households", householdId, "packingLists", listId));
      const data = listSnap.data() as { itemIds: string[]; packedItemIds: string[] };
      // Storage-level invariant holds here: deleteItem saw the id (in itemIds) and
      // removed it from BOTH arrays, so no dangling id remains.
      expect(data.itemIds).not.toContain(itemId);
      expect(data.packedItemIds).not.toContain(itemId);
    });
  });

  // Interleaving 2 (delete THEN toggle): deleteItem's cleanup runs and commits first,
  // then the toggle's blind arrayUnion re-adds the id AFTER the item is gone. The
  // repository's cleanup provably cannot prevent this -- arrayUnion is unconditional and
  // there is no item doc left to gate it. So the ACHIEVABLE invariant is app-level:
  // packingProgress filters the dangling id out. This test documents that limitation and
  // asserts the app-level safety net rather than a storage-level guarantee.
  it("C2: delete-then-toggle can leave a dangling id, but the app-level filter ignores it", async () => {
    const householdId = freshHouseholdId("C2");
    const itemId = "item-1";
    const survivorId = "item-2";
    const listId = "list-1";
    const userId = "race-user-C2";

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await setDoc(doc(db, "households", householdId, "items", itemId), {
        householdId,
        name: "Camera",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await setDoc(doc(db, "households", householdId, "items", survivorId), {
        householdId,
        name: "Charger",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      await setDoc(doc(db, "households", householdId, "packingLists", listId), {
        householdId,
        name: "Trip",
        itemIds: [itemId, survivorId],
        packedItemIds: [survivorId],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    // Serialize the adversarial order: delete fully commits, THEN the toggle re-adds.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await deleteItem(db, householdId, itemId, userId);
    });
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      await togglePackingListItemOn(db, householdId, listId, itemId, userId);
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore() as unknown as Firestore;
      const listSnap = await getDoc(doc(db, "households", householdId, "packingLists", listId));
      const data = listSnap.data() as { itemIds: string[]; packedItemIds: string[] };

      // Storage reality: the dangling id IS present in packedItemIds (the toggle's blind
      // arrayUnion landed after the item was deleted and cleaned). deleteItem removed it
      // from itemIds, but nothing can stop the later union. Document the limitation.
      expect(data.itemIds).not.toContain(itemId); // deleteItem did remove it from itemIds
      expect(data.packedItemIds).toContain(itemId); // ...but the later toggle resurrected it here

      // The item doc is gone.
      const itemSnap = await getDoc(doc(db, "households", householdId, "items", itemId));
      expect(itemSnap.exists()).toBe(false);

      // App-level invariant that DOES hold: packingProgress ignores any id not backed by
      // a live item. The live item set is {survivorId}; the dangling itemId is dropped
      // from both counts, so progress reflects only the survivor.
      const liveItemIds = new Set([survivorId]);
      const progress = packingProgress(data, liveItemIds);
      expect(progress.total).toBe(1); // only the survivor counts toward the total
      expect(progress.done).toBe(1); // survivor is packed
      expect(progress.pct).toBe(100);
    });
  });
});
