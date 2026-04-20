import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths, storage } from "./shared/firestore.js";
import { requireHouseholdMember } from "./shared/authz.js";
import { inventoryVisionPrompt } from "./providers/common.js";
import { getVisionAdapter } from "./providers/registry.js";
import { loadConfigAndSecret } from "./llmConfig.js";
import { visionCategorizeInputSchema } from "./shared/schemas.js";

type ResolvedImage = {
  bytes: Buffer;
  mimeType: string;
};

const MAX_VISION_IMAGE_BYTES = 8 * 1024 * 1024;

function assertHouseholdStoragePath(householdId: string, storagePath: string) {
  const householdPrefix = `households/${householdId}/drafts/`;
  if (!storagePath.startsWith(householdPrefix)) {
    throw new HttpsError("permission-denied", "Image must be an uploaded draft for the active household");
  }
}

async function resolveStoredImage(householdId: string, imageRef: { storagePath: string }) {
  assertHouseholdStoragePath(householdId, imageRef.storagePath);
  const bucket = storage.bucket();
  const file = bucket.file(imageRef.storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Image file not found in storage");
  const [metadata] = await file.getMetadata();
  const mimeType = metadata.contentType ?? "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    throw new HttpsError("failed-precondition", "Selected file is not an image");
  }
  const sizeBytes = Number(metadata.size ?? 0);
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new HttpsError("failed-precondition", "Selected image is empty or unreadable");
  }
  if (sizeBytes > MAX_VISION_IMAGE_BYTES) {
    throw new HttpsError("failed-precondition", "Selected image is too large. Choose an image under 8 MB.");
  }
  const [bytes] = await file.download();
  return {
    bytes,
    mimeType
  } satisfies ResolvedImage;
}

export async function visionCategorizeItemImageHandler(raw: unknown, uid: string) {
  const input = visionCategorizeInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, uid);
  const { config, apiKey } = await loadConfigAndSecret(input.householdId);
  if (!config.enabled) throw new HttpsError("failed-precondition", "Vision categorization is disabled for this household");

  const image = await resolveStoredImage(input.householdId, input.imageRef);
  const adapter = getVisionAdapter(config.providerType);
  const prompt = inventoryVisionPrompt({ areaName: input.context?.areaName });

  const startedAt = Date.now();
  const suggestion = await adapter.classifyImage({
    apiKey,
    config,
    prompt,
    image
  });
  const latencyMs = Date.now() - startedAt;

  const visionJobRef = db.collection(paths.visionJobs(input.householdId)).doc();
  await visionJobRef.set({
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    providerType: config.providerType,
    model: config.model,
    latencyMs,
    confidence: suggestion.confidence,
    context: input.context ?? null
  });

  return {
    suggestion,
    provider: {
      providerType: config.providerType,
      model: config.model
    }
  };
}
