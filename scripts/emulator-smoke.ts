import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { deleteApp, initializeApp as initializeClientApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signInWithEmailAndPassword,
  type Auth
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
  httpsCallable,
  type Functions
} from "firebase/functions";
import {
  DEFAULT_FIREBASE_PROJECT_ID,
  EMULATOR_QA_HOUSEHOLD_ID,
  EMULATOR_QA_PASSWORD,
  EMULATOR_QA_USERS
} from "../src/lib/firebase/emulatorQa";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
const functionsRegion = process.env.FUNCTIONS_REGION || "us-central1";
const authEmulatorUrl = "http://127.0.0.1:9099";

const app = getApps()[0] ?? initializeApp({ projectId });
const db = getFirestore(app);

type Client = {
  app: FirebaseApp;
  auth: Auth;
  functions: Functions;
};

function createClient(label: string): Client {
  const app = initializeClientApp(
    {
      apiKey: "stow-emulator",
      appId: `stow-emulator-${label}`,
      authDomain: "127.0.0.1",
      projectId
    },
    `stow-emulator-${label}-${Date.now()}`
  );
  const auth = initializeAuth(app, {
    persistence: inMemoryPersistence
  });
  connectAuthEmulator(auth, authEmulatorUrl, { disableWarnings: true });
  const functions = getFunctions(app, functionsRegion);
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  return { app, auth, functions };
}

async function destroyClient(client: Client) {
  await deleteApp(client.app);
}

async function callFunction<TOutput>(client: Client, name: string, data: Record<string, unknown>) {
  const callable = httpsCallable<Record<string, unknown>, TOutput>(client.functions, name);
  const result = await callable(data);
  return result.data;
}

async function expectCallableError(action: () => Promise<unknown>, expectedCode: string, context: string) {
  try {
    await action();
    assert.fail(`${context} should fail with ${expectedCode}`);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    assert.equal(code, expectedCode, `${context} should fail with ${expectedCode}`);
  }
}

async function signIn(client: Client, email: string, password: string) {
  return signInWithEmailAndPassword(client.auth, email, password);
}

async function signUp(client: Client, email: string, password: string) {
  return createUserWithEmailAndPassword(client.auth, email, password);
}

function inviteTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function main() {
  const guestClient = createClient("guest");
  const memberClient = createClient("member");
  const adminClient = createClient("admin");
  const testerClient = createClient("tester");
  const bootstrapClient = createClient("bootstrap");
  const adminUser = EMULATOR_QA_USERS.find((user) => user.role === "ADMIN") ?? EMULATOR_QA_USERS[0];
  const memberUser = EMULATOR_QA_USERS.find((user) => user.role === "MEMBER") ?? EMULATOR_QA_USERS[0];

  const bootstrapEmail = `bootstrap-${Date.now()}@example.com`;
  const bootstrapSession = await signUp(bootstrapClient, bootstrapEmail, EMULATOR_QA_PASSWORD);
  const bootstrapResult = await callFunction<{ householdId: string }>(bootstrapClient, "bootstrapHousehold", {});
  assert.ok(bootstrapResult.householdId, "bootstrapHousehold should return a household id");

  const bootstrapHouseholdSnap = await db.doc(`households/${bootstrapResult.householdId}`).get();
  assert.equal(bootstrapHouseholdSnap.exists, true, "bootstrapHousehold should create a household");
  const bootstrapMemberSnap = await db.doc(`households/${bootstrapResult.householdId}/members/${bootstrapSession.user.uid}`).get();
  assert.equal(bootstrapMemberSnap.get("role"), "OWNER", "bootstrapHousehold should create an owner membership");

  const repeatedBootstrapResult = await callFunction<{ householdId: string }>(bootstrapClient, "bootstrapHousehold", {});
  assert.equal(
    repeatedBootstrapResult.householdId,
    bootstrapResult.householdId,
    "bootstrapHousehold should return the existing household on repeat calls"
  );

  await expectCallableError(
    () =>
      callFunction(guestClient, "createHouseholdInvite", {
        householdId: EMULATOR_QA_HOUSEHOLD_ID,
        role: "MEMBER",
        expiresInHours: 12
      }),
    "functions/unauthenticated",
    "Unauthenticated invite creation"
  );

  await signIn(memberClient, memberUser.email, EMULATOR_QA_PASSWORD);
  await expectCallableError(
    () =>
      callFunction(memberClient, "createHouseholdInvite", {
        householdId: EMULATOR_QA_HOUSEHOLD_ID,
        role: "MEMBER",
        expiresInHours: 12
      }),
    "functions/permission-denied",
    "Member invite creation"
  );
  await expectCallableError(
    () =>
      callFunction(memberClient, "revokeHouseholdInvite", {
        householdId: EMULATOR_QA_HOUSEHOLD_ID,
        inviteId: "missing-invite"
      }),
    "functions/permission-denied",
    "Member invite revoke"
  );

  await signIn(adminClient, adminUser.email, EMULATOR_QA_PASSWORD);

  const revokedInviteResult = await callFunction<{ inviteId: string; inviteUrl: string }>(
    adminClient,
    "createHouseholdInvite",
    {
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      role: "MEMBER",
      expiresInHours: 12
    }
  );

  assert.ok(revokedInviteResult.inviteId, "createHouseholdInvite should return an invite id");
  const revokedInviteToken = new URL(revokedInviteResult.inviteUrl).searchParams.get("token");
  assert.ok(revokedInviteToken, "createHouseholdInvite should return a usable invite token");

  await callFunction(adminClient, "revokeHouseholdInvite", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    inviteId: revokedInviteResult.inviteId
  });

  const revokedInviteTesterEmail = `revoked-invite-${Date.now()}@example.com`;
  await signUp(testerClient, revokedInviteTesterEmail, EMULATOR_QA_PASSWORD);
  await expectCallableError(
    () =>
      callFunction(testerClient, "acceptHouseholdInvite", {
        householdId: EMULATOR_QA_HOUSEHOLD_ID,
        token: revokedInviteToken
      }),
    "functions/not-found",
    "Revoked invite acceptance"
  );

  const replaceableInviteResult = await callFunction<{ inviteId: string; inviteUrl: string }>(
    adminClient,
    "createHouseholdInvite",
    {
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      role: "MEMBER",
      expiresInHours: 12
    }
  );
  const replacedInviteToken = new URL(replaceableInviteResult.inviteUrl).searchParams.get("token");
  assert.ok(replacedInviteToken, "Base invite should produce a usable token");

  const inviteResult = await callFunction<{ inviteId: string; inviteUrl: string }>(
    adminClient,
    "createHouseholdInvite",
    {
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      role: "MEMBER",
      expiresInHours: 12,
      replaceInviteId: replaceableInviteResult.inviteId
    }
  );
  const inviteToken = new URL(inviteResult.inviteUrl).searchParams.get("token");
  assert.ok(inviteToken, "Regenerated invite should return a usable invite token");

  await expectCallableError(
    () =>
      callFunction(testerClient, "acceptHouseholdInvite", {
        householdId: EMULATOR_QA_HOUSEHOLD_ID,
        token: replacedInviteToken
      }),
    "functions/not-found",
    "Replaced invite acceptance"
  );

  const testerEmail = `fresh-tester-${Date.now()}@example.com`;
  const testerSession = await signUp(testerClient, testerEmail, EMULATOR_QA_PASSWORD);

  await callFunction(
    testerClient,
    "acceptHouseholdInvite",
    {
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      token: inviteToken
    }
  );

  const memberSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/members/${testerSession.user.uid}`).get();
  assert.equal(memberSnap.get("role"), "MEMBER", "acceptHouseholdInvite should create a household membership");
  assert.equal(memberSnap.get("email"), testerEmail, "acceptHouseholdInvite should persist the tester email");

  const inviteSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/invites/${inviteResult.inviteId}`).get();
  assert.equal(inviteSnap.get("acceptedBy"), testerSession.user.uid, "acceptHouseholdInvite should mark who accepted the invite");
  assert.ok(inviteSnap.get("acceptedAt"), "acceptHouseholdInvite should timestamp invite acceptance");

  await expectCallableError(
    () =>
      callFunction(testerClient, "acceptHouseholdInvite", {
        householdId: EMULATOR_QA_HOUSEHOLD_ID,
        token: inviteToken
      }),
    "functions/already-exists",
    "Invite reuse"
  );

  const userSnap = await db.doc(`users/${testerSession.user.uid}`).get();
  assert.equal(
    userSnap.get("currentHouseholdId"),
    EMULATOR_QA_HOUSEHOLD_ID,
    "acceptHouseholdInvite should set the current household"
  );

  const secondHouseholdId = `qa-household-${Date.now()}`;
  const secondInviteToken = `second-household-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await db.doc(`households/${secondHouseholdId}`).set({
    name: "Second Household",
    createdBy: adminUser.uid
  });
  await db.doc(`households/${secondHouseholdId}/members/${adminUser.uid}`).set({
    role: "OWNER",
    createdBy: adminUser.uid
  });
  await db.doc(`households/${secondHouseholdId}/invites/member-invite`).set({
    role: "MEMBER",
    token: secondInviteToken,
    tokenHash: inviteTokenHash(secondInviteToken),
    createdAt: new Date(),
    createdBy: adminUser.uid,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60)
  });

  await expectCallableError(
    () =>
      callFunction(memberClient, "acceptHouseholdInvite", {
        householdId: secondHouseholdId,
        token: secondInviteToken
      }),
    "functions/failed-precondition",
    "Existing household member invite acceptance"
  );

  const existingMemberBootstrap = await callFunction<{ householdId: string }>(
    memberClient,
    "bootstrapHousehold",
    {}
  );
  assert.equal(
    existingMemberBootstrap.householdId,
    EMULATOR_QA_HOUSEHOLD_ID,
    "bootstrapHousehold should return the caller's existing household instead of creating a second one"
  );

  await callFunction(adminClient, "updateHouseholdMemberRole", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    uid: testerSession.user.uid,
    role: "ADMIN"
  });

  const promotedMemberSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/members/${testerSession.user.uid}`).get();
  assert.equal(promotedMemberSnap.get("role"), "ADMIN", "updateHouseholdMemberRole should persist the new role");

  await callFunction(adminClient, "removeHouseholdMember", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    uid: testerSession.user.uid
  });

  const removedMemberSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/members/${testerSession.user.uid}`).get();
  assert.equal(removedMemberSnap.exists, false, "removeHouseholdMember should delete the membership");

  const removedUserSnap = await db.doc(`users/${testerSession.user.uid}`).get();
  assert.equal(
    removedUserSnap.get("currentHouseholdId"),
    null,
    "removeHouseholdMember should clear the removed user's current household"
  );

  const ownerInviteToken = `owner-upgrade-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const invalidInviteRef = db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/invites/owner-upgrade`);
  await invalidInviteRef.set({
    role: "OWNER",
    token: ownerInviteToken,
    tokenHash: inviteTokenHash(ownerInviteToken),
    createdAt: new Date(),
    createdBy: adminUser.uid,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60)
  });

  const invalidInviteEmail = `invalid-invite-${Date.now()}@example.com`;
  await signUp(testerClient, invalidInviteEmail, EMULATOR_QA_PASSWORD);
  await expectCallableError(
    () =>
      callFunction(testerClient, "acceptHouseholdInvite", {
        householdId: EMULATOR_QA_HOUSEHOLD_ID,
        token: ownerInviteToken
      }),
    "functions/failed-precondition",
    "Invalid owner invite acceptance"
  );
  await invalidInviteRef.delete();

  const sourceSpaceId = `source-space-${Date.now()}`;
  const targetSpaceId = `target-space-${Date.now()}`;
  const areaDeleteSourceId = `source-area-${Date.now()}`;
  const targetAreaId = `target-area-${Date.now()}`;
  const sourceOverflowAreaId = `overflow-area-${Date.now()}`;
  const deletableItemId = `delete-item-${Date.now()}`;
  const areaDeleteItemId = `area-item-${Date.now()}`;
  const spaceDeleteItemId = `space-item-${Date.now()}`;
  const seedTimestamp = new Date();

  await Promise.all([
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${sourceSpaceId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      name: "Source Space",
      icon: "box",
      color: "#4E7BFF",
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp
    }),
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${targetSpaceId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      name: "Target Space",
      icon: "folder",
      color: "#5C6AC4",
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp
    })
  ]);

  await Promise.all([
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${sourceSpaceId}/areas/${areaDeleteSourceId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      spaceId: sourceSpaceId,
      name: "Source Area",
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp
    }),
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${sourceSpaceId}/areas/${sourceOverflowAreaId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      spaceId: sourceSpaceId,
      name: "Overflow Area",
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp
    }),
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${targetSpaceId}/areas/${targetAreaId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      spaceId: targetSpaceId,
      name: "Target Area",
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp
    })
  ]);

  await Promise.all([
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/items/${deletableItemId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      spaceId: targetSpaceId,
      areaId: targetAreaId,
      areaNameSnapshot: "Target Area",
      name: "Delete Me",
      kind: "item",
      tags: [],
      notes: "",
      isPacked: false,
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp,
      createdBy: adminUser.uid,
      updatedBy: adminUser.uid
    }),
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/items/${areaDeleteItemId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      spaceId: sourceSpaceId,
      areaId: areaDeleteSourceId,
      areaNameSnapshot: "Source Area",
      name: "Area Delete Item",
      kind: "item",
      tags: [],
      notes: "",
      isPacked: false,
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp,
      createdBy: adminUser.uid,
      updatedBy: adminUser.uid
    }),
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/items/${spaceDeleteItemId}`).set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      spaceId: sourceSpaceId,
      areaId: sourceOverflowAreaId,
      areaNameSnapshot: "Overflow Area",
      name: "Space Delete Item",
      kind: "item",
      tags: [],
      notes: "",
      isPacked: false,
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp,
      createdBy: adminUser.uid,
      updatedBy: adminUser.uid
    })
  ]);

  const [listARef, listBRef] = [
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/packingLists/list-a-${Date.now()}`),
    db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/packingLists/list-b-${Date.now()}`)
  ];

  await Promise.all([
    listARef.set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      name: "Trip A",
      itemIds: [deletableItemId],
      packedItemIds: [deletableItemId],
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp,
      createdBy: adminUser.uid,
      updatedBy: adminUser.uid
    }),
    listBRef.set({
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      name: "Trip B",
      itemIds: [deletableItemId, areaDeleteItemId],
      packedItemIds: [],
      createdAt: seedTimestamp,
      updatedAt: seedTimestamp,
      createdBy: adminUser.uid,
      updatedBy: adminUser.uid
    })
  ]);

  const packingListCreateResult = await callFunction<{ ok: boolean; listId: string }>(
    memberClient,
    "createHouseholdPackingList",
    {
      householdId: EMULATOR_QA_HOUSEHOLD_ID,
      name: "Callable Packing List",
      itemIds: [areaDeleteItemId, areaDeleteItemId, spaceDeleteItemId]
    }
  );
  assert.ok(packingListCreateResult.listId, "createHouseholdPackingList should return a list id");
  const callablePackingListRef = db.doc(
    `households/${EMULATOR_QA_HOUSEHOLD_ID}/packingLists/${packingListCreateResult.listId}`
  );
  const callablePackingListSnap = await callablePackingListRef.get();
  assert.deepEqual(
    callablePackingListSnap.get("itemIds"),
    [areaDeleteItemId, spaceDeleteItemId],
    "createHouseholdPackingList should de-duplicate item ids"
  );

  await callFunction(memberClient, "updateHouseholdPackingList", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    listId: packingListCreateResult.listId,
    packedItemIds: [areaDeleteItemId, "missing-item"]
  });
  const callablePackingListAfterUpdate = await callablePackingListRef.get();
  assert.deepEqual(
    callablePackingListAfterUpdate.get("packedItemIds"),
    [areaDeleteItemId],
    "updateHouseholdPackingList should trim packed ids to active list members"
  );

  await callFunction(memberClient, "toggleHouseholdPackingListItem", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    listId: packingListCreateResult.listId,
    itemId: spaceDeleteItemId,
    packed: true
  });
  const callablePackingListAfterToggle = await callablePackingListRef.get();
  assert.deepEqual(
    callablePackingListAfterToggle.get("packedItemIds"),
    [areaDeleteItemId, spaceDeleteItemId],
    "toggleHouseholdPackingListItem should update packed membership"
  );

  await callFunction(memberClient, "clearHouseholdPackingListPacked", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    listId: packingListCreateResult.listId
  });
  const callablePackingListAfterClear = await callablePackingListRef.get();
  assert.deepEqual(
    callablePackingListAfterClear.get("packedItemIds"),
    [],
    "clearHouseholdPackingListPacked should reset packed membership"
  );

  await callFunction(memberClient, "deleteHouseholdPackingList", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    listId: packingListCreateResult.listId
  });
  const deletedCallablePackingListSnap = await callablePackingListRef.get();
  assert.equal(deletedCallablePackingListSnap.exists, false, "deleteHouseholdPackingList should remove the list");

  await callFunction(memberClient, "deleteHouseholdItem", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    itemId: deletableItemId
  });

  const deletedItemSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/items/${deletableItemId}`).get();
  assert.equal(deletedItemSnap.exists, false, "deleteHouseholdItem should remove the item");
  const [listASnapAfterDelete, listBSnapAfterDelete] = await Promise.all([listARef.get(), listBRef.get()]);
  for (const listSnap of [listASnapAfterDelete, listBSnapAfterDelete]) {
    assert.equal(
      (listSnap.get("itemIds") as string[] | undefined)?.includes(deletableItemId) ?? false,
      false,
      "deleteHouseholdItem should remove stale itemIds"
    );
    assert.equal(
      (listSnap.get("packedItemIds") as string[] | undefined)?.includes(deletableItemId) ?? false,
      false,
      "deleteHouseholdItem should remove stale packedItemIds"
    );
  }

  await callFunction(adminClient, "deleteHouseholdArea", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    spaceId: sourceSpaceId,
    areaId: areaDeleteSourceId,
    reassignTo: {
      spaceId: targetSpaceId,
      areaId: targetAreaId
    }
  });

  const deletedAreaSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${sourceSpaceId}/areas/${areaDeleteSourceId}`).get();
  assert.equal(deletedAreaSnap.exists, false, "deleteHouseholdArea should remove the area");
  const areaDeleteItemSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/items/${areaDeleteItemId}`).get();
  assert.equal(areaDeleteItemSnap.get("spaceId"), targetSpaceId, "deleteHouseholdArea should move items to the target space");
  assert.equal(areaDeleteItemSnap.get("areaId"), targetAreaId, "deleteHouseholdArea should move items to the target area");
  assert.equal(areaDeleteItemSnap.get("areaNameSnapshot"), "Target Area", "deleteHouseholdArea should refresh the destination name");

  await callFunction(adminClient, "deleteHouseholdSpace", {
    householdId: EMULATOR_QA_HOUSEHOLD_ID,
    spaceId: sourceSpaceId,
    reassignTo: {
      spaceId: targetSpaceId,
      areaId: targetAreaId
    }
  });

  const deletedSpaceSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${sourceSpaceId}`).get();
  assert.equal(deletedSpaceSnap.exists, false, "deleteHouseholdSpace should remove the source space");
  const deletedOverflowAreaSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/spaces/${sourceSpaceId}/areas/${sourceOverflowAreaId}`).get();
  assert.equal(deletedOverflowAreaSnap.exists, false, "deleteHouseholdSpace should remove child areas");
  const spaceDeleteItemSnap = await db.doc(`households/${EMULATOR_QA_HOUSEHOLD_ID}/items/${spaceDeleteItemId}`).get();
  assert.equal(spaceDeleteItemSnap.get("spaceId"), targetSpaceId, "deleteHouseholdSpace should move items to the target space");
  assert.equal(spaceDeleteItemSnap.get("areaId"), targetAreaId, "deleteHouseholdSpace should move items to the target area");
  assert.equal(spaceDeleteItemSnap.get("areaNameSnapshot"), "Target Area", "deleteHouseholdSpace should refresh the destination name");

  await Promise.all([
    destroyClient(guestClient),
    destroyClient(memberClient),
    destroyClient(adminClient),
    destroyClient(testerClient),
    destroyClient(bootstrapClient)
  ]);

  console.log("Emulator smoke checks passed for auth, invite, packing list, and inventory delete callable flows.");
  console.log(`Project: ${projectId}`);
  console.log(`Invite created by: ${adminUser.email}`);
  console.log(`Invite accepted by: ${testerEmail}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
