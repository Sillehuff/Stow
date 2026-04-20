import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { householdPaths } from "@/lib/firebase/paths";
import {
  clearHouseholdPackingListPacked,
  createHouseholdPackingList,
  deleteHouseholdArea,
  deleteHouseholdItem,
  deleteHouseholdPackingList,
  deleteHouseholdSpace,
  removeHouseholdMember,
  revokeHouseholdInvite,
  toggleHouseholdPackingListItem,
  updateHouseholdPackingList,
  updateHouseholdMemberRole
} from "@/lib/firebase/functions";
import type { Area, Household, HouseholdInvite, HouseholdMember, ImageRef, Item, PackingList, Space } from "@/types/domain";
import type { HouseholdLlmConfig } from "@/types/llm";

export type SnapshotState<T> = {
  data: T[];
  fromCache: boolean;
  hasPendingWrites: boolean;
};

type StoredItem = Item & {
  deletedAt?: Item["updatedAt"] | null;
};

function mapDoc<T>(snap: { id: string; data(): DocumentData }): T & { id: string } {
  return { id: snap.id, ...(snap.data() as Record<string, unknown>) } as T & { id: string };
}

function mapSnapshot<T>(snap: QuerySnapshot<DocumentData>): SnapshotState<T> {
  return {
    data: snap.docs.map((docSnap) => mapDoc<T>(docSnap)),
    fromCache: snap.metadata.fromCache,
    hasPendingWrites: snap.metadata.hasPendingWrites
  };
}

function requireDb() {
  if (!db) throw new Error("Firestore is not configured");
  return db;
}

function omitUndefinedFields<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, candidate]) => candidate !== undefined)) as Partial<T>;
}

export const inventoryRepository = {
  subscribeHousehold(householdId: string, onData: (household: Household | null) => void, onError: (e: Error) => void) {
    return onSnapshot(
      doc(requireDb(), householdPaths.root(householdId)),
      (snap) => {
        onData(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Household, "id">) } as Household) : null);
      },
      onError
    );
  },

  async updateHousehold(input: { householdId: string; patch: Partial<Pick<Household, "name">> }) {
    await updateDoc(doc(requireDb(), householdPaths.root(input.householdId)), {
      ...input.patch,
      updatedAt: serverTimestamp()
    });
  },

  subscribeSpaces(householdId: string, onData: (state: SnapshotState<Space>) => void, onError: (e: Error) => void): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.spaces(householdId)), orderBy("name"));
    return onSnapshot(q, (snap) => onData(mapSnapshot<Space>(snap)), onError);
  },

  subscribeAreas(householdId: string, onData: (state: SnapshotState<Area>) => void, onError: (e: Error) => void): Unsubscribe {
    const database = requireDb();
    const areaStates = new Map<string, SnapshotState<Area>>();
    const areaUnsubs = new Map<string, Unsubscribe>();
    let spacesFromCache = true;
    let spacesHasPendingWrites = false;

    const emit = () => {
      const snapshots = Array.from(areaStates.values());
      onData({
        data: snapshots.flatMap((state) => state.data).sort((a, b) => a.name.localeCompare(b.name)),
        fromCache: spacesFromCache || snapshots.some((state) => state.fromCache),
        hasPendingWrites: spacesHasPendingWrites || snapshots.some((state) => state.hasPendingWrites)
      });
    };

    const spacesQuery = query(collection(database, householdPaths.spaces(householdId)), orderBy("name"));
    const spacesUnsub = onSnapshot(
      spacesQuery,
      (spacesSnap) => {
        spacesFromCache = spacesSnap.metadata.fromCache;
        spacesHasPendingWrites = spacesSnap.metadata.hasPendingWrites;
        const nextSpaceIds = new Set(spacesSnap.docs.map((spaceDoc) => spaceDoc.id));

        for (const [spaceId, unsub] of areaUnsubs.entries()) {
          if (nextSpaceIds.has(spaceId)) continue;
          unsub();
          areaUnsubs.delete(spaceId);
          areaStates.delete(spaceId);
        }

        for (const spaceDoc of spacesSnap.docs) {
          const spaceId = spaceDoc.id;
          if (areaUnsubs.has(spaceId)) continue;

          const areasQuery = query(collection(database, householdPaths.areas(householdId, spaceId)), orderBy("name"));
          const unsub = onSnapshot(
            areasQuery,
            (areasSnap) => {
              areaStates.set(spaceId, mapSnapshot<Area>(areasSnap));
              emit();
            },
            onError
          );
          areaUnsubs.set(spaceId, unsub);
        }

        emit();
      },
      onError
    );

    return () => {
      spacesUnsub();
      for (const unsub of areaUnsubs.values()) {
        unsub();
      }
    };
  },

  subscribeItems(
    householdId: string,
    onData: (state: SnapshotState<StoredItem>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.items(householdId)), orderBy("updatedAt", "desc"));
    return onSnapshot(
      q,
      (snap) =>
        onData({
          data: snap.docs.map((docSnap) => mapDoc<StoredItem>(docSnap)),
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        }),
      onError
    );
  },

  subscribeMembers(
    householdId: string,
    onData: (state: SnapshotState<HouseholdMember>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.members(householdId)), orderBy("createdAt", "asc"));
    return onSnapshot(
      q,
      (snap) =>
        onData({
          data: snap.docs.map((docSnap) => ({ uid: docSnap.id, ...(docSnap.data() as Omit<HouseholdMember, "uid">) })),
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        }),
      onError
    );
  },

  subscribeInvites(
    householdId: string,
    onData: (state: SnapshotState<HouseholdInvite>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.invites(householdId)), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => onData(mapSnapshot<HouseholdInvite>(snap)), onError);
  },

  subscribeLlmConfig(
    householdId: string,
    onData: (config: HouseholdLlmConfig | null, meta: { fromCache: boolean; hasPendingWrites: boolean }) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    return onSnapshot(
      doc(requireDb(), householdPaths.llmConfig(householdId)),
      (snap) => {
        onData(snap.exists() ? (snap.data() as HouseholdLlmConfig) : null, {
          fromCache: snap.metadata.fromCache,
          hasPendingWrites: snap.metadata.hasPendingWrites
        });
      },
      onError
    );
  },

  async createSpace(input: {
    householdId: string;
    userId: string;
    name: string;
    icon?: Space["icon"];
    color: string;
    image?: ImageRef;
    areas: Array<{ name: string; image?: ImageRef }>;
  }) {
    const database = requireDb();
    const spaceRef = doc(collection(database, householdPaths.spaces(input.householdId)));
    const batch = writeBatch(database);

    batch.set(spaceRef, {
      householdId: input.householdId,
      name: input.name,
      icon: input.icon ?? "box",
      color: input.color,
      image: input.image ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    for (const area of input.areas) {
      const areaRef = doc(collection(database, householdPaths.areas(input.householdId, spaceRef.id)));
      batch.set(areaRef, {
        householdId: input.householdId,
        spaceId: spaceRef.id,
        name: area.name,
        image: area.image ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    await batch.commit();
    return spaceRef.id;
  },

  async createArea(input: {
    householdId: string;
    spaceId: string;
    name: string;
    image?: ImageRef;
  }) {
    const areaRef = await addDoc(collection(requireDb(), householdPaths.areas(input.householdId, input.spaceId)), {
      householdId: input.householdId,
      spaceId: input.spaceId,
      name: input.name,
      image: input.image ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return areaRef.id;
  },

  async updateSpace(input: {
    householdId: string;
    spaceId: string;
    patch: Partial<Pick<Space, "name" | "icon" | "color">> & { image?: ImageRef | null };
  }) {
    await updateDoc(doc(requireDb(), householdPaths.space(input.householdId, input.spaceId)), {
      ...input.patch,
      updatedAt: serverTimestamp()
    });
  },

  async updateArea(input: {
    householdId: string;
    spaceId: string;
    areaId: string;
    patch: Partial<Pick<Area, "name">> & { image?: ImageRef | null };
  }) {
    await updateDoc(doc(requireDb(), householdPaths.area(input.householdId, input.spaceId, input.areaId)), {
      ...input.patch,
      updatedAt: serverTimestamp()
    });
  },

  async deleteArea(input: {
    householdId: string;
    spaceId: string;
    areaId: string;
    reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string };
    userId: string;
  }) {
    await deleteHouseholdArea({
      householdId: input.householdId,
      spaceId: input.spaceId,
      areaId: input.areaId,
      reassignTo: input.reassignTo
        ? { spaceId: input.reassignTo.spaceId, areaId: input.reassignTo.areaId }
        : undefined
    });
  },

  async deleteSpace(input: {
    householdId: string;
    spaceId: string;
    userId: string;
    reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string };
  }) {
    await deleteHouseholdSpace({
      householdId: input.householdId,
      spaceId: input.spaceId,
      reassignTo: input.reassignTo
        ? { spaceId: input.reassignTo.spaceId, areaId: input.reassignTo.areaId }
        : undefined
    });
  },

  async createItem(input: {
    householdId: string;
    userId: string;
    name: string;
    spaceId: string;
    areaId: string;
    areaNameSnapshot: string;
    kind?: Item["kind"];
    image?: ImageRef;
    value?: number;
    isPriceless?: boolean;
    tags?: string[];
    notes?: string;
    vision?: Item["vision"];
  }) {
    const itemRef = await addDoc(collection(requireDb(), householdPaths.items(input.householdId)), {
      householdId: input.householdId,
      spaceId: input.spaceId,
      areaId: input.areaId,
      areaNameSnapshot: input.areaNameSnapshot,
      name: input.name,
      kind: input.kind ?? "item",
      image: input.image ?? null,
      value: input.value ?? null,
      isPriceless: input.isPriceless ?? false,
      tags: input.tags ?? [],
      notes: input.notes ?? "",
      isPacked: false,
      vision: input.vision ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.userId,
      updatedBy: input.userId
    });
    return itemRef.id;
  },

  async updateItem(input: {
    householdId: string;
    itemId: string;
    userId: string;
    patch: Partial<
      Omit<
        Pick<Item, "name" | "notes" | "value" | "tags" | "isPacked" | "spaceId" | "areaId" | "areaNameSnapshot" | "kind" | "isPriceless">,
        "value"
      >
    > & {
      value?: number | null;
      image?: ImageRef | null;
    };
  }) {
    const patch = omitUndefinedFields(input.patch);
    await updateDoc(doc(requireDb(), householdPaths.item(input.householdId, input.itemId)), {
      ...patch,
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  },

  async togglePacked(input: { householdId: string; itemId: string; userId: string; nextValue: boolean }) {
    await inventoryRepository.updateItem({
      householdId: input.householdId,
      itemId: input.itemId,
      userId: input.userId,
      patch: { isPacked: input.nextValue }
    });
  },

  async deleteItem(input: { householdId: string; itemId: string; userId: string }) {
    await deleteHouseholdItem({
      householdId: input.householdId,
      itemId: input.itemId
    });
  },

  async updateMemberRole(input: { householdId: string; uid: string; role: HouseholdMember["role"] }) {
    await updateHouseholdMemberRole(input);
  },

  async removeMember(input: { householdId: string; uid: string }) {
    await removeHouseholdMember(input);
  },

  async revokeInvite(input: { householdId: string; inviteId: string }) {
    await revokeHouseholdInvite(input);
  },

  async addTagToItem(input: { householdId: string; itemId: string; userId: string; tag: string }) {
    await updateDoc(doc(requireDb(), householdPaths.item(input.householdId, input.itemId)), {
      tags: arrayUnion(input.tag),
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  },

  async saveLlmConfig(householdId: string, config: HouseholdLlmConfig) {
    await setDoc(doc(requireDb(), householdPaths.llmConfig(householdId)), config, { merge: true });
  },

  // ── Packing Lists ──────────────────────────────────────────────

  subscribePackingLists(
    householdId: string,
    onData: (state: SnapshotState<PackingList>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.packingLists(householdId)), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => onData(mapSnapshot<PackingList>(snap)), onError);
  },

  async createPackingList(input: {
    householdId: string;
    userId: string;
    name: string;
    itemIds: string[];
  }) {
    const result = await createHouseholdPackingList({
      householdId: input.householdId,
      name: input.name,
      itemIds: input.itemIds
    });
    return result.listId;
  },

  async updatePackingList(input: {
    householdId: string;
    listId: string;
    userId: string;
    patch: Partial<Pick<PackingList, "name" | "itemIds" | "packedItemIds">>;
  }) {
    await updateHouseholdPackingList({
      householdId: input.householdId,
      listId: input.listId,
      patch: input.patch
    });
  },

  async deletePackingList(input: { householdId: string; listId: string }) {
    await deleteHouseholdPackingList(input);
  },

  async togglePackingListItem(input: {
    householdId: string;
    listId: string;
    userId: string;
    itemId: string;
    packed: boolean;
  }) {
    await toggleHouseholdPackingListItem({
      householdId: input.householdId,
      listId: input.listId,
      itemId: input.itemId,
      packed: input.packed
    });
  },

  async clearPackingListPacked(input: { householdId: string; listId: string; userId: string }) {
    await clearHouseholdPackingListPacked({
      householdId: input.householdId,
      listId: input.listId
    });
  }
};
