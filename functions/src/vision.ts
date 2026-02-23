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
  sourceUrl?: string;
};

async function fetchFromUrl(url: string): Promise<ResolvedImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new HttpsError("failed-precondition", `Failed to fetch image (${response.status})`);
  }
  const mimeType = response.headers.get("content-type") ?? "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  return {
    bytes: Buffer.from(arrayBuffer),
    mimeType,
    sourceUrl: url
  };
}

async function resolveImage(imageRef: { storagePath?: string; downloadUrl?: string; imageUrl?: string }) {
  if (imageRef.imageUrl) return fetchFromUrl(imageRef.imageUrl);
  if (imageRef.downloadUrl) return fetchFromUrl(imageRef.downloadUrl);
  if (!imageRef.storagePath) {
    throw new HttpsError("invalid-argument", "Image reference is missing storagePath/downloadUrl/imageUrl");
  }
  const bucket = storage.bucket();
  const file = bucket.file(imageRef.storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Image file not found in storage");
  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 5 * 60 * 1000
  });
  return fetchFromUrl(signedUrl);
}

export async function visionCategorizeItemImageHandler(raw: unknown, uid: string) {
  const input = visionCategorizeInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, uid);
  const { config, apiKey } = await loadConfigAndSecret(input.householdId);
  if (!config.enabled) throw new HttpsError("failed-precondition", "Vision categorization is disabled for this household");

  const image = await resolveImage("imageUrl" in input.imageRef ? { imageUrl: input.imageRef.imageUrl } : input.imageRef);
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
