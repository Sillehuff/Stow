import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths, storage } from "./shared/firestore.js";
import { requireHouseholdMember } from "./shared/authz.js";
import { inventoryVisionPrompt } from "./providers/common.js";
import { getVisionAdapter } from "./providers/registry.js";
import { loadConfigAndSecret } from "./llmConfig.js";
import { visionCategorizeInputSchema } from "./shared/schemas.js";

const DEFAULT_DAILY_LIMIT = 50;

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function visionDailyLimit(): number {
  return parsePositiveInt(process.env.VISION_DAILY_PER_USER_LIMIT, DEFAULT_DAILY_LIMIT);
}

function utcDayString(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function enforceVisionQuota(householdId: string, uid: string): Promise<{ count: number; limit: number }> {
  const limit = visionDailyLimit();
  const day = utcDayString();
  const ref = db.doc(paths.visionQuota(householdId, uid, day));
  try {
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const current = (snap.exists && typeof snap.get("count") === "number" ? (snap.get("count") as number) : 0);
      if (current >= limit) {
        throw new HttpsError(
          "resource-exhausted",
          `Vision categorization daily limit reached (${limit} per user). Try again tomorrow.`
        );
      }
      const next = current + 1;
      tx.set(
        ref,
        {
          count: next,
          day,
          uid,
          householdId,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return { count: next, limit };
    });
  } catch (err) {
    if (err instanceof HttpsError) throw err;
    throw new HttpsError("internal", `Failed to check vision quota: ${(err as Error)?.message ?? "unknown"}`);
  }
}

type ResolvedImage = {
  bytes: Buffer;
  mimeType: string;
  sourceUrl?: string;
};

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const IMAGE_FETCH_TIMEOUT_MS = 15_000;

function tooLargeError(): HttpsError {
  return new HttpsError(
    "invalid-argument",
    `Image exceeds maximum size of ${Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)} MB`
  );
}

function assertMimeType(mimeType: string) {
  const normalized = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (!normalized.startsWith("image/")) {
    throw new HttpsError("invalid-argument", `Unsupported image MIME type: ${mimeType || "unknown"}`);
  }
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Buffer> {
  const body = response.body;
  if (!body) {
    // No streaming body: fall back to arrayBuffer, but only if Content-Length
    // already promised it would fit. If the header was missing, we'd have
    // rejected earlier. This branch is mainly for tests / polyfills.
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > maxBytes) throw tooLargeError();
    return buf;
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // best-effort
        }
        throw tooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // best-effort
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)), total);
}

async function fetchFromUrl(url: string): Promise<ResolvedImage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if ((err as { name?: string })?.name === "AbortError") {
      throw new HttpsError("deadline-exceeded", "Image fetch timed out");
    }
    throw new HttpsError("failed-precondition", `Failed to fetch image: ${(err as Error)?.message ?? "network error"}`);
  }
  try {
    if (!response.ok) {
      throw new HttpsError("failed-precondition", `Failed to fetch image (${response.status})`);
    }
    const mimeType = response.headers.get("content-type") ?? "image/jpeg";
    assertMimeType(mimeType);

    const lengthHeader = response.headers.get("content-length");
    if (lengthHeader) {
      const declared = Number.parseInt(lengthHeader, 10);
      if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
        throw tooLargeError();
      }
    }

    const bytes = await readBoundedBody(response, MAX_IMAGE_BYTES);
    if (bytes.length === 0) {
      throw new HttpsError("invalid-argument", "Image is empty");
    }
    return {
      bytes,
      mimeType,
      sourceUrl: url
    };
  } finally {
    clearTimeout(timeout);
  }
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

  // Reserve a quota slot before doing any expensive work (image fetch or
  // provider call). If the caller has blown their daily limit we fail fast.
  const quota = await enforceVisionQuota(input.householdId, uid);

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
    quotaUsed: quota.count,
    quotaLimit: quota.limit,
    context: input.context ?? null
  });

  return {
    suggestion,
    provider: {
      providerType: config.providerType,
      model: config.model
    },
    quota
  };
}
