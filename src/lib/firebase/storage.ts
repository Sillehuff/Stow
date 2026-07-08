import { getStorageClient } from "@/lib/firebase/client";
import { downscaleImageBlob } from "@/lib/images/downscaleImage";
import type { ImageRef } from "@/types/domain";

export async function uploadFileToStorage(
  path: string,
  file: File,
  metadata?: { contentType?: string }
): Promise<ImageRef> {
  // Fail fast offline: uploadBytes silently retries for up to 10 minutes, which
  // reads as a hang on every capture path. The local-cache story that makes
  // Firestore writes safe offline does not exist for Storage.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new Error("Photo uploads need a connection — you appear to be offline");
  }
  const [{ getDownloadURL, ref, uploadBytes }, storage] = await Promise.all([
    import("firebase/storage"),
    getStorageClient()
  ]);
  if (!storage) throw new Error("Firebase Storage is not configured");

  // This is the single choke point every photo path uses (item photos, capture
  // flows, shelf frames), so all of them get the client-side downscale here.
  const declaredType = file.type || metadata?.contentType;
  let payload: Blob = file;
  let payloadType = declaredType;
  if (declaredType?.startsWith("image/")) {
    const scaled = await downscaleImageBlob(file);
    if (scaled !== file) {
      payload = scaled;
      payloadType = scaled.type || "image/jpeg";
    }
  }

  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, payload, { ...metadata, contentType: payloadType });
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return {
    storagePath: snapshot.ref.fullPath,
    downloadUrl,
    mimeType: payloadType,
    sizeBytes: payload.size
  };
}

export async function deleteStorageObject(path: string): Promise<void> {
  if (!path) return;
  const [{ deleteObject, ref }, storage] = await Promise.all([
    import("firebase/storage"),
    getStorageClient()
  ]);
  if (!storage) throw new Error("Firebase Storage is not configured");
  await deleteObject(ref(storage, path));
}

export function imageRefFromUrl(url: string): ImageRef {
  return { downloadUrl: url.trim() };
}

export async function bestEffortDeleteImage(image: ImageRef | null | undefined): Promise<void> {
  const storagePath = image?.storagePath;
  if (!storagePath) return;
  try {
    await deleteStorageObject(storagePath);
  } catch (error) {
    // Orphan cleanup is best-effort: a missing or already-deleted object,
    // or a transient Storage error, must never block the user-facing action.
    console.warn("bestEffortDeleteImage: failed to delete", storagePath, error);
  }
}
