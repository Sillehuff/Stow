import { HttpsError } from "firebase-functions/v2/https";
import { requireHouseholdAdmin, requireHouseholdMember } from "./shared/authz.js";
import { FieldValue, db, paths } from "./shared/firestore.js";
import {
  clearPackingListPackedInputSchema,
  createPackingListInputSchema,
  deleteAreaInputSchema,
  deleteItemInputSchema,
  deletePackingListInputSchema,
  deleteSpaceInputSchema,
  togglePackingListItemInputSchema,
  updatePackingListInputSchema
} from "./shared/schemas.js";

type DeleteDestination = {
  spaceId: string;
  areaId: string;
};

type LockedDeleteTarget = {
  spaceId: string | null;
  areaId: string | null;
};

const AREA_DELETE_FAILURE_MESSAGE =
  "Delete started but cleanup did not finish. The area stays protected so no items are orphaned. Retry delete to finish cleanup.";
const SPACE_DELETE_FAILURE_MESSAGE =
  "Delete started but cleanup did not finish. The space stays protected so no items are orphaned. Retry delete to finish cleanup.";
const ITEM_DELETE_FAILURE_MESSAGE =
  "Delete started but cleanup did not finish. The item stays hidden so packing-list data is preserved. Retry delete to finish cleanup.";

function chunkArray<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function normalizeIdList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const result: string[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || result.includes(value)) continue;
    result.push(value);
  }
  return result;
}

function filterPackedItemIds(values: unknown, itemIds: string[]) {
  const allowedIds = new Set(itemIds);
  return normalizeIdList(values).filter((itemId) => allowedIds.has(itemId));
}

function getOptionalString(snap: FirebaseFirestore.DocumentSnapshot, field: string): string | null {
  const value = snap.get(field);
  return typeof value === "string" && value.length > 0 ? value : null;
}

function getRequiredString(snap: FirebaseFirestore.DocumentSnapshot, field: string, errorMessage: string): string {
  const value = getOptionalString(snap, field);
  if (!value) {
    throw new HttpsError("failed-precondition", errorMessage);
  }
  return value;
}

function readDeleteTarget(snap: FirebaseFirestore.DocumentSnapshot): LockedDeleteTarget | null {
  if (!snap.get("deletingAt")) return null;
  return {
    spaceId: getOptionalString(snap, "deleteTargetSpaceId"),
    areaId: getOptionalString(snap, "deleteTargetAreaId")
  };
}

function sameDeleteTarget(current: LockedDeleteTarget | null, requested?: DeleteDestination) {
  return (
    (current?.spaceId ?? null) === (requested?.spaceId ?? null) &&
    (current?.areaId ?? null) === (requested?.areaId ?? null)
  );
}

async function canRetargetLockedDelete(
  transaction: FirebaseFirestore.Transaction,
  householdId: string,
  current: LockedDeleteTarget | null,
  requested?: DeleteDestination
) {
  if (!current || sameDeleteTarget(current, requested)) {
    return false;
  }

  if (!current.spaceId || !current.areaId || !requested) {
    throw new HttpsError("failed-precondition", "Deletion is already in progress. Refresh and try again.");
  }

  try {
    await assertDestinationReady(transaction, householdId, {
      spaceId: current.spaceId,
      areaId: current.areaId
    });
  } catch {
    return true;
  }

  throw new HttpsError("failed-precondition", "Deletion is already in progress. Refresh and try again.");
}

function lockForDelete(
  transaction: FirebaseFirestore.Transaction,
  ref: FirebaseFirestore.DocumentReference,
  actingUid: string,
  target?: DeleteDestination
) {
  const payload: Record<string, unknown> = {
    deletingAt: FieldValue.serverTimestamp(),
    deletingBy: actingUid,
    updatedAt: FieldValue.serverTimestamp()
  };

  if (target) {
    payload.deleteTargetSpaceId = target.spaceId;
    payload.deleteTargetAreaId = target.areaId;
  }

  transaction.set(ref, payload, { merge: true });
}

async function clearDeleteLock(ref: FirebaseFirestore.DocumentReference) {
  await ref.set(
    {
      deletingAt: FieldValue.delete(),
      deletingBy: FieldValue.delete(),
      deleteTargetSpaceId: FieldValue.delete(),
      deleteTargetAreaId: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

function toDeleteFailure(error: unknown, message: string): HttpsError {
  if (error instanceof HttpsError) {
    return error;
  }
  return new HttpsError("aborted", message);
}

async function ensureActiveItemsExist(
  transaction: FirebaseFirestore.Transaction,
  householdId: string,
  itemIds: string[]
) {
  const uniqueIds = normalizeIdList(itemIds);
  for (const itemId of uniqueIds) {
    const itemSnap = await transaction.get(db.doc(paths.item(householdId, itemId)));
    if (!itemSnap.exists) {
      throw new HttpsError("failed-precondition", "One or more selected items no longer exist. Refresh and try again.");
    }
    if (
      getRequiredString(itemSnap, "householdId", "Item is invalid") !== householdId ||
      itemSnap.get("deletedAt")
    ) {
      throw new HttpsError("failed-precondition", "One or more selected items no longer exist. Refresh and try again.");
    }
  }
  return uniqueIds;
}

async function assertDestinationReady(
  transaction: FirebaseFirestore.Transaction,
  householdId: string,
  target: DeleteDestination
) {
  const targetSpaceRef = db.doc(paths.space(householdId, target.spaceId));
  const targetAreaRef = db.doc(paths.area(householdId, target.spaceId, target.areaId));
  const [targetSpaceSnap, targetAreaSnap] = await Promise.all([
    transaction.get(targetSpaceRef),
    transaction.get(targetAreaRef)
  ]);

  if (
    !targetSpaceSnap.exists ||
    getRequiredString(targetSpaceSnap, "householdId", "Destination space is invalid") !== householdId
  ) {
    throw new HttpsError("failed-precondition", "Destination space no longer exists. Refresh and try again.");
  }
  if (targetSpaceSnap.get("deletingAt")) {
    throw new HttpsError("failed-precondition", "Destination space is being deleted. Refresh and try again.");
  }

  if (
    !targetAreaSnap.exists ||
    getRequiredString(targetAreaSnap, "householdId", "Destination area is invalid") !== householdId ||
    getRequiredString(targetAreaSnap, "spaceId", "Destination area is invalid") !== target.spaceId
  ) {
    throw new HttpsError("failed-precondition", "Destination area no longer exists. Refresh and try again.");
  }
  if (targetAreaSnap.get("deletingAt")) {
    throw new HttpsError("failed-precondition", "Destination area is being deleted. Refresh and try again.");
  }

  return getRequiredString(targetAreaSnap, "name", "Destination area is invalid");
}

export async function deleteAreaHandler(raw: unknown, actingUid: string) {
  const input = deleteAreaInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, actingUid);

  const areaRef = db.doc(paths.area(input.householdId, input.spaceId, input.areaId));
  const { areaExists, targetAreaName } = await db.runTransaction(async (transaction) => {
    const areaSnap = await transaction.get(areaRef);
    if (!areaSnap.exists) {
      return { areaExists: false, targetAreaName: null as string | null };
    }

    if (
      getRequiredString(areaSnap, "householdId", "Area is invalid") !== input.householdId ||
      getRequiredString(areaSnap, "spaceId", "Area is invalid") !== input.spaceId
    ) {
      throw new HttpsError("not-found", "Area not found");
    }
    const currentDeleteTarget = readDeleteTarget(areaSnap);
    const retargetLockedDelete = await canRetargetLockedDelete(
      transaction,
      input.householdId,
      currentDeleteTarget,
      input.reassignTo
    );

    let nextAreaName: string | null = null;
    if (input.reassignTo) {
      if (input.reassignTo.spaceId === input.spaceId && input.reassignTo.areaId === input.areaId) {
        throw new HttpsError("failed-precondition", "Choose a different destination area.");
      }
      nextAreaName = await assertDestinationReady(transaction, input.householdId, input.reassignTo);
    }

    if (!areaSnap.get("deletingAt") || retargetLockedDelete) {
      lockForDelete(transaction, areaRef, actingUid, input.reassignTo);
    }

    return { areaExists: true, targetAreaName: nextAreaName };
  });

  if (!areaExists) {
    return { ok: true as const };
  }

  const itemsSnap = await db
    .collection(paths.items(input.householdId))
    .where("spaceId", "==", input.spaceId)
    .where("areaId", "==", input.areaId)
    .get();
  const activeItems = itemsSnap.docs.filter((itemDoc) => !itemDoc.get("deletedAt"));

  if (activeItems.length > 0 && !input.reassignTo) {
    try {
      await clearDeleteLock(areaRef);
    } catch {
      // A retry will attempt to clear the lock again before finishing cleanup.
    }
    throw new HttpsError("failed-precondition", "Area contains items. Choose a destination first.");
  }

  try {
    if (input.reassignTo && targetAreaName) {
      for (const chunk of chunkArray(activeItems, 450)) {
        await db.runTransaction(async (transaction) => {
          await assertDestinationReady(transaction, input.householdId, input.reassignTo!);
          for (const itemDoc of chunk) {
            transaction.update(itemDoc.ref, {
              spaceId: input.reassignTo!.spaceId,
              areaId: input.reassignTo!.areaId,
              areaNameSnapshot: targetAreaName,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: actingUid
            });
          }
        });
      }
    }

    await areaRef.delete();
  } catch (error) {
    throw toDeleteFailure(error, AREA_DELETE_FAILURE_MESSAGE);
  }

  return { ok: true as const };
}

export async function deleteSpaceHandler(raw: unknown, actingUid: string) {
  const input = deleteSpaceInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, actingUid);

  const spaceRef = db.doc(paths.space(input.householdId, input.spaceId));
  const { spaceExists, targetAreaName } = await db.runTransaction(async (transaction) => {
    const spaceSnap = await transaction.get(spaceRef);
    if (!spaceSnap.exists) {
      return { spaceExists: false, targetAreaName: null as string | null };
    }

    if (getRequiredString(spaceSnap, "householdId", "Space is invalid") !== input.householdId) {
      throw new HttpsError("not-found", "Space not found");
    }
    const currentDeleteTarget = readDeleteTarget(spaceSnap);
    const retargetLockedDelete = await canRetargetLockedDelete(
      transaction,
      input.householdId,
      currentDeleteTarget,
      input.reassignTo
    );

    let nextAreaName: string | null = null;
    if (input.reassignTo) {
      if (input.reassignTo.spaceId === input.spaceId) {
        throw new HttpsError("failed-precondition", "Choose a destination in a different space.");
      }
      nextAreaName = await assertDestinationReady(transaction, input.householdId, input.reassignTo);
    }

    if (!spaceSnap.get("deletingAt") || retargetLockedDelete) {
      lockForDelete(transaction, spaceRef, actingUid, input.reassignTo);
    }

    return { spaceExists: true, targetAreaName: nextAreaName };
  });

  if (!spaceExists) {
    return { ok: true as const };
  }

  const [itemsSnap, areasSnap] = await Promise.all([
    db.collection(paths.items(input.householdId)).where("spaceId", "==", input.spaceId).get(),
    db.collection(paths.areas(input.householdId, input.spaceId)).get()
  ]);
  const activeItems = itemsSnap.docs.filter((itemDoc) => !itemDoc.get("deletedAt"));

  if (activeItems.length > 0 && !input.reassignTo) {
    try {
      await clearDeleteLock(spaceRef);
    } catch {
      // A retry will attempt to clear the lock again before finishing cleanup.
    }
    throw new HttpsError("failed-precondition", "Space contains items. Choose a destination space/area first.");
  }

  try {
    if (input.reassignTo && targetAreaName) {
      for (const chunk of chunkArray(activeItems, 450)) {
        await db.runTransaction(async (transaction) => {
          await assertDestinationReady(transaction, input.householdId, input.reassignTo!);
          for (const itemDoc of chunk) {
            transaction.update(itemDoc.ref, {
              spaceId: input.reassignTo!.spaceId,
              areaId: input.reassignTo!.areaId,
              areaNameSnapshot: targetAreaName,
              updatedAt: FieldValue.serverTimestamp(),
              updatedBy: actingUid
            });
          }
        });
      }
    }

    for (const chunk of chunkArray(areasSnap.docs, 450)) {
      const batch = db.batch();
      for (const areaDoc of chunk) {
        batch.delete(areaDoc.ref);
      }
      await batch.commit();
    }

    await spaceRef.delete();
  } catch (error) {
    throw toDeleteFailure(error, SPACE_DELETE_FAILURE_MESSAGE);
  }

  return { ok: true as const };
}

export async function deleteItemHandler(raw: unknown, actingUid: string) {
  const input = deleteItemInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, actingUid);

  const itemRef = db.doc(paths.item(input.householdId, input.itemId));
  const itemExists = await db.runTransaction(async (transaction) => {
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists) {
      return false;
    }

    if (getRequiredString(itemSnap, "householdId", "Item is invalid") !== input.householdId) {
      throw new HttpsError("not-found", "Item not found");
    }

    if (!itemSnap.get("deletedAt")) {
      transaction.set(
        itemRef,
        {
          deletedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actingUid
        },
        { merge: true }
      );
    }

    return true;
  });

  if (!itemExists) {
    return { ok: true as const };
  }

  try {
    const packingLists = db.collection(paths.packingLists(input.householdId));
    const [itemListsSnap, packedListsSnap] = await Promise.all([
      packingLists.where("itemIds", "array-contains", input.itemId).get(),
      packingLists.where("packedItemIds", "array-contains", input.itemId).get()
    ]);

    const affectedLists = new Map<string, FirebaseFirestore.DocumentReference>();
    for (const listDoc of [...itemListsSnap.docs, ...packedListsSnap.docs]) {
      affectedLists.set(listDoc.id, listDoc.ref);
    }

    const listChunks = chunkArray([...affectedLists.values()], 450);
    if (listChunks.length === 0) {
      await itemRef.delete();
      return { ok: true as const };
    }

    for (const [index, chunk] of listChunks.entries()) {
      const batch = db.batch();
      for (const listRef of chunk) {
        batch.update(listRef, {
          itemIds: FieldValue.arrayRemove(input.itemId),
          packedItemIds: FieldValue.arrayRemove(input.itemId),
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: actingUid
        });
      }
      if (index === listChunks.length - 1) {
        batch.delete(itemRef);
      }
      await batch.commit();
    }
  } catch (error) {
    throw toDeleteFailure(error, ITEM_DELETE_FAILURE_MESSAGE);
  }

  return { ok: true as const };
}

export async function createPackingListHandler(raw: unknown, actingUid: string) {
  const input = createPackingListInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, actingUid);

  const listRef = db.collection(paths.packingLists(input.householdId)).doc();
  await db.runTransaction(async (transaction) => {
    const itemIds = await ensureActiveItemsExist(transaction, input.householdId, input.itemIds);
    transaction.set(listRef, {
      householdId: input.householdId,
      name: input.name,
      itemIds,
      packedItemIds: [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: actingUid,
      updatedBy: actingUid
    });
  });

  return { ok: true as const, listId: listRef.id };
}

export async function updatePackingListHandler(raw: unknown, actingUid: string) {
  const input = updatePackingListInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, actingUid);

  const listRef = db.doc(paths.packingList(input.householdId, input.listId));
  await db.runTransaction(async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists) {
      throw new HttpsError("not-found", "Packing list not found");
    }
    if (getRequiredString(listSnap, "householdId", "Packing list is invalid") !== input.householdId) {
      throw new HttpsError("not-found", "Packing list not found");
    }

    const currentItemIds = normalizeIdList(listSnap.get("itemIds"));
    const currentPackedItemIds = filterPackedItemIds(listSnap.get("packedItemIds"), currentItemIds);
    const nextItemIds =
      input.itemIds !== undefined
        ? await ensureActiveItemsExist(transaction, input.householdId, input.itemIds)
        : currentItemIds;
    const nextPackedItemIds =
      input.packedItemIds !== undefined
        ? filterPackedItemIds(input.packedItemIds, nextItemIds)
        : filterPackedItemIds(currentPackedItemIds, nextItemIds);

    const nextPatch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actingUid
    };

    if (input.name !== undefined) {
      nextPatch.name = input.name;
    }
    if (input.itemIds !== undefined || input.packedItemIds !== undefined) {
      nextPatch.itemIds = nextItemIds;
      nextPatch.packedItemIds = nextPackedItemIds;
    }

    transaction.update(listRef, nextPatch);
  });

  return { ok: true as const };
}

export async function deletePackingListHandler(raw: unknown, actingUid: string) {
  const input = deletePackingListInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, actingUid);

  await db.doc(paths.packingList(input.householdId, input.listId)).delete();
  return { ok: true as const };
}

export async function togglePackingListItemHandler(raw: unknown, actingUid: string) {
  const input = togglePackingListItemInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, actingUid);

  const listRef = db.doc(paths.packingList(input.householdId, input.listId));
  const itemRef = db.doc(paths.item(input.householdId, input.itemId));

  await db.runTransaction(async (transaction) => {
    const [listSnap, itemSnap] = await Promise.all([transaction.get(listRef), transaction.get(itemRef)]);
    if (!listSnap.exists) {
      throw new HttpsError("not-found", "Packing list not found");
    }
    if (getRequiredString(listSnap, "householdId", "Packing list is invalid") !== input.householdId) {
      throw new HttpsError("not-found", "Packing list not found");
    }
    if (
      !itemSnap.exists ||
      getRequiredString(itemSnap, "householdId", "Item is invalid") !== input.householdId ||
      itemSnap.get("deletedAt")
    ) {
      throw new HttpsError("failed-precondition", "This item no longer exists.");
    }

    const itemIds = normalizeIdList(listSnap.get("itemIds"));
    if (!itemIds.includes(input.itemId)) {
      throw new HttpsError("failed-precondition", "This item is no longer in the selected packing list.");
    }

    const packedItemIds = filterPackedItemIds(listSnap.get("packedItemIds"), itemIds);
    const nextPackedItemIds = input.packed
      ? filterPackedItemIds([...packedItemIds, input.itemId], itemIds)
      : packedItemIds.filter((itemId) => itemId !== input.itemId);

    transaction.update(listRef, {
      packedItemIds: nextPackedItemIds,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actingUid
    });
  });

  return { ok: true as const };
}

export async function clearPackingListPackedHandler(raw: unknown, actingUid: string) {
  const input = clearPackingListPackedInputSchema.parse(raw);
  await requireHouseholdMember(input.householdId, actingUid);

  const listRef = db.doc(paths.packingList(input.householdId, input.listId));
  await db.runTransaction(async (transaction) => {
    const listSnap = await transaction.get(listRef);
    if (!listSnap.exists) {
      throw new HttpsError("not-found", "Packing list not found");
    }
    if (getRequiredString(listSnap, "householdId", "Packing list is invalid") !== input.householdId) {
      throw new HttpsError("not-found", "Packing list not found");
    }

    transaction.update(listRef, {
      packedItemIds: [],
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actingUid
    });
  });

  return { ok: true as const };
}
