import { createHash } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  DEFAULT_FIREBASE_PROJECT_ID,
  EMULATOR_QA_HOUSEHOLD_ID,
  EMULATOR_QA_INVITE_TOKEN,
  EMULATOR_QA_PASSWORD,
  EMULATOR_QA_USERS
} from "../src/lib/firebase/emulatorQa";

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
const app = getApps()[0] ?? initializeApp({ projectId });
const auth = getAuth(app);
const db = getFirestore(app);

const HOUSEHOLD_ID = EMULATOR_QA_HOUSEHOLD_ID;
const QA_PASSWORD = EMULATOR_QA_PASSWORD;
const QA_INVITE_TOKEN = EMULATOR_QA_INVITE_TOKEN;

function inviteTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function upsertUser(input: (typeof EMULATOR_QA_USERS)[number]) {
  const displayName = input.label ?? null;
  try {
    await auth.createUser({
      uid: input.uid,
      email: input.email,
      displayName: displayName ?? undefined,
      password: QA_PASSWORD
    });
    return;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "auth/email-already-exists" && code !== "auth/uid-already-exists") {
      throw error;
    }
  }

  await auth.updateUser(input.uid, {
    email: input.email,
    displayName: displayName ?? undefined,
    password: QA_PASSWORD
  });
}

async function seedFirestore() {
  const batch = db.batch();

  batch.set(db.doc(`households/${HOUSEHOLD_ID}`), {
    name: "QA Household",
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "qa-owner",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  for (const user of EMULATOR_QA_USERS) {
    batch.set(db.doc(`users/${user.uid}`), {
      email: user.email,
      displayName: user.label ?? null,
      currentHouseholdId: HOUSEHOLD_ID,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    batch.set(db.doc(`households/${HOUSEHOLD_ID}/members/${user.uid}`), {
      role: user.role,
      email: user.email,
      displayName: user.label ?? null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "qa-owner"
    }, { merge: true });
  }

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/settings/llm`), {
    enabled: false,
    providerType: "openai_compatible",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    promptProfile: "default_inventory",
    temperature: 0.2,
    maxTokens: 400,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/spaces/living-room`), {
    householdId: HOUSEHOLD_ID,
    name: "Living Room",
    icon: "home",
    color: "#4E7BFF",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/spaces/garage`), {
    householdId: HOUSEHOLD_ID,
    name: "Garage",
    icon: "box",
    color: "#F26A3D",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/spaces/living-room/areas/media-console`), {
    householdId: HOUSEHOLD_ID,
    spaceId: "living-room",
    name: "Media Console",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/spaces/garage/areas/tool-wall`), {
    householdId: HOUSEHOLD_ID,
    spaceId: "garage",
    name: "Tool Wall",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/items/passports-folder`), {
    householdId: HOUSEHOLD_ID,
      spaceId: "living-room",
      areaId: "media-console",
      areaNameSnapshot: "Media Console",
      name: "Passports Folder",
      kind: "folder",
      image: null,
      value: null,
      isPriceless: true,
      tags: ["travel", "documents"],
      notes: "Top drawer organizer",
      isPacked: true,
    vision: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: "qa-owner",
    updatedBy: "qa-owner"
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/items/drill-driver`), {
    householdId: HOUSEHOLD_ID,
    spaceId: "garage",
    areaId: "tool-wall",
    areaNameSnapshot: "Tool Wall",
    name: "Cordless Drill",
    kind: "item",
    image: null,
      value: 149,
      isPriceless: false,
      tags: ["tools"],
      notes: "Battery on upper shelf",
      isPacked: false,
    vision: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: "qa-admin",
    updatedBy: "qa-admin"
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/packingLists/weekend-trip`), {
    householdId: HOUSEHOLD_ID,
    name: "Weekend Trip",
    itemIds: ["passports-folder", "drill-driver"],
    packedItemIds: ["passports-folder"],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    createdBy: "qa-owner",
    updatedBy: "qa-owner"
  }, { merge: true });

  batch.set(db.doc(`households/${HOUSEHOLD_ID}/invites/qa-member-invite`), {
    role: "MEMBER",
    token: QA_INVITE_TOKEN,
    tokenHash: inviteTokenHash(QA_INVITE_TOKEN),
    createdAt: FieldValue.serverTimestamp(),
    createdBy: "qa-owner",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
  }, { merge: true });

  await batch.commit();
}

async function main() {
  await Promise.all(EMULATOR_QA_USERS.map((user) => upsertUser(user)));
  await seedFirestore();

  const baseUrl = process.env.APP_BASE_URL || "http://127.0.0.1:5173";
  const inviteUrl = `${baseUrl}/invite?householdId=${HOUSEHOLD_ID}&token=${QA_INVITE_TOKEN}&role=MEMBER&householdName=QA%20Household&inviter=QA%20Owner`;

  console.log("QA emulator fixtures seeded.");
  console.log(`Project: ${projectId}`);
  console.log(`Household: ${HOUSEHOLD_ID}`);
  console.log(`Password for seeded QA accounts: ${QA_PASSWORD}`);
  for (const user of EMULATOR_QA_USERS) {
    console.log(`- ${user.role}: ${user.email}`);
  }
  console.log(`Invite URL: ${inviteUrl}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
