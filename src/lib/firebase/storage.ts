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

export function imageRefFromUrl(url: string): ImageRef {
  return { downloadUrl: url.trim() };
}
