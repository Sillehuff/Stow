import { auth, getStorageClient } from "@/lib/firebase/client";
import type { ImageRef } from "@/types/domain";

async function ensureStorageAuthReady() {
  const user = auth?.currentUser;
  if (!user) {
    throw new Error("Sign in again before uploading images");
  }
  await user.getIdToken();
}

export async function uploadFileToStorage(
  path: string,
  file: File,
  options?: { contentType?: string; includeDownloadUrl?: boolean }
): Promise<ImageRef> {
  const [{ getDownloadURL, ref, uploadBytes }, storage] = await Promise.all([
    import("firebase/storage"),
    getStorageClient()
  ]);
  if (!storage) throw new Error("Firebase Storage is not configured");
  await ensureStorageAuthReady();
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file, { contentType: options?.contentType });
  const downloadUrl =
    options?.includeDownloadUrl === false ? undefined : await getDownloadURL(snapshot.ref);
  return {
    storagePath: snapshot.ref.fullPath,
    downloadUrl,
    mimeType: file.type || options?.contentType,
    sizeBytes: file.size
  };
}

export function imageRefFromUrl(url: string): ImageRef {
  return { downloadUrl: url.trim() };
}
