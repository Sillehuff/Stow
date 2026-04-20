import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadString } from "firebase/storage";
import { DEFAULT_FIREBASE_PROJECT_ID } from "../../src/lib/firebase/emulatorQa";

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID;
const HOUSEHOLD_ID = "storage-household";

let testEnv: RulesTestEnvironment;

async function seedMember(uid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `households/${HOUSEHOLD_ID}`), {
      name: "Storage Test Household",
      createdBy: uid
    });
    await setDoc(doc(db, `households/${HOUSEHOLD_ID}/members/${uid}`), {
      role: "MEMBER",
      createdBy: uid
    });
  });
}

describe("storage rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules: readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8")
      },
      storage: {
        host: "127.0.0.1",
        port: 9199,
        rules: readFileSync(resolve(process.cwd(), "storage.rules"), "utf8")
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it("allows a household member to upload under the household path", async () => {
    await seedMember("member-storage");
    const storage = testEnv.authenticatedContext("member-storage").storage();
    const objectRef = ref(storage, `households/${HOUSEHOLD_ID}/drafts/test/images/photo.png`);

    await assertSucceeds(uploadString(objectRef, "hello from stow", "raw", { contentType: "image/png" }));
  });

  it("blocks a non-member from uploading under the household path", async () => {
    await seedMember("member-storage");
    const storage = testEnv.authenticatedContext("intruder-storage").storage();
    const objectRef = ref(storage, `households/${HOUSEHOLD_ID}/drafts/test/images/blocked.png`);

    await assertFails(uploadString(objectRef, "nope", "raw", { contentType: "image/png" }));
  });

  it("blocks non-image uploads for members", async () => {
    await seedMember("member-storage");
    const storage = testEnv.authenticatedContext("member-storage").storage();
    const objectRef = ref(storage, `households/${HOUSEHOLD_ID}/drafts/test/images/not-image.txt`);

    await assertFails(uploadString(objectRef, "not an image", "raw", { contentType: "text/plain" }));
  });

  it("blocks oversized image uploads for members", async () => {
    await seedMember("member-storage");
    const storage = testEnv.authenticatedContext("member-storage").storage();
    const objectRef = ref(storage, `households/${HOUSEHOLD_ID}/drafts/test/images/huge.jpg`);
    const oversizedPayload = "x".repeat(8 * 1024 * 1024 + 1);

    await assertFails(uploadString(objectRef, oversizedPayload, "raw", { contentType: "image/jpeg" }));
  });
});
