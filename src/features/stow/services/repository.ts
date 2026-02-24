import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
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
import type { Area, Household, HouseholdInvite, HouseholdMember, ImageRef, Item, PackingList, Space } from "@/types/domain";
import type { HouseholdLlmConfig } from "@/types/llm";

export type SnapshotState<T> = {
  data: T[];
  fromCache: boolean;
  hasPendingWrites: boolean;
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
    const q = query(
      collectionGroup(requireDb(), "areas"),
      where("householdId", "==", householdId),
      orderBy("name")
    );
    return onSnapshot(q, (snap) => onData(mapSnapshot<Area>(snap)), onError);
  },

  subscribeItems(householdId: string, onData: (state: SnapshotState<Item>) => void, onError: (e: Error) => void): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.items(householdId)), orderBy("updatedAt", "desc"));
    return onSnapshot(q, (snap) => onData(mapSnapshot<Item>(snap)), onError);
  },

  subscribeMembers(
    householdId: string,
    onData: (state: SnapshotState<HouseholdMember>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.members(householdId)), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => onData(mapSnapshot<HouseholdMember>(snap)), onError);
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
    const database = requireDb();
    const itemsSnap = await getDocs(
      query(
        collection(database, householdPaths.items(input.householdId)),
        where("spaceId", "==", input.spaceId),
        where("areaId", "==", input.areaId)
      )
    );

    if (!itemsSnap.empty && !input.reassignTo) {
      throw new Error("Area contains items. Choose a destination first.");
    }

    const batch = writeBatch(database);
    if (input.reassignTo) {
      for (const itemDoc of itemsSnap.docs) {
        batch.update(itemDoc.ref, {
          spaceId: input.reassignTo.spaceId,
          areaId: input.reassignTo.areaId,
          areaNameSnapshot: input.reassignTo.areaNameSnapshot,
          updatedAt: serverTimestamp(),
          updatedBy: input.userId
        });
      }
    }

    batch.delete(doc(database, householdPaths.area(input.householdId, input.spaceId, input.areaId)));
    await batch.commit();
  },

  async deleteSpace(input: {
    householdId: string;
    spaceId: string;
    userId: string;
    reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string };
  }) {
    const database = requireDb();
    const [itemsSnap, areasSnap] = await Promise.all([
      getDocs(query(collection(database, householdPaths.items(input.householdId)), where("spaceId", "==", input.spaceId))),
      getDocs(collection(database, householdPaths.areas(input.householdId, input.spaceId)))
    ]);

    if (!itemsSnap.empty && !input.reassignTo) {
      throw new Error("Space contains items. Choose a destination space/area first.");
    }

    const batch = writeBatch(database);
    if (input.reassignTo) {
      for (const itemDoc of itemsSnap.docs) {
        batch.update(itemDoc.ref, {
          spaceId: input.reassignTo.spaceId,
          areaId: input.reassignTo.areaId,
          areaNameSnapshot: input.reassignTo.areaNameSnapshot,
          updatedAt: serverTimestamp(),
          updatedBy: input.userId
        });
      }
    }

    for (const areaDoc of areasSnap.docs) {
      batch.delete(areaDoc.ref);
    }
    batch.delete(doc(database, householdPaths.space(input.householdId, input.spaceId)));
    await batch.commit();
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
      Pick<Item, "name" | "notes" | "value" | "tags" | "isPacked" | "spaceId" | "areaId" | "areaNameSnapshot" | "kind" | "isPriceless">
    > & {
      image?: ImageRef | null;
    };
  }) {
    await updateDoc(doc(requireDb(), householdPaths.item(input.householdId, input.itemId)), {
      ...input.patch,
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

  async deleteItem(input: { householdId: string; itemId: string }) {
    await deleteDoc(doc(requireDb(), householdPaths.item(input.householdId, input.itemId)));
  },

  async updateMemberRole(input: { householdId: string; uid: string; role: HouseholdMember["role"] }) {
    await updateDoc(doc(requireDb(), householdPaths.member(input.householdId, input.uid)), {
      role: input.role
    });
  },

  async removeMember(input: { householdId: string; uid: string }) {
    await deleteDoc(doc(requireDb(), householdPaths.member(input.householdId, input.uid)));
  },

  async revokeInvite(input: { householdId: string; inviteId: string }) {
    await deleteDoc(doc(requireDb(), `${householdPaths.invites(input.householdId)}/${input.inviteId}`));
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
    const ref = await addDoc(collection(requireDb(), householdPaths.packingLists(input.householdId)), {
      householdId: input.householdId,
      name: input.name,
      itemIds: input.itemIds,
      packedItemIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.userId,
      updatedBy: input.userId
    });
    return ref.id;
  },

  async updatePackingList(input: {
    householdId: string;
    listId: string;
    userId: string;
    patch: Partial<Pick<PackingList, "name" | "itemIds" | "packedItemIds">>;
  }) {
    await updateDoc(doc(requireDb(), householdPaths.packingList(input.householdId, input.listId)), {
      ...input.patch,
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  },

  async deletePackingList(input: { householdId: string; listId: string }) {
    await deleteDoc(doc(requireDb(), householdPaths.packingList(input.householdId, input.listId)));
  },

  async togglePackingListItem(input: {
    householdId: string;
    listId: string;
    userId: string;
    itemId: string;
    packed: boolean;
  }) {
    await updateDoc(doc(requireDb(), householdPaths.packingList(input.householdId, input.listId)), {
      packedItemIds: input.packed ? arrayUnion(input.itemId) : arrayRemove(input.itemId),
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  },

  async clearPackingListPacked(input: { householdId: string; listId: string; userId: string }) {
    await updateDoc(doc(requireDb(), householdPaths.packingList(input.householdId, input.listId)), {
      packedItemIds: [],
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  }
};
