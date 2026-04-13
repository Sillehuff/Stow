/**
 * End-to-end smoke test for the vision AI feature.
 *
 * Runs against a real Firestore emulator. Invoke via:
 *   npx firebase --project stow-emulator-test emulators:exec \
 *     --only firestore \
 *     "npm --prefix functions run test:emulator"
 *
 * The test:
 *   1. Connects firebase-admin to the Firestore emulator.
 *   2. Seeds a household + OWNER member + llmConfig + encrypted llmSecret.
 *   3. Stubs global.fetch to return image bytes and a canned provider payload.
 *   4. Calls visionCategorizeItemImageHandler directly for each provider.
 *   5. Asserts the returned suggestion and the persisted visionJobs doc.
 *
 * Skips automatically if FIRESTORE_EMULATOR_HOST is not set (so CI without
 * the emulator doesn't fail — use `npm test` for the pure unit suite).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { HouseholdLlmConfig, VisionSuggestion } from "../../src/shared/schemas.js";

const HOUSEHOLD_ID = `h-${Date.now()}`;
const USER_ID = "test-owner";

const emulatorReady = !!process.env.FIRESTORE_EMULATOR_HOST;

// Ensure firebase-admin uses the emulator project id before we import any
// module that initialises the admin SDK.
if (emulatorReady && !process.env.GCLOUD_PROJECT) {
  process.env.GCLOUD_PROJECT = "stow-emulator-test";
}
// Deterministic local encryption key so the secret seeding matches decrypt.
process.env.LOCAL_SECRET_ENCRYPTION_KEY = "stow-emulator-fixture-key";
delete process.env.KMS_KEY_NAME;

const baseConfig: HouseholdLlmConfig = {
  enabled: true,
  providerType: "openai_compatible",
  model: "gpt-4o-mini",
  baseUrl: "https://api.openai.test/v1",
  promptProfile: "default_inventory",
  temperature: 0.2,
  maxTokens: 300
};

const fakeSuggestion: VisionSuggestion = {
  suggestedName: "Desk Lamp",
  tags: ["Office", "Lighting"],
  confidence: 0.92,
  rationale: "Visible arm and bulb"
};

function imageResponse(bytes: Buffer, mimeType = "image/jpeg") {
  const ab = new ArrayBuffer(bytes.length);
  new Uint8Array(ab).set(bytes);
  return new Response(ab, { status: 200, headers: { "content-type": mimeType } });
}

function providerJson(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

const providerPayloads = {
  openai_compatible: () =>
    providerJson({ choices: [{ message: { content: JSON.stringify(fakeSuggestion) } }] }),
  gemini: () =>
    providerJson({
      candidates: [{ content: { parts: [{ text: JSON.stringify(fakeSuggestion) }] } }]
    }),
  anthropic: () =>
    providerJson({ content: [{ type: "text", text: JSON.stringify(fakeSuggestion) }] })
};

describe.runIf(emulatorReady)("vision emulator smoke test", () => {
  let visionHandler: (raw: unknown, uid: string) => Promise<{
    suggestion: VisionSuggestion;
    provider: { providerType: string; model: string };
  }>;
  let db: FirebaseFirestore.Firestore;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    const firestoreModule = await import("../../src/shared/firestore.js");
    db = firestoreModule.db as FirebaseFirestore.Firestore;

    const { encryptSecret } = await import("../../src/crypto/kms.js");
    const ciphertext = await encryptSecret("sk-test-emulator-key");

    await db.doc(`households/${HOUSEHOLD_ID}`).set({
      name: "Emulator Test Household",
      createdAt: firestoreModule.FieldValue.serverTimestamp()
    });
    await db.doc(`households/${HOUSEHOLD_ID}/members/${USER_ID}`).set({
      role: "OWNER",
      createdAt: firestoreModule.FieldValue.serverTimestamp()
    });
    await db.doc(`households/${HOUSEHOLD_ID}/settings/llm`).set(baseConfig);
    await db.doc(`households/${HOUSEHOLD_ID}/settings/llmSecret`).set({ ciphertext });

    ({ visionCategorizeItemImageHandler: visionHandler } = await import("../../src/vision.js"));
  });

  afterAll(async () => {
    if (!db) return;
    // Best-effort cleanup so consecutive runs don't accumulate vision jobs.
    const jobs = await db.collection(`households/${HOUSEHOLD_ID}/visionJobs`).get();
    await Promise.all(jobs.docs.map((d) => d.ref.delete()));
  });

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function setProvider(providerType: HouseholdLlmConfig["providerType"], model: string) {
    await db.doc(`households/${HOUSEHOLD_ID}/settings/llm`).set(
      { ...baseConfig, providerType, model, baseUrl: providerType === "openai_compatible" ? baseConfig.baseUrl : null },
      { merge: false }
    );
  }

  it("runs end-to-end with the OpenAI-compatible provider", async () => {
    await setProvider("openai_compatible", "gpt-4o-mini");
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("img-bytes"), "image/jpeg"))
      .mockResolvedValueOnce(providerPayloads.openai_compatible());

    const result = await visionHandler(
      { householdId: HOUSEHOLD_ID, imageRef: { imageUrl: "https://example.test/item.jpg" } },
      USER_ID
    );
    expect(result.suggestion.suggestedName).toBe("Desk Lamp");
    expect(result.provider.providerType).toBe("openai_compatible");

    const jobs = await db.collection(`households/${HOUSEHOLD_ID}/visionJobs`).get();
    const mostRecent = jobs.docs
      .map((d) => d.data())
      .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))[0];
    expect(mostRecent?.providerType).toBe("openai_compatible");
    expect(mostRecent?.confidence).toBeCloseTo(0.92);
    expect(mostRecent?.createdBy).toBe(USER_ID);
  });

  it("runs end-to-end with the Gemini provider", async () => {
    await setProvider("gemini", "gemini-1.5-flash");
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("png-bytes"), "image/png"))
      .mockResolvedValueOnce(providerPayloads.gemini());

    const result = await visionHandler(
      { householdId: HOUSEHOLD_ID, imageRef: { imageUrl: "https://example.test/item.png" } },
      USER_ID
    );
    expect(result.provider.providerType).toBe("gemini");
    expect(result.suggestion.suggestedName).toBe("Desk Lamp");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("generateContent");
  });

  it("runs end-to-end with the Anthropic provider", async () => {
    await setProvider("anthropic", "claude-3-5-sonnet-20241022");
    fetchMock
      .mockResolvedValueOnce(imageResponse(Buffer.from("jpg-bytes"), "image/jpeg"))
      .mockResolvedValueOnce(providerPayloads.anthropic());

    const result = await visionHandler(
      { householdId: HOUSEHOLD_ID, imageRef: { imageUrl: "https://example.test/item.jpg" } },
      USER_ID
    );
    expect(result.provider.providerType).toBe("anthropic");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.anthropic.com/v1/messages");
  });

  it("rejects a caller who is not a household member", async () => {
    await setProvider("openai_compatible", "gpt-4o-mini");
    fetchMock.mockResolvedValue(imageResponse(Buffer.from("x"), "image/jpeg"));
    await expect(
      visionHandler(
        { householdId: HOUSEHOLD_ID, imageRef: { imageUrl: "https://example.test/x.jpg" } },
        "stranger-uid"
      )
    ).rejects.toThrow(/not a member/);
  });
});
