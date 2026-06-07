import { getStorageClient } from "@/lib/firebase/client";
import type { ImageRef } from "@/types/domain";

export async function uploadFileToStorage(
  path: string,
  file: File,
  metadata?: { contentType?: string }
): Promise<ImageRef> {
  const [{ getDownloadURL, ref, uploadBytes }, storage] = await Promise.all([
    import("firebase/storage"),
    getStorageClient()
  ]);
  if (!storage) throw new Error("Firebase Storage is not configured");
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);
  return {
    storagePath: snapshot.ref.fullPath,
    downloadUrl,
    mimeType: file.type || metadata?.contentType,
    sizeBytes: file.size
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
