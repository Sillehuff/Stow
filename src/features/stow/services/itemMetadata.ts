import type { ImageRef, ItemEntryMode, ItemPhotoStatus, ItemStatus } from "@/types/domain";

export function hasUsableImage(image: unknown): image is ImageRef {
  if (!image || typeof image !== "object") return false;
  const candidate = image as ImageRef;
  return Boolean(candidate.downloadUrl || candidate.storagePath);
}

export function defaultPhotoStatus(input: {
  photoStatus?: unknown;
  image?: unknown;
}): ItemPhotoStatus {
  if (input.photoStatus === "attached" || input.photoStatus === "skipped" || input.photoStatus === "later") {
    return input.photoStatus;
  }
  return hasUsableImage(input.image) ? "attached" : "later";
}

export function defaultEntryMode(input: {
  entryMode?: unknown;
  vision?: unknown;
}): ItemEntryMode {
  if (input.entryMode === "manual" || input.entryMode === "ai_assisted" || input.entryMode === "photo_draft") {
    return input.entryMode;
  }
  return input.vision ? "ai_assisted" : "manual";
}

const ITEM_STATUSES: readonly ItemStatus[] = ["home", "packed", "lent", "repair", "lost"];

export function defaultItemStatus(input: { status?: unknown; isPacked?: unknown }): ItemStatus {
  if (typeof input.status === "string" && (ITEM_STATUSES as readonly string[]).includes(input.status)) {
    return input.status as ItemStatus;
  }
  return input.isPacked === true ? "packed" : "home";
}
