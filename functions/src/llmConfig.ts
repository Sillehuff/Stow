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

// Every vision call re-reads two Firestore docs and pays a billed KMS decrypt, even
// though a household's config and API key change at most a handful of times ever. A
// warm instance can serve a burst of single-item categorize calls (one shelf scan
// fans out per item), so cache the resolved config+key briefly per household. TTL is
// short and the cache is invalidated on any config/secret write on this instance, so
// worst-case cross-instance staleness after a key rotation is one TTL window.
const CONFIG_CACHE_TTL_MS = 60_000;

interface CachedConfigAndSecret {
  config: HouseholdLlmConfig;
  apiKey: string;
  expiresAt: number;
}

const configCache = new Map<string, CachedConfigAndSecret>();

function invalidateConfigCache(householdId: string): void {
  configCache.delete(householdId);
}

async function loadConfigAndSecret(householdId: string): Promise<{ config: HouseholdLlmConfig; apiKey: string }> {
  const cached = configCache.get(householdId);
  if (cached && cached.expiresAt > Date.now()) {
    return { config: cached.config, apiKey: cached.apiKey };
  }

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
  configCache.set(householdId, { config, apiKey, expiresAt: Date.now() + CONFIG_CACHE_TTL_MS });
  return { config, apiKey };
}

export async function saveHouseholdLlmConfigHandler(raw: unknown, uid: string) {
  const input = saveLlmConfigInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);

  const config = { ...input.config, baseUrl: input.config.baseUrl ?? undefined };
  if (config.providerType === "openai_compatible" && !config.baseUrl) {
    throw new HttpsError("invalid-argument", "OpenAI-compatible provider requires a baseUrl");
  }

  const payload = {
    ...config,
    baseUrl: config.baseUrl ?? FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: uid
  };

  await db.doc(paths.llmConfig(input.householdId)).set(payload, { merge: true });
  invalidateConfigCache(input.householdId);
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
  invalidateConfigCache(input.householdId);
  return { ok: true as const };
}

export async function validateHouseholdLlmConfigHandler(raw: unknown, uid: string) {
  const input = validateLlmConfigInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);

  invalidateConfigCache(input.householdId);
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
    invalidateConfigCache(input.householdId);
  }

  return result;
}

export { loadConfigAndSecret };
