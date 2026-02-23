import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./shared/firestore.js";
import { decryptSecret, encryptSecret } from "./crypto/kms.js";
import {
  saveLlmConfigInputSchema,
  setLlmSecretInputSchema,
  validateLlmConfigInputSchema,
  type HouseholdLlmConfig
} from "./shared/schemas.js";
import { requireHouseholdAdmin } from "./shared/authz.js";
import { getVisionAdapter } from "./providers/registry.js";

async function loadConfigAndSecret(householdId: string): Promise<{ config: HouseholdLlmConfig; apiKey: string }> {
  const [cfgSnap, secretSnap] = await Promise.all([
    db.doc(paths.llmConfig(householdId)).get(),
    db.doc(paths.llmSecret(householdId)).get()
  ]);

  if (!cfgSnap.exists) throw new HttpsError("failed-precondition", "LLM config is not set");
  const config = cfgSnap.data() as HouseholdLlmConfig;

  if (!secretSnap.exists) throw new HttpsError("failed-precondition", "LLM API key is not set");
  const ciphertext = secretSnap.get("ciphertext") as string | undefined;
  if (!ciphertext) throw new HttpsError("failed-precondition", "LLM API key ciphertext is missing");

  const apiKey = await decryptSecret(ciphertext);
  return { config, apiKey };
}

export async function saveHouseholdLlmConfigHandler(raw: unknown, uid: string) {
  const input = saveLlmConfigInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);

  const payload = {
    ...input.config,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid
  };

  await db.doc(paths.llmConfig(input.householdId)).set(payload, { merge: true });
  return { ok: true as const };
}

export async function setHouseholdLlmSecretHandler(raw: unknown, uid: string) {
  const input = setLlmSecretInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);
  const ciphertext = await encryptSecret(input.apiKey);
  await db.doc(paths.llmSecret(input.householdId)).set(
    {
      ciphertext,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid
    },
    { merge: true }
  );
  return { ok: true as const };
}

export async function validateHouseholdLlmConfigHandler(raw: unknown, uid: string) {
  const input = validateLlmConfigInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);

  const { config, apiKey } = await loadConfigAndSecret(input.householdId);
  const adapter = getVisionAdapter(config.providerType);
  const result = await adapter.validate({ config, apiKey });

  if (result.ok) {
    await db.doc(paths.llmConfig(input.householdId)).set(
      {
        lastValidatedAt: FieldValue.serverTimestamp(),
        lastValidatedBy: uid
      },
      { merge: true }
    );
  }

  return result;
}

export { loadConfigAndSecret };
