import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { setDoc, doc } from "firebase/firestore";
import { deleteObject, getBytes, ref, uploadBytes } from "firebase/storage";

// Must match the project the emulators are launched with (`--project demo-stow`):
// the Storage emulator resolves `firestore.exists()` against that project's
// Firestore namespace, so the seeded member doc must live there too.
const PROJECT_ID = "demo-stow";
const HOUSEHOLD_ID = "household-1";
const IMAGE_PATH = `households/${HOUSEHOLD_ID}/items/item-1/photo.jpg`;

let testEnv: RulesTestEnvironment;

const smallJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

async function seedMember() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "households", HOUSEHOLD_ID), {
      name: "Stow Test Household",
      createdBy: "owner-1"
    });
    await setDoc(doc(db, "households", HOUSEHOLD_ID, "members", "member-1"), {
      uid: "member-1",
      role: "MEMBER",
      createdBy: "owner-1"
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
        rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8")
      },
      storage: {
        host: "127.0.0.1",
        port: 9199,
        rules: readFileSync(new URL("../storage.rules", import.meta.url), "utf8")
      }
    });
  });

  beforeEach(async () => {
    await testEnv.clearStorage();
    await testEnv.clearFirestore();
    await seedMember();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

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

  it("lets members overwrite an existing object", async () => {
    const storage = testEnv.authenticatedContext("member-1").storage();
    await assertSucceeds(uploadBytes(ref(storage, IMAGE_PATH), smallJpeg, { contentType: "image/jpeg" }));
    // Second upload to the same path exercises the `update` verb, not `create`.
    await assertSucceeds(uploadBytes(ref(storage, IMAGE_PATH), smallJpeg, { contentType: "image/png" }));
  });

  it("denies non-members reading a member-uploaded object", async () => {
    const memberStorage = testEnv.authenticatedContext("member-1").storage();
    await assertSucceeds(uploadBytes(ref(memberStorage, IMAGE_PATH), smallJpeg, { contentType: "image/jpeg" }));

    const strangerStorage = testEnv.authenticatedContext("stranger").storage();
    await assertFails(getBytes(ref(strangerStorage, IMAGE_PATH)));
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
