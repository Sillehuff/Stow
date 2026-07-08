import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  collectionGroup,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
  type WriteBatch
} from "firebase/firestore";
import type { Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { householdPaths } from "@/lib/firebase/paths";
import { defaultEntryMode, defaultItemStatus, defaultPhotoStatus } from "@/features/stow/services/itemMetadata";
import {
  removeHouseholdMember as callRemoveHouseholdMember,
  revokeHouseholdInvite as callRevokeHouseholdInvite,
  updateHouseholdMemberRole as callUpdateHouseholdMemberRole
} from "@/lib/firebase/functions";
import type {
  ActivityEntry,
  Area,
  Household,
  HouseholdInvite,
  HouseholdMember,
  ImageRef,
  Item,
  ItemDraft,
  ItemLoan,
  ItemStatus,
  PackingList,
  Space
} from "@/types/domain";
import type { HouseholdLlmConfig } from "@/types/llm";

export type SnapshotState<T> = {
  data: T[];
  fromCache: boolean;
  hasPendingWrites: boolean;
};

export interface NewBatchItem {
  name: string;
  spaceId: string;
  areaId: string;
  areaNameSnapshot: string;
  image?: ImageRef;
  value?: number;
  tags?: string[];
  notes?: string;
  vision?: Item["vision"];
}

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

/**
 * Like mapSnapshot, but drops docs that lack a string `name`. This guards malformed
 * docs from crashing the UI AND filters out the position-only stubs that reorderSpaces/
 * reorderAreas' set+merge can recreate after a concurrent delete (Task 4.11).
 */
function mapNamedSnapshot<T extends { name: string }>(snap: QuerySnapshot<DocumentData>): SnapshotState<T> {
  return {
    data: snap.docs
      .filter((docSnap) => typeof docSnap.data().name === "string")
      .map((docSnap) => mapDoc<T>(docSnap)),
    fromCache: snap.metadata.fromCache,
    hasPendingWrites: snap.metadata.hasPendingWrites
  };
}

/**
 * Incremental snapshot mapping for hot collections: re-map only the docs Firestore
 * reports as changed instead of re-normalizing every doc on every snapshot, and keep
 * unchanged elements referentially identical so memoized rows/screens can skip
 * re-rendering. One mapper instance per subscription — its cache dies with the
 * listener. `mapOne` may return null to drop a doc (malformed/stub filtering).
 */
function incrementalSnapshotMapper<T>(mapOne: (snap: { id: string; data(): DocumentData }) => T | null) {
  const byId = new Map<string, T>();
  return (snap: QuerySnapshot<DocumentData>): SnapshotState<T> => {
    for (const change of snap.docChanges()) {
      if (change.type === "removed") {
        byId.delete(change.doc.id);
      } else {
        const mapped = mapOne(change.doc);
        if (mapped === null) byId.delete(change.doc.id);
        else byId.set(change.doc.id, mapped);
      }
    }
    // snap.docs carries the query's ordering; assemble from cache so unchanged
    // entries keep identity. Docs the mapper dropped are skipped.
    const data: T[] = [];
    for (const docSnap of snap.docs) {
      const cached = byId.get(docSnap.id);
      if (cached !== undefined) data.push(cached);
    }
    return {
      data,
      fromCache: snap.metadata.fromCache,
      hasPendingWrites: snap.metadata.hasPendingWrites
    };
  };
}

function mapMemberSnapshot(snap: QuerySnapshot<DocumentData>): SnapshotState<HouseholdMember> {
  return {
    data: snap.docs.map((docSnap) => ({
      uid: docSnap.id,
      ...(docSnap.data() as Omit<HouseholdMember, "uid">)
    })),
    fromCache: snap.metadata.fromCache,
    hasPendingWrites: snap.metadata.hasPendingWrites
  };
}

export function normalizeItemDoc(snap: { id: string; data(): DocumentData }): Item {
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    ...(data as Omit<Item, "id" | "photoStatus" | "entryMode" | "status">),
    // Defensive read-boundary defaults: a malformed doc must not crash the UI.
    name: typeof data.name === "string" && data.name.trim() ? data.name : "Untitled item",
    notes: typeof data.notes === "string" ? data.notes : "",
    value: typeof data.value === "number" && Number.isFinite(data.value) ? data.value : null,
    status: defaultItemStatus({ status: data.status, isPacked: data.isPacked }),
    photoStatus: defaultPhotoStatus({ photoStatus: data.photoStatus, image: data.image }),
    entryMode: defaultEntryMode({ entryMode: data.entryMode, vision: data.vision })
  } as Item;
}

function normalizeItemDraftDoc(snap: { id: string; data(): DocumentData }): ItemDraft {
  const data = snap.data() as Record<string, unknown>;
  return {
    id: snap.id,
    ...(data as Omit<ItemDraft, "id" | "tags">),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : []
  } as ItemDraft;
}

function requireDb() {
  if (!db) throw new Error("Firestore is not configured");
  return db;
}

const STATUS_LABELS: Record<ItemStatus, string> = {
  home: "back home",
  packed: "packed",
  lent: "lent",
  repair: "in repair",
  lost: "missing"
};

function firstName(actorName: string): string {
  const trimmed = actorName.trim();
  if (!trimmed) return "Someone";
  return trimmed.split(/\s+/)[0];
}

function locationSuffix(spaceName?: string, areaName?: string): string {
  if (spaceName && areaName) return `${spaceName} › ${areaName}`;
  return spaceName ?? "";
}

export interface BuildActivityEntryInput {
  type: ActivityEntry["type"];
  actorUid: string;
  actorName: string;
  itemName?: string;
  spaceName?: string;
  areaName?: string;
  status?: ItemStatus;
  loanTo?: string;
  count?: number;
  spaceId?: string;
  areaId?: string;
  itemId?: string;
}

/**
 * Pure: builds the activity entry payload (everything except id/householdId/createdAt).
 * Optional id/count keys are only included when defined so Firestore never receives undefined.
 */
export function buildActivityEntry(
  input: BuildActivityEntryInput
): Omit<ActivityEntry, "id" | "householdId" | "createdAt"> {
  const who = firstName(input.actorName);
  const loc = locationSuffix(input.spaceName, input.areaName);
  let summary = "";
  switch (input.type) {
    case "item_added":
      summary = `${who} added ${input.itemName ?? "an item"}${loc ? ` to ${loc}` : ""}`;
      break;
    case "items_added_batch": {
      const n = input.count ?? 0;
      summary = `${who} added ${n} item${n === 1 ? "" : "s"}${loc ? ` to ${loc}` : ""}`;
      break;
    }
    case "item_moved":
      summary = `${who} moved ${input.itemName ?? "an item"}${loc ? ` to ${loc}` : ""}`;
      break;
    case "item_deleted":
      summary = `${who} deleted ${input.itemName ?? "an item"}`;
      break;
    case "item_status_changed": {
      const label = input.status ? STATUS_LABELS[input.status] : "updated";
      const to = input.status === "lent" && input.loanTo ? ` to ${input.loanTo}` : "";
      summary = `${who} marked ${input.itemName ?? "an item"} ${label}${to}`;
      break;
    }
    case "space_added":
      summary = `${who} added the ${input.spaceName ?? "new"} space`;
      break;
    case "space_deleted":
      summary = `${who} deleted the ${input.spaceName ?? ""} space`.replace("  ", " ");
      break;
  }

  const entry: Omit<ActivityEntry, "id" | "householdId" | "createdAt"> = {
    type: input.type,
    actorUid: input.actorUid,
    actorName: input.actorName,
    summary
  };
  if (input.spaceId !== undefined) entry.spaceId = input.spaceId;
  if (input.areaId !== undefined) entry.areaId = input.areaId;
  if (input.itemId !== undefined) entry.itemId = input.itemId;
  if (input.count !== undefined) entry.count = input.count;
  return entry;
}

/** Pure: map an ordered id list to {id, position} pairs (position = index). Unit-tested. */
export function positionUpdatesFor(orderedIds: string[]): Array<{ id: string; position: number }> {
  return orderedIds.map((id, index) => ({ id, position: index }));
}

/** Firestore batches cap at 500 ops; stay under it with headroom. */
export function chunkOps<T>(ops: T[], size = 450): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < ops.length; i += size) chunks.push(ops.slice(i, i + size));
  return chunks;
}

export const inventoryRepository = {
  createSpaceId(householdId: string) {
    return doc(collection(requireDb(), householdPaths.spaces(householdId))).id;
  },

  createAreaId(householdId: string, spaceId: string) {
    return doc(collection(requireDb(), householdPaths.areas(householdId, spaceId))).id;
  },

  createItemId(householdId: string) {
    return doc(collection(requireDb(), householdPaths.items(householdId))).id;
  },

  createItemDraftId(householdId: string) {
    return doc(collection(requireDb(), householdPaths.itemDrafts(householdId))).id;
  },

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
    return onSnapshot(q, (snap) => onData(mapNamedSnapshot<Space>(snap)), onError);
  },

  subscribeAreas(householdId: string, onData: (state: SnapshotState<Area>) => void, onError: (e: Error) => void): Unsubscribe {
    const q = query(
      collectionGroup(requireDb(), "areas"),
      where("householdId", "==", householdId),
      orderBy("name")
    );
    return onSnapshot(q, (snap) => onData(mapNamedSnapshot<Area>(snap)), onError);
  },

  subscribeItems(householdId: string, onData: (state: SnapshotState<Item>) => void, onError: (e: Error) => void): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.items(householdId)), orderBy("updatedAt", "desc"));
    const mapIncremental = incrementalSnapshotMapper<Item>((docSnap) => normalizeItemDoc(docSnap));
    return onSnapshot(q, (snap) => onData(mapIncremental(snap)), onError);
  },

  subscribeItemDrafts(
    householdId: string,
    onData: (state: SnapshotState<ItemDraft>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(collection(requireDb(), householdPaths.itemDrafts(householdId)), orderBy("updatedAt", "desc"));
    return onSnapshot(
      q,
      (snap) =>
        onData({
          data: snap.docs.map((docSnap) => normalizeItemDraftDoc(docSnap)),
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
    return onSnapshot(q, (snap) => onData(mapMemberSnapshot(snap)), onError);
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
    spaceId?: string;
    name: string;
    icon?: Space["icon"];
    color: string;
    image?: ImageRef;
    position?: number;
    areas: Array<{ name: string; image?: ImageRef }>;
  }) {
    const database = requireDb();
    const spaceRef = input.spaceId
      ? doc(collection(database, householdPaths.spaces(input.householdId)), input.spaceId)
      : doc(collection(database, householdPaths.spaces(input.householdId)));
    const batch = writeBatch(database);

    batch.set(spaceRef, {
      householdId: input.householdId,
      name: input.name,
      icon: input.icon ?? "box",
      color: input.color,
      image: input.image ?? null,
      position: input.position ?? Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    input.areas.forEach((area, index) => {
      const areaRef = doc(collection(database, householdPaths.areas(input.householdId, spaceRef.id)));
      batch.set(areaRef, {
        householdId: input.householdId,
        spaceId: spaceRef.id,
        name: area.name,
        image: area.image ?? null,
        position: index,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });

    await batch.commit();
    return spaceRef.id;
  },

  async createArea(input: {
    householdId: string;
    spaceId: string;
    areaId?: string;
    name: string;
    image?: ImageRef;
    position?: number;
  }) {
    const areaRef = input.areaId
      ? doc(collection(requireDb(), householdPaths.areas(input.householdId, input.spaceId)), input.areaId)
      : doc(collection(requireDb(), householdPaths.areas(input.householdId, input.spaceId)));
    await setDoc(areaRef, {
      householdId: input.householdId,
      spaceId: input.spaceId,
      name: input.name,
      image: input.image ?? null,
      position: input.position ?? Date.now(),
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

  async reorderSpaces(input: { householdId: string; orderedIds: string[] }) {
    const database = requireDb();
    const batch = writeBatch(database);
    for (const { id, position } of positionUpdatesFor(input.orderedIds)) {
      // set+merge (not update): update rejects the whole batch if any id was deleted
      // on another device mid-drag; set+merge still writes positions for the survivors.
      batch.set(
        doc(database, householdPaths.space(input.householdId, id)),
        { position, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
  },

  async reorderAreas(input: { householdId: string; spaceId: string; orderedIds: string[] }) {
    const database = requireDb();
    const batch = writeBatch(database);
    for (const { id, position } of positionUpdatesFor(input.orderedIds)) {
      // set+merge (not update): tolerate a concurrent delete of any area mid-drag.
      batch.set(
        doc(database, householdPaths.area(input.householdId, input.spaceId, id)),
        { position, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();
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

    // Build the write set as ordered closures, then commit in <=450-op chunks so a
    // space with hundreds of items/areas survives Firestore's 500-op batch limit.
    // Order is load-bearing: item reassigns → area deletes → space delete LAST, so a
    // mid-way failure never leaves a deleted space with orphaned children.
    const ops: Array<(batch: WriteBatch) => void> = [];
    if (input.reassignTo) {
      const reassignTo = input.reassignTo;
      for (const itemDoc of itemsSnap.docs) {
        ops.push((batch) =>
          batch.update(itemDoc.ref, {
            spaceId: reassignTo.spaceId,
            areaId: reassignTo.areaId,
            areaNameSnapshot: reassignTo.areaNameSnapshot,
            updatedAt: serverTimestamp(),
            updatedBy: input.userId
          })
        );
      }
    }

    for (const areaDoc of areasSnap.docs) {
      ops.push((batch) => batch.delete(areaDoc.ref));
    }
    ops.push((batch) => batch.delete(doc(database, householdPaths.space(input.householdId, input.spaceId))));

    for (const chunk of chunkOps(ops)) {
      const batch = writeBatch(database);
      chunk.forEach((apply) => apply(batch));
      await batch.commit();
    }
  },

  async createItem(input: {
    householdId: string;
    userId: string;
    itemId?: string;
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
    photoStatus?: Item["photoStatus"];
    entryMode?: Item["entryMode"];
  }) {
    const itemRef = input.itemId
      ? doc(collection(requireDb(), householdPaths.items(input.householdId)), input.itemId)
      : doc(collection(requireDb(), householdPaths.items(input.householdId)));
    await setDoc(itemRef, {
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
      status: "home",
      photoStatus: defaultPhotoStatus({ photoStatus: input.photoStatus, image: input.image }),
      entryMode: defaultEntryMode({ entryMode: input.entryMode, vision: input.vision }),
      vision: input.vision ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.userId,
      updatedBy: input.userId
    });
    return itemRef.id;
  },

  async createItemsBatch(input: {
    householdId: string;
    userId: string;
    items: NewBatchItem[];
  }): Promise<string[]> {
    if (input.items.length === 0) return [];
    const database = requireDb();
    // Pre-generate refs (keeps the returned id list complete/ordered), then commit in
    // <=450-op chunks so a batch of 500+ items survives Firestore's 500-op limit instead
    // of throwing. Mirrors deleteSpace's chunked pattern. Writes are no longer atomic across
    // chunks, but that is strictly better than today's all-or-nothing throw.
    const ids: string[] = [];
    const ops: Array<(batch: WriteBatch) => void> = [];
    for (const item of input.items) {
      const itemRef = doc(collection(database, householdPaths.items(input.householdId)));
      ids.push(itemRef.id);
      // Mirrors createItem defaults. P4 will wire items_added_batch activity at the QuickCapture call site.
      ops.push((batch) =>
        batch.set(itemRef, {
          householdId: input.householdId,
          spaceId: item.spaceId,
          areaId: item.areaId,
          areaNameSnapshot: item.areaNameSnapshot,
          name: item.name,
          kind: "item",
          image: item.image ?? null,
          value: item.value ?? null,
          isPriceless: false,
          tags: item.tags ?? [],
          notes: item.notes ?? "",
          isPacked: false,
          status: "home",
          photoStatus: defaultPhotoStatus({ image: item.image }),
          entryMode: defaultEntryMode({ vision: item.vision }),
          vision: item.vision ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: input.userId,
          updatedBy: input.userId
        })
      );
    }
    for (const chunk of chunkOps(ops)) {
      const batch = writeBatch(database);
      chunk.forEach((apply) => apply(batch));
      await batch.commit();
    }
    return ids;
  },

  async updateItem(input: {
    householdId: string;
    itemId: string;
    userId: string;
    patch: Partial<
      Pick<Item, "name" | "notes" | "value" | "tags" | "isPacked" | "status" | "spaceId" | "areaId" | "areaNameSnapshot" | "kind" | "isPriceless">
    > & {
      image?: ImageRef | null;
      loan?: ItemLoan | null;
      photoStatus?: Item["photoStatus"];
      entryMode?: Item["entryMode"];
      vision?: Item["vision"] | null;
    };
  }) {
    // Strip undefined-valued keys: updateDoc throws on any undefined field (the
    // client sets no ignoreUndefinedProperties), and callers building patches from
    // optional inputs have shipped exactly that crash before. "Clear this field"
    // must be expressed as null, never undefined.
    const patch = Object.fromEntries(Object.entries(input.patch).filter(([, value]) => value !== undefined));
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
    const database = requireDb();
    const packingListsRef = collection(database, householdPaths.packingLists(input.householdId));
    const [itemListsSnap, packedListsSnap] = await Promise.all([
      getDocs(query(packingListsRef, where("itemIds", "array-contains", input.itemId))),
      getDocs(query(packingListsRef, where("packedItemIds", "array-contains", input.itemId)))
    ]);

    const batch = writeBatch(database);
    const touchedListIds = new Set<string>();
    for (const listDoc of [...itemListsSnap.docs, ...packedListsSnap.docs]) {
      if (touchedListIds.has(listDoc.id)) continue;
      touchedListIds.add(listDoc.id);
      batch.update(listDoc.ref, {
        itemIds: arrayRemove(input.itemId),
        packedItemIds: arrayRemove(input.itemId),
        updatedAt: serverTimestamp(),
        updatedBy: input.userId
      });
    }

    batch.delete(doc(database, householdPaths.item(input.householdId, input.itemId)));
    await batch.commit();
  },

  async updateMemberRole(input: { householdId: string; uid: string; role: HouseholdMember["role"] }) {
    await callUpdateHouseholdMemberRole(input);
  },

  async removeMember(input: { householdId: string; uid: string }) {
    await callRemoveHouseholdMember(input);
  },

  async revokeInvite(input: { householdId: string; inviteId: string }) {
    await callRevokeHouseholdInvite(input);
  },

  async addTagToItem(input: { householdId: string; itemId: string; userId: string; tag: string }) {
    await updateDoc(doc(requireDb(), householdPaths.item(input.householdId, input.itemId)), {
      tags: arrayUnion(input.tag),
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  },

  async createItemDraft(input: {
    householdId: string;
    userId: string;
    draftId?: string;
    image: ImageRef;
    spaceId?: string;
    areaId?: string;
    areaNameSnapshot?: string;
    name?: string;
    kind?: ItemDraft["kind"];
    tags?: string[];
    notes?: string;
    vision?: ItemDraft["vision"];
  }) {
    const draftRef = input.draftId
      ? doc(collection(requireDb(), householdPaths.itemDrafts(input.householdId)), input.draftId)
      : doc(collection(requireDb(), householdPaths.itemDrafts(input.householdId)));
    await setDoc(draftRef, {
      householdId: input.householdId,
      image: input.image,
      spaceId: input.spaceId ?? null,
      areaId: input.areaId ?? null,
      areaNameSnapshot: input.areaNameSnapshot ?? null,
      name: input.name ?? "",
      kind: input.kind ?? "item",
      tags: input.tags ?? [],
      notes: input.notes ?? "",
      vision: input.vision ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.userId,
      updatedBy: input.userId
    });
    return draftRef.id;
  },

  async updateItemDraft(input: {
    householdId: string;
    draftId: string;
    userId: string;
    patch: Partial<Pick<ItemDraft, "name" | "spaceId" | "areaId" | "areaNameSnapshot" | "kind" | "tags" | "notes" | "vision">> & {
      image?: ImageRef | null;
    };
  }) {
    await updateDoc(doc(requireDb(), householdPaths.itemDraft(input.householdId, input.draftId)), {
      ...input.patch,
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  },

  async completeItemDraft(input: {
    householdId: string;
    userId: string;
    draftId: string;
    itemId?: string;
    name: string;
    spaceId: string;
    areaId: string;
    areaNameSnapshot: string;
    kind?: Item["kind"];
    image: ImageRef;
    value?: number;
    isPriceless?: boolean;
    tags?: string[];
    notes?: string;
    vision?: Item["vision"];
  }) {
    const database = requireDb();
    const itemRef = input.itemId
      ? doc(collection(database, householdPaths.items(input.householdId)), input.itemId)
      : doc(collection(database, householdPaths.items(input.householdId)));
    const batch = writeBatch(database);
    batch.set(itemRef, {
      householdId: input.householdId,
      spaceId: input.spaceId,
      areaId: input.areaId,
      areaNameSnapshot: input.areaNameSnapshot,
      name: input.name,
      kind: input.kind ?? "item",
      image: input.image,
      value: input.value ?? null,
      isPriceless: input.isPriceless ?? false,
      tags: input.tags ?? [],
      notes: input.notes ?? "",
      isPacked: false,
      status: "home",
      photoStatus: "attached",
      entryMode: "photo_draft",
      vision: input.vision ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: input.userId,
      updatedBy: input.userId
    });
    batch.delete(doc(database, householdPaths.itemDraft(input.householdId, input.draftId)));
    await batch.commit();
    return itemRef.id;
  },

  async deleteItemDraft(input: { householdId: string; draftId: string }) {
    await deleteDoc(doc(requireDb(), householdPaths.itemDraft(input.householdId, input.draftId)));
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
    const mapIncremental = incrementalSnapshotMapper<PackingList>((docSnap) => mapDoc<PackingList>(docSnap));
    return onSnapshot(q, (snap) => onData(mapIncremental(snap)), onError);
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
  },

  // ── Activity feed ──────────────────────────────────────────────

  async logActivity(input: {
    householdId: string;
    entry: Omit<ActivityEntry, "id" | "householdId" | "createdAt">;
  }) {
    await addDoc(collection(requireDb(), householdPaths.activity(input.householdId)), {
      ...input.entry,
      householdId: input.householdId,
      createdAt: serverTimestamp()
    });
  },

  subscribeActivity(
    householdId: string,
    max: number,
    onData: (state: SnapshotState<ActivityEntry>) => void,
    onError: (e: Error) => void
  ): Unsubscribe {
    const q = query(
      collection(requireDb(), householdPaths.activity(householdId)),
      orderBy("createdAt", "desc"),
      limit(max)
    );
    const mapIncremental = incrementalSnapshotMapper<ActivityEntry>((docSnap) => mapDoc<ActivityEntry>(docSnap));
    return onSnapshot(q, (snap) => onData(mapIncremental(snap)), onError);
  },

  // ── Item status & lending ──────────────────────────────────────

  async setItemStatus(input: { householdId: string; itemId: string; userId: string; status: ItemStatus }) {
    await inventoryRepository.updateItem({
      householdId: input.householdId,
      itemId: input.itemId,
      userId: input.userId,
      patch: { status: input.status }
    });
  },

  async setItemLoan(input: { householdId: string; itemId: string; userId: string; loan: ItemLoan }) {
    await inventoryRepository.updateItem({
      householdId: input.householdId,
      itemId: input.itemId,
      userId: input.userId,
      patch: { status: "lent", loan: input.loan }
    });
  },

  async clearItemLoan(input: { householdId: string; itemId: string; userId: string; nextStatus?: ItemStatus }) {
    await updateDoc(doc(requireDb(), householdPaths.item(input.householdId, input.itemId)), {
      status: input.nextStatus ?? "home",
      loan: deleteField(),
      updatedAt: serverTimestamp(),
      updatedBy: input.userId
    });
  }
};
