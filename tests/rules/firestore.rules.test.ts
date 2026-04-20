import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { DEFAULT_FIREBASE_PROJECT_ID } from "../../src/lib/firebase/emulatorQa";

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
const HOUSEHOLD_ID = "household-1";
const SECOND_HOUSEHOLD_ID = "household-2";

let testEnv: RulesTestEnvironment;

async function seedMember(
  uid: string,
  role: "OWNER" | "ADMIN" | "MEMBER" = "MEMBER",
  householdId = HOUSEHOLD_ID
) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `households/${householdId}`), {
      name: "Rules Test Household",
      createdBy: "owner-1"
    });
    await setDoc(doc(db, `households/${householdId}/members/${uid}`), {
      role,
      createdBy: "owner-1"
    });
  });
}

describe("firestore rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8")
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows a member to create a space and an item", async () => {
    await seedMember("member-1", "MEMBER");
    const db = testEnv.authenticatedContext("member-1").firestore();

    await assertSucceeds(
      setDoc(doc(db, `households/${HOUSEHOLD_ID}/spaces/space-1`), {
        householdId: HOUSEHOLD_ID,
        name: "Garage",
        icon: "box",
        color: "#4E7BFF"
      })
    );

    await assertSucceeds(
      setDoc(doc(db, `households/${HOUSEHOLD_ID}/spaces/space-1/areas/area-1`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        name: "Shelf"
      })
    );

    await assertSucceeds(
      setDoc(doc(db, `households/${HOUSEHOLD_ID}/items/item-1`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        areaId: "area-1",
        areaNameSnapshot: "Shelf",
        name: "Passport Folder",
        kind: "folder"
      })
    );
  });

  it("blocks item writes with missing or mismatched parents", async () => {
    await seedMember("member-1", "MEMBER");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/spaces/space-1`), {
        householdId: HOUSEHOLD_ID,
        name: "Garage",
        icon: "box",
        color: "#4E7BFF"
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/spaces/space-2`), {
        householdId: HOUSEHOLD_ID,
        name: "Office",
        icon: "folder",
        color: "#5C6AC4"
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/spaces/space-1/areas/area-1`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        name: "Shelf"
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/items/item-1`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        areaId: "area-1",
        areaNameSnapshot: "Shelf",
        name: "Passport Folder",
        kind: "folder"
      });
    });

    const db = testEnv.authenticatedContext("member-1").firestore();

    await assertFails(
      setDoc(doc(db, `households/${HOUSEHOLD_ID}/items/item-missing-area`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        areaId: "area-9",
        areaNameSnapshot: "Missing",
        name: "Ghost Item",
        kind: "item"
      })
    );

    await assertFails(
      updateDoc(doc(db, `households/${HOUSEHOLD_ID}/items/item-1`), {
        spaceId: "space-2",
        areaId: "area-1"
      })
    );
  });

  it("blocks item and area writes while a delete lock is active, and blocks direct client deletes", async () => {
    await seedMember("owner-1", "OWNER");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/spaces/space-1`), {
        householdId: HOUSEHOLD_ID,
        name: "Garage",
        icon: "box",
        color: "#4E7BFF",
        deletingAt: new Date()
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/spaces/space-1/areas/area-1`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        name: "Shelf"
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/spaces/space-2`), {
        householdId: HOUSEHOLD_ID,
        name: "Office",
        icon: "folder",
        color: "#5C6AC4"
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/spaces/space-2/areas/area-2`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-2",
        name: "Desk"
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/items/item-1`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-2",
        areaId: "area-2",
        areaNameSnapshot: "Desk",
        name: "Camera",
        kind: "item"
      });
    });

    const db = testEnv.authenticatedContext("owner-1").firestore();

    await assertFails(
      setDoc(doc(db, `households/${HOUSEHOLD_ID}/spaces/space-1/areas/area-new`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        name: "Locked"
      })
    );

    await assertFails(
      updateDoc(doc(db, `households/${HOUSEHOLD_ID}/items/item-1`), {
        spaceId: "space-1",
        areaId: "area-1",
        areaNameSnapshot: "Shelf"
      })
    );

    await assertFails(deleteDoc(doc(db, `households/${HOUSEHOLD_ID}/spaces/space-1`)));
    await assertFails(deleteDoc(doc(db, `households/${HOUSEHOLD_ID}/spaces/space-2/areas/area-2`)));
    await assertFails(deleteDoc(doc(db, `households/${HOUSEHOLD_ID}/items/item-1`)));
  });

  it("blocks a non-member from reading a household", async () => {
    await seedMember("owner-1", "OWNER");
    const db = testEnv.authenticatedContext("intruder-1").firestore();
    await assertFails(getDoc(doc(db, `households/${HOUSEHOLD_ID}`)));
  });

  it("blocks direct client invite writes for admins and members", async () => {
    await seedMember("admin-1", "ADMIN");
    await seedMember("member-1", "MEMBER");

    const adminDb = testEnv.authenticatedContext("admin-1").firestore();
    const memberDb = testEnv.authenticatedContext("member-1").firestore();

    const invitePayload = {
      role: "MEMBER",
      token: "plain-text-token",
      tokenHash: "hashed-token",
      createdBy: "admin-1"
    };

    await assertFails(setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/invites/invite-1`), invitePayload));
    await assertFails(setDoc(doc(memberDb, `households/${HOUSEHOLD_ID}/invites/invite-2`), invitePayload));
  });

  it("blocks direct client bootstrap creation of a household, owner membership, and user pointer", async () => {
    const db = testEnv.authenticatedContext("bootstrap-owner").firestore();
    const batch = writeBatch(db);

    batch.set(doc(db, "households/bootstrap-household"), {
      name: "Bootstrap Household",
      createdBy: "bootstrap-owner"
    });
    batch.set(doc(db, "households/bootstrap-household/members/bootstrap-owner"), {
      role: "OWNER",
      createdBy: "bootstrap-owner"
    });
    batch.set(doc(db, "users/bootstrap-owner"), {
      currentHouseholdId: "bootstrap-household"
    });

    await assertFails(batch.commit());
  });

  it("blocks direct client writes to the caller's user document", async () => {
    const db = testEnv.authenticatedContext("user-1").firestore();

    await assertFails(
      setDoc(doc(db, "users/user-1"), {
        currentHouseholdId: "household-1"
      })
    );
  });

  it("blocks member writes to household settings", async () => {
    await seedMember("member-2", "MEMBER");
    const db = testEnv.authenticatedContext("member-2").firestore();

    await assertFails(
      setDoc(doc(db, `households/${HOUSEHOLD_ID}/settings/llm`), {
        enabled: true
      })
    );
  });

  it("blocks member reads and direct admin writes to llmSecret", async () => {
    await seedMember("owner-1", "OWNER");
    await seedMember("member-2", "MEMBER");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `households/${HOUSEHOLD_ID}/settings/llmSecret`), {
        ciphertext: "secret"
      });
    });

    const ownerDb = testEnv.authenticatedContext("owner-1").firestore();
    const memberDb = testEnv.authenticatedContext("member-2").firestore();

    await assertFails(getDoc(doc(memberDb, `households/${HOUSEHOLD_ID}/settings/llmSecret`)));
    await assertFails(
      setDoc(doc(ownerDb, `households/${HOUSEHOLD_ID}/settings/llmSecret`), {
        ciphertext: "new-secret"
      })
    );
  });

  it("blocks collection-group area writes outside the caller household path", async () => {
    await seedMember("member-1", "MEMBER", HOUSEHOLD_ID);
    await seedMember("owner-2", "OWNER", SECOND_HOUSEHOLD_ID);
    const db = testEnv.authenticatedContext("member-1").firestore();

    await assertFails(
      setDoc(doc(db, `households/${SECOND_HOUSEHOLD_ID}/spaces/space-2/areas/area-1`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-2",
        name: "Cross-household write"
      })
    );
  });

  it("blocks direct client membership updates and deletes", async () => {
    await seedMember("owner-1", "OWNER");
    await seedMember("member-1", "MEMBER");
    const db = testEnv.authenticatedContext("owner-1").firestore();

    await assertFails(
      updateDoc(doc(db, `households/${HOUSEHOLD_ID}/members/member-1`), {
        role: "ADMIN"
      })
    );

    await assertFails(deleteDoc(doc(db, `households/${HOUSEHOLD_ID}/members/member-1`)));
  });

  it("blocks direct client packing-list writes, including stale deleted item ids", async () => {
    await seedMember("member-packing", "MEMBER");
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const adminDb = context.firestore();
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/packingLists/list-1`), {
        householdId: HOUSEHOLD_ID,
        name: "Weekend Trip",
        itemIds: [],
        packedItemIds: [],
        createdBy: "member-packing",
        updatedBy: "member-packing"
      });
      await setDoc(doc(adminDb, `households/${HOUSEHOLD_ID}/items/item-deleted`), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        areaId: "area-1",
        areaNameSnapshot: "Shelf",
        name: "Deleted Camera",
        kind: "item",
        deletedAt: new Date()
      });
    });

    const db = testEnv.authenticatedContext("member-packing").firestore();
    const existingListRef = doc(db, `households/${HOUSEHOLD_ID}/packingLists/list-1`);

    await assertFails(
      setDoc(doc(db, `households/${HOUSEHOLD_ID}/packingLists/list-2`), {
        householdId: HOUSEHOLD_ID,
        name: "Carry On",
        itemIds: ["item-deleted"],
        packedItemIds: ["item-deleted"],
        createdBy: "member-packing",
        updatedBy: "member-packing"
      })
    );

    await assertFails(
      updateDoc(existingListRef, {
        itemIds: ["item-deleted"],
        packedItemIds: ["item-deleted"]
      })
    );

    await assertFails(deleteDoc(existingListRef));
  });

  it("blocks direct member writes to visionJobs", async () => {
    await seedMember("member-vision", "MEMBER");
    const db = testEnv.authenticatedContext("member-vision").firestore();
    const visionJobRef = doc(db, `households/${HOUSEHOLD_ID}/visionJobs/job-1`);

    await assertFails(
      setDoc(visionJobRef, {
        providerType: "openai_compatible",
        model: "gpt-4.1-mini"
      })
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), `households/${HOUSEHOLD_ID}/visionJobs/job-1`), {
        providerType: "openai_compatible",
        model: "gpt-4.1-mini"
      });
    });

    await assertFails(deleteDoc(visionJobRef));
  });
});
