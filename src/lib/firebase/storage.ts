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

export async function uploadImageUrlToStorage(path: string, url: string): Promise<ImageRef> {
  const response = await fetch(url.trim());
  if (!response.ok) {
    throw new Error(`Failed to fetch image (${response.status})`);
  }
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("Selected URL does not point to an image");
  }

  const fileNameFromUrl = (() => {
    try {
      const parsed = new URL(url.trim());
      return parsed.pathname.split("/").filter(Boolean).at(-1) || "remote-image";
    } catch {
      return "remote-image";
    }
  })();

  const extension = blob.type.split("/")[1]?.replace(/[^\w-]+/g, "") || "jpg";
  const safeName = fileNameFromUrl.replace(/[^\w.-]+/g, "_").replace(/\.[^.]+$/, "") || "remote-image";
  const file = new File([blob], `${safeName}.${extension}`, { type: blob.type });
  return uploadFileToStorage(path, file, { contentType: blob.type });
}
