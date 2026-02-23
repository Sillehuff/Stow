import admin from "firebase-admin";
import { normalizeSeedForHousehold } from "../src/features/stow/seed.js";

function parseArg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

async function main() {
  const uid = parseArg("uid") ?? "demo-owner";
  const householdId = parseArg("household") ?? crypto.randomUUID();
  const householdName = parseArg("name") ?? "Demo Household";

  const householdRef = db.doc(`households/${householdId}`);
  const memberRef = db.doc(`households/${householdId}/members/${uid}`);
  const llmRef = db.doc(`households/${householdId}/settings/llm`);
  const userRef = db.doc(`users/${uid}`);

  const seed = normalizeSeedForHousehold(householdId);
  const batch = db.batch();
  batch.set(householdRef, {
    name: householdName,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid
  });
  batch.set(memberRef, {
    role: "OWNER",
    displayName: "Demo Owner",
    email: "demo-owner@example.com",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid
  });
  batch.set(userRef, {
    currentHouseholdId: householdId,
    displayName: "Demo Owner",
    email: "demo-owner@example.com",
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(llmRef, {
    enabled: false,
    providerType: "openai_compatible",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    promptProfile: "default_inventory",
    temperature: 0.2,
    maxTokens: 400,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: uid
  }, { merge: true });

  for (const space of seed.spaces) {
    batch.set(db.doc(`households/${householdId}/spaces/${space.id}`), {
      ...space,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  for (const area of seed.areas) {
    batch.set(db.doc(`households/${householdId}/spaces/${area.spaceId}/areas/${area.id}`), {
      ...area,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  for (const item of seed.items) {
    batch.set(db.doc(`households/${householdId}/items/${item.id}`), {
      ...item,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: uid,
      updatedBy: uid
    });
  }

  await batch.commit();
  console.log(JSON.stringify({ householdId, uid, seededSpaces: seed.spaces.length, seededItems: seed.items.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
