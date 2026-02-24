import type { Timestamp } from "firebase/firestore";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export type SpaceIcon = "home" | "coffee" | "briefcase" | "box" | "folder";

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
  icon: SpaceIcon;
  color: string;
  image?: ImageRef;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Area {
  id: string;
  householdId: string;
  spaceId: string;
  name: string;
  image?: ImageRef;
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
