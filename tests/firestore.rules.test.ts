import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";

const PROJECT_ID = "stow-rules-test";
const HOUSEHOLD_ID = "household-1";

let testEnv: RulesTestEnvironment;

async function seedHousehold() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "households", HOUSEHOLD_ID), {
      name: "Stow Test Household",
      createdBy: "owner-1"
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "members", "owner-1"), {
      uid: "owner-1",
      role: "OWNER",
      createdBy: "owner-1"
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "members", "admin-1"), {
      uid: "admin-1",
      role: "ADMIN",
      createdBy: "owner-1"
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "members", "member-1"), {
      uid: "member-1",
      role: "MEMBER",
      createdBy: "owner-1"
    });
    await setDoc(doc(db, "users", "member-1"), {
      currentHouseholdId: HOUSEHOLD_ID
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "spaces", "space-1"), {
      householdId: HOUSEHOLD_ID,
      name: "Closet",
      icon: "box",
      color: "#222",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "spaces", "space-1", "areas", "area-1"), {
      householdId: HOUSEHOLD_ID,
      spaceId: "space-1",
      name: "Shelf",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "items", "item-1"), {
      householdId: HOUSEHOLD_ID,
      spaceId: "space-1",
      areaId: "area-1",
      areaNameSnapshot: "Shelf",
      name: "Camera",
      kind: "item",
      tags: [],
      notes: "",
      isPacked: false,
      photoStatus: "attached",
      entryMode: "manual",
      createdBy: "owner-1",
      updatedBy: "owner-1",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "itemDrafts", "draft-1"), {
      householdId: HOUSEHOLD_ID,
      spaceId: "space-1",
      areaId: "area-1",
      areaNameSnapshot: "Shelf",
      image: { storagePath: "households/household-1/drafts/draft-1/images/camera.png" },
      name: "",
      kind: "item",
      tags: [],
      notes: "",
      createdBy: "owner-1",
      updatedBy: "owner-1",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "packingLists", "list-1"), {
      householdId: HOUSEHOLD_ID,
      name: "Weekend Trip",
      itemIds: ["item-1"],
      packedItemIds: [],
      createdBy: "owner-1",
      updatedBy: "owner-1",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "settings", "llm"), {
      enabled: false,
      providerType: "openai_compatible",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      promptProfile: "default_inventory",
      temperature: 0.2,
      maxTokens: 400
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "settings", "llmSecret"), {
      ciphertext: "local:encrypted"
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "invites", "invite-1"), {
      role: "MEMBER",
      tokenHash: "abc123",
      createdBy: "owner-1",
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000)
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "activity", "activity-1"), {
      householdId: HOUSEHOLD_ID,
      type: "item_added",
      actorUid: "owner-1",
      actorName: "Owner One",
      summary: "Owner added Camera to Closet › Shelf",
      itemId: "item-1",
      createdAt: new Date()
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

  it("prevents members from reading llm secrets", async () => {
    await seedHousehold();
    const memberDb = testEnv.authenticatedContext("member-1").firestore();

    await assertFails(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "settings", "llmSecret")));
  });

  it("prevents admins from editing or removing owners directly", async () => {
    await seedHousehold();
    const adminDb = testEnv.authenticatedContext("admin-1").firestore();
    const ownerMemberDoc = doc(adminDb, "households", HOUSEHOLD_ID, "members", "owner-1");

    await assertFails(updateDoc(ownerMemberDoc, { role: "MEMBER" }));
    await assertFails(deleteDoc(ownerMemberDoc));
  });

  it("still allows bootstrap owner creation in a single client batch", async () => {
    const bootstrapDb = testEnv.authenticatedContext("bootstrap-user").firestore();
    const batch = writeBatch(bootstrapDb);

    batch.set(doc(bootstrapDb, "households", "bootstrap-household"), {
      name: "Bootstrap Household",
      createdBy: "bootstrap-user"
    });
    batch.set(doc(bootstrapDb, "households", "bootstrap-household", "members", "bootstrap-user"), {
      uid: "bootstrap-user",
      role: "OWNER",
      createdBy: "bootstrap-user"
    });

    await assertSucceeds(batch.commit());
  });

  it("allows the bootstrap transaction to seed spaces and areas in one batch", async () => {
    const bootstrapDb = testEnv.authenticatedContext("seed-user").firestore();
    const newHouseholdId = "seed-household";
    const batch = writeBatch(bootstrapDb);

    batch.set(doc(bootstrapDb, "households", newHouseholdId), {
      name: "Seed Household",
      createdBy: "seed-user"
    });
    batch.set(doc(bootstrapDb, "households", newHouseholdId, "members", "seed-user"), {
      uid: "seed-user",
      role: "OWNER",
      createdBy: "seed-user"
    });
    batch.set(doc(bootstrapDb, "households", newHouseholdId, "spaces", "space-1"), {
      householdId: newHouseholdId,
      name: "Living Room",
      icon: "home",
      color: "#E8652B",
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    batch.set(doc(bootstrapDb, "households", newHouseholdId, "spaces", "space-1", "areas", "area-1"), {
      householdId: newHouseholdId,
      spaceId: "space-1",
      name: "Console Drawer",
      position: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await assertSucceeds(batch.commit());
  });

  it("denies a non-member creating a space in an existing household", async () => {
    await seedHousehold();
    const outsiderDb = testEnv.authenticatedContext("outsider-1").firestore();

    await assertFails(
      setDoc(doc(outsiderDb, "households", HOUSEHOLD_ID, "spaces", "space-99"), {
        householdId: HOUSEHOLD_ID,
        name: "Trespasser",
        icon: "box",
        color: "#000",
        position: 99,
        createdAt: new Date(),
        updatedAt: new Date()
      })
    );
  });

  it("keeps normal member reads and writes limited to allowed inventory paths", async () => {
    await seedHousehold();
    const memberDb = testEnv.authenticatedContext("member-1").firestore();

    await assertSucceeds(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "spaces", "space-1")));
    await assertSucceeds(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "items", "item-1")));
    await assertSucceeds(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "itemDrafts", "draft-1")));
    await assertSucceeds(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "packingLists", "list-1")));
    await assertSucceeds(
      setDoc(doc(memberDb, "households", HOUSEHOLD_ID, "visionJobs", "job-1"), {
        createdBy: "member-1",
        providerType: "gemini",
        model: "gemini-2.5-flash",
        confidence: 0.7,
        createdAt: new Date()
      })
    );
    await assertSucceeds(setDoc(doc(memberDb, "users", "member-1"), { currentHouseholdId: HOUSEHOLD_ID }, { merge: true }));
    await assertSucceeds(
      setDoc(doc(memberDb, "households", HOUSEHOLD_ID, "items", "item-2"), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        areaId: "area-1",
        areaNameSnapshot: "Shelf",
        name: "Tripod",
        kind: "item",
        tags: [],
        notes: "",
        isPacked: false,
        photoStatus: "skipped",
        entryMode: "manual",
        createdBy: "member-1",
        updatedBy: "member-1",
        createdAt: new Date(),
        updatedAt: new Date()
      })
    );
    await assertSucceeds(
      setDoc(doc(memberDb, "households", HOUSEHOLD_ID, "itemDrafts", "draft-2"), {
        householdId: HOUSEHOLD_ID,
        spaceId: "space-1",
        areaId: "area-1",
        areaNameSnapshot: "Shelf",
        image: { storagePath: "households/household-1/drafts/draft-2/images/tripod.png" },
        name: "",
        kind: "item",
        tags: [],
        notes: "",
        createdBy: "member-1",
        updatedBy: "member-1",
        createdAt: new Date(),
        updatedAt: new Date()
      })
    );
    await assertSucceeds(updateDoc(doc(memberDb, "households", HOUSEHOLD_ID, "itemDrafts", "draft-2"), { name: "Tripod" }));
    await assertSucceeds(deleteDoc(doc(memberDb, "households", HOUSEHOLD_ID, "itemDrafts", "draft-2")));

    await assertFails(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "settings", "llm")));
    await assertFails(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "invites", "invite-1")));
  });

  it("lets members read and create activity but never update or delete it", async () => {
    await seedHousehold();
    const memberDb = testEnv.authenticatedContext("member-1").firestore();

    await assertSucceeds(getDoc(doc(memberDb, "households", HOUSEHOLD_ID, "activity", "activity-1")));
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

  it("allows admins to manage llm config but never exposes llm secrets", async () => {
    await seedHousehold();
    const adminDb = testEnv.authenticatedContext("admin-1").firestore();

    await assertSucceeds(getDoc(doc(adminDb, "households", HOUSEHOLD_ID, "settings", "llm")));
    await assertSucceeds(
      setDoc(
        doc(adminDb, "households", HOUSEHOLD_ID, "settings", "llm"),
        {
          enabled: true,
          providerType: "gemini",
          model: "gemini-2.5-flash",
          promptProfile: "default_inventory",
          temperature: 0.2,
          maxTokens: 400
        },
        { merge: true }
      )
    );
    await assertFails(getDoc(doc(adminDb, "households", HOUSEHOLD_ID, "settings", "llmSecret")));
    await assertFails(
      setDoc(doc(adminDb, "households", HOUSEHOLD_ID, "settings", "llmSecret"), { ciphertext: "local:new" })
    );
  });
});
