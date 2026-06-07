import type { Timestamp } from "firebase/firestore";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

/** @deprecated use free-form string icon keys validated at the UI boundary. */
export type SpaceIcon = string;

export interface ImageRef {
  storagePath?: string;
  downloadUrl?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  sizeBytes?: number;
}

export interface VisionMetadata {
  providerType?: string;
  model?: string;
  confidence?: number;
  rawJobId?: string;
  categorizedAt?: Timestamp;
}

export type ItemPhotoStatus = "attached" | "skipped" | "later";
export type ItemEntryMode = "manual" | "ai_assisted" | "photo_draft";

export interface Household {
  id: string;
  name: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface HouseholdMember {
  uid: string;
  role: Role;
  email?: string;
  displayName?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface Space {
  id: string;
  householdId: string;
  name: string;
  // Free-form key validated at the UI boundary via iconForKey; legacy values still match ICONS.
  icon: string;
  color: string;
  image?: ImageRef;
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Area {
  id: string;
  householdId: string;
  spaceId: string;
  name: string;
  image?: ImageRef;
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Item {
  id: string;
  householdId: string;
  spaceId: string;
  areaId: string;
  areaNameSnapshot: string;
  name: string;
  kind: "item" | "folder";
  image?: ImageRef;
  value?: number;
  isPriceless?: boolean;
  tags: string[];
  notes?: string;
  isPacked: boolean;
  photoStatus: ItemPhotoStatus;
  entryMode: ItemEntryMode;
  vision?: VisionMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface ItemDraft {
  id: string;
  householdId: string;
  spaceId?: string;
  areaId?: string;
  areaNameSnapshot?: string;
  image: ImageRef;
  name?: string;
  kind?: "item" | "folder";
  tags: string[];
  notes?: string;
  vision?: VisionMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface PackingList {
  id: string;
  householdId: string;
  name: string;
  itemIds: string[];
  packedItemIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface HouseholdInvite {
  id: string;
  role: Role;
  tokenHash: string;
  token?: string;
  createdAt: Timestamp;
  createdBy: string;
  expiresAt: Timestamp;
  acceptedAt?: Timestamp;
  acceptedBy?: string;
}

export interface SpaceWithAreas extends Space {
  areas: Area[];
}

export type SyncMeta = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};
