import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths, storage } from "./shared/firestore.js";
import { requireHouseholdMember } from "./shared/authz.js";
import { inventoryVisionPrompt } from "./providers/common.js";
import { shelfDetectionPrompt } from "./providers/gemini.js";
import { getVisionAdapter } from "./providers/registry.js";
import { loadConfigAndSecret } from "./llmConfig.js";
import { visionCategorizeInputSchema, visionDetectShelfInputSchema } from "./shared/schemas.js";

type ResolvedImage = {
  bytes: Buffer;
  mimeType: string;
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 10_000;

async function downloadStorageFile(storagePath: string) {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const [exists] = await file.exists();
  if (!exists) throw new HttpsError("not-found", "Image file not found in storage");

  const [metadata] = await file.getMetadata();
  const mimeType = metadata.contentType ?? "";
  if (!mimeType.startsWith("image/")) {
    throw new HttpsError("invalid-argument", "Only image uploads can be sent to vision categorization");
  }

  const declaredSize = Number(metadata.size ?? 0);
  if (Number.isFinite(declaredSize) && declaredSize > MAX_IMAGE_BYTES) {
    throw new HttpsError("invalid-argument", "Images larger than 10 MB are not supported");
  }

  const bytes = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const stream = file.createReadStream();
    const timer = setTimeout(() => {
      stream.destroy(new Error("Image download timed out"));
    }, DOWNLOAD_TIMEOUT_MS);

    stream.on("data", (chunk) => {
      const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += data.length;
      if (totalBytes > MAX_IMAGE_BYTES) {
        stream.destroy(new HttpsError("invalid-argument", "Images larger than 10 MB are not supported"));
        return;
      }
      chunks.push(data);
    });

    stream.on("error", (error) => {
      clearTimeout(timer);
      if (error instanceof HttpsError) {
        reject(error);
        return;
      }
      if (error instanceof Error && error.message === "Image download timed out") {
        reject(new HttpsError("deadline-exceeded", "Image download timed out"));
        return;
      }
      reject(new HttpsError("failed-precondition", "Failed to download image for categorization"));
    });

    stream.on("end", () => {
      clearTimeout(timer);
      resolve(Buffer.concat(chunks));
    });
  });

  return {
    bytes,
    mimeType
  };
}

async function resolveImage(householdId: string, imageRef: { storagePath: string }): Promise<ResolvedImage> {
  if (!imageRef.storagePath.startsWith(`households/${householdId}/`)) {
    throw new HttpsError("permission-denied", "Vision categorization only accepts household storage images");
  }
  return downloadStorageFile(imageRef.storagePath);
}

export async function visionCategorizeItemImageHandler(raw: unknown, uid: string) {
  const input = visionCategorizeInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, uid);
  const { config, apiKey } = await loadConfigAndSecret(input.householdId);
  if (!config.enabled) throw new HttpsError("failed-precondition", "Vision categorization is disabled for this household");

  const image = await resolveImage(input.householdId, input.imageRef);
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
    },
    jobId: visionJobRef.id
  };
}

export async function visionDetectShelfItemsHandler(raw: unknown, uid: string) {
  const input = visionDetectShelfInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, uid);
  const { config, apiKey } = await loadConfigAndSecret(input.householdId);
  if (!config.enabled) throw new HttpsError("failed-precondition", "Vision categorization is disabled for this household");

  const image = await resolveImage(input.householdId, input.imageRef);
  const adapter = getVisionAdapter(config.providerType);
  if (!adapter.detectShelfItems) {
    throw new HttpsError("failed-precondition", "Shelf detection unsupported for this provider");
  }
  const prompt = shelfDetectionPrompt({ areaName: input.areaName });

  const startedAt = Date.now();
  const detections = await adapter.detectShelfItems({ apiKey, config, prompt, image });
  const latencyMs = Date.now() - startedAt;

  const visionJobRef = db.collection(paths.visionJobs(input.householdId)).doc();
  await visionJobRef.set({
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    providerType: config.providerType,
    model: config.model,
    latencyMs,
    kind: "shelf_detect",
    detectionCount: detections.length,
    context: {
      spaceId: input.spaceId ?? null,
      areaId: input.areaId ?? null,
      areaName: input.areaName ?? null
    }
  });

  return {
    detections,
    provider: config.providerType,
    jobId: visionJobRef.id
  };
}
