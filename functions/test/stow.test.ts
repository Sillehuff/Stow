import { beforeEach, describe, expect, it, vi } from "vitest";

type Ref = {
  id: string;
  path: string;
  delete: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
};

type TransactionMock = {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

type BatchMock = {
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
};

const mocks = vi.hoisted(() => {
  const docRefs = new Map<string, Ref>();
  const transactionQueue: TransactionMock[] = [];
  const batchQueue: BatchMock[] = [];
  const collections = new Map<string, unknown>();

  const getDocRef = (path: string): Ref => {
    const existing = docRefs.get(path);
    if (existing) return existing;
    const ref: Ref = {
      id: path.split("/").at(-1) ?? path,
      path,
      delete: vi.fn(),
      set: vi.fn()
    };
    docRefs.set(path, ref);
    return ref;
  };

  const snapshotFor = (ref: Ref, data: Record<string, unknown> | null) => ({
    exists: data !== null,
    get: (field: string) => data?.[field] ?? null,
    ref
  });

  const createTransaction = (docsByPath: Record<string, Record<string, unknown> | null>): TransactionMock => ({
    get: vi.fn(async (ref: Ref) => snapshotFor(ref, docsByPath[ref.path] ?? null)),
    set: vi.fn(),
    update: vi.fn()
  });

  const createBatch = (): BatchMock => ({
    update: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined)
  });

  const requireHouseholdAdmin = vi.fn();
  const requireHouseholdMember = vi.fn();
  const runTransaction = vi.fn(async (callback: (transaction: TransactionMock) => Promise<unknown>) => {
    const nextTransaction = transactionQueue.shift();
    if (!nextTransaction) {
      throw new Error("No queued transaction");
    }
    return callback(nextTransaction);
  });
  const collection = vi.fn((path: string) => {
    if (!collections.has(path)) {
      throw new Error(`Unexpected collection: ${path}`);
    }
    return collections.get(path);
  });
  const batch = vi.fn(() => {
    const nextBatch = batchQueue.shift();
    if (!nextBatch) {
      throw new Error("No queued batch");
    }
    return nextBatch;
  });
  const doc = vi.fn((path: string) => getDocRef(path));

  return {
    batch,
    batchQueue,
    collection,
    collections,
    createBatch,
    createTransaction,
    doc,
    docRefs,
    getDocRef,
    requireHouseholdAdmin,
    requireHouseholdMember,
    runTransaction,
    transactionQueue
  };
});

vi.mock("../src/shared/authz.js", () => ({
  requireHouseholdAdmin: mocks.requireHouseholdAdmin,
  requireHouseholdMember: mocks.requireHouseholdMember
}));

vi.mock("../src/shared/firestore.js", () => ({
  FieldValue: {
    serverTimestamp: () => "SERVER_TIMESTAMP",
    arrayRemove: (value: string) => ({ op: "arrayRemove", value }),
    delete: () => ({ op: "delete" })
  },
  paths: {
    area: (householdId: string, spaceId: string, areaId: string) =>
      `households/${householdId}/spaces/${spaceId}/areas/${areaId}`,
    areas: (householdId: string, spaceId: string) => `households/${householdId}/spaces/${spaceId}/areas`,
    item: (householdId: string, itemId: string) => `households/${householdId}/items/${itemId}`,
    items: (householdId: string) => `households/${householdId}/items`,
    packingList: (householdId: string, listId: string) => `households/${householdId}/packingLists/${listId}`,
    packingLists: (householdId: string) => `households/${householdId}/packingLists`,
    space: (householdId: string, spaceId: string) => `households/${householdId}/spaces/${spaceId}`
  },
  db: {
    doc: mocks.doc,
    runTransaction: mocks.runTransaction,
    collection: mocks.collection,
    batch: mocks.batch
  }
}));

const {
  clearPackingListPackedHandler,
  createPackingListHandler,
  deleteAreaHandler,
  deleteItemHandler,
  deletePackingListHandler,
  deleteSpaceHandler,
  togglePackingListItemHandler,
  updatePackingListHandler
} = await import("../src/stow.js");

function queueTransaction(docsByPath: Record<string, Record<string, unknown> | null>) {
  const transaction = mocks.createTransaction(docsByPath);
  mocks.transactionQueue.push(transaction);
  return transaction;
}

function queueBatch() {
  const batch = mocks.createBatch();
  mocks.batchQueue.push(batch);
  return batch;
}

function setCollection(path: string, value: unknown) {
  mocks.collections.set(path, value);
}

function createStoredDoc(refPath: string, data: Record<string, unknown>) {
  return {
    id: refPath.split("/").at(-1) ?? refPath,
    ref: mocks.getDocRef(refPath),
    get: (field: string) => data[field] ?? null
  };
}

function createAreaItemsCollection(docs: Array<ReturnType<typeof createStoredDoc>>) {
  return {
    where: vi.fn((field: string) => {
      expect(field).toBe("spaceId");
      return {
        where: vi.fn((innerField: string) => {
          expect(innerField).toBe("areaId");
          return {
            get: vi.fn().mockResolvedValue({ docs })
          };
        })
      };
    })
  };
}

function createSpaceItemsCollection(docs: Array<ReturnType<typeof createStoredDoc>>) {
  return {
    where: vi.fn((field: string) => {
      expect(field).toBe("spaceId");
      return {
        get: vi.fn().mockResolvedValue({ docs })
      };
    })
  };
}

function createPackingListsCollection(listDocsByField: Record<string, Array<{ id: string; ref: Ref }>>) {
  return {
    where: vi.fn((field: string) => ({
      get: vi.fn().mockResolvedValue({ docs: listDocsByField[field] ?? [] })
    }))
  };
}

function createCollectionWithDoc(rootPath: string, docId: string) {
  return {
    doc: vi.fn(() => mocks.getDocRef(`${rootPath}/${docId}`))
  };
}

describe("stow delete handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.docRefs.clear();
    mocks.collections.clear();
    mocks.transactionQueue.length = 0;
    mocks.batchQueue.length = 0;
    mocks.requireHouseholdAdmin.mockResolvedValue("ADMIN");
    mocks.requireHouseholdMember.mockResolvedValue("MEMBER");
  });

  it("retargets a locked area delete when the original destination disappears", async () => {
    const areaPath = "households/h1/spaces/space-a/areas/area-1";
    const oldSpacePath = "households/h1/spaces/space-b";
    const oldAreaPath = "households/h1/spaces/space-b/areas/area-b";
    const newSpacePath = "households/h1/spaces/space-c";
    const newAreaPath = "households/h1/spaces/space-c/areas/area-c";
    const itemDoc = createStoredDoc("households/h1/items/item-1", { deletedAt: null });

    const lockTransaction = queueTransaction({
      [areaPath]: {
        householdId: "h1",
        spaceId: "space-a",
        deletingAt: "LOCKED",
        deleteTargetSpaceId: "space-b",
        deleteTargetAreaId: "area-b"
      },
      [oldSpacePath]: null,
      [oldAreaPath]: null,
      [newSpacePath]: {
        householdId: "h1"
      },
      [newAreaPath]: {
        householdId: "h1",
        spaceId: "space-c",
        name: "Closet"
      }
    });
    const moveTransaction = queueTransaction({
      [newSpacePath]: {
        householdId: "h1"
      },
      [newAreaPath]: {
        householdId: "h1",
        spaceId: "space-c",
        name: "Closet"
      }
    });
    setCollection("households/h1/items", createAreaItemsCollection([itemDoc]));
    mocks.getDocRef(areaPath).delete.mockResolvedValue(undefined);

    await expect(
      deleteAreaHandler(
        {
          householdId: "h1",
          spaceId: "space-a",
          areaId: "area-1",
          reassignTo: { spaceId: "space-c", areaId: "area-c" }
        },
        "admin-1"
      )
    ).resolves.toEqual({ ok: true });

    expect(lockTransaction.set).toHaveBeenCalledWith(
      mocks.getDocRef(areaPath),
      expect.objectContaining({
        deleteTargetAreaId: "area-c",
        deleteTargetSpaceId: "space-c",
        deletingBy: "admin-1"
      }),
      { merge: true }
    );
    expect(moveTransaction.update).toHaveBeenCalledWith(
      itemDoc.ref,
      expect.objectContaining({
        areaId: "area-c",
        areaNameSnapshot: "Closet",
        spaceId: "space-c",
        updatedBy: "admin-1"
      })
    );
    expect(mocks.getDocRef(areaPath).delete).toHaveBeenCalledTimes(1);
  });

  it("retargets a locked space delete when the original destination disappears", async () => {
    const spacePath = "households/h1/spaces/space-a";
    const sourceAreasPath = "households/h1/spaces/space-a/areas";
    const oldSpacePath = "households/h1/spaces/space-b";
    const oldAreaPath = "households/h1/spaces/space-b/areas/area-b";
    const newSpacePath = "households/h1/spaces/space-c";
    const newAreaPath = "households/h1/spaces/space-c/areas/area-c";
    const itemDoc = createStoredDoc("households/h1/items/item-2", { deletedAt: null });
    const areaDoc = createStoredDoc("households/h1/spaces/space-a/areas/source-area", {});

    const lockTransaction = queueTransaction({
      [spacePath]: {
        householdId: "h1",
        deletingAt: "LOCKED",
        deleteTargetSpaceId: "space-b",
        deleteTargetAreaId: "area-b"
      },
      [oldSpacePath]: null,
      [oldAreaPath]: null,
      [newSpacePath]: {
        householdId: "h1"
      },
      [newAreaPath]: {
        householdId: "h1",
        spaceId: "space-c",
        name: "Landing Zone"
      }
    });
    const moveTransaction = queueTransaction({
      [newSpacePath]: {
        householdId: "h1"
      },
      [newAreaPath]: {
        householdId: "h1",
        spaceId: "space-c",
        name: "Landing Zone"
      }
    });
    const deleteBatch = queueBatch();
    setCollection("households/h1/items", createSpaceItemsCollection([itemDoc]));
    setCollection(sourceAreasPath, {
      get: vi.fn().mockResolvedValue({ docs: [areaDoc] })
    });
    mocks.getDocRef(spacePath).delete.mockResolvedValue(undefined);

    await expect(
      deleteSpaceHandler(
        {
          householdId: "h1",
          spaceId: "space-a",
          reassignTo: { spaceId: "space-c", areaId: "area-c" }
        },
        "admin-1"
      )
    ).resolves.toEqual({ ok: true });

    expect(lockTransaction.set).toHaveBeenCalledWith(
      mocks.getDocRef(spacePath),
      expect.objectContaining({
        deleteTargetAreaId: "area-c",
        deleteTargetSpaceId: "space-c",
        deletingBy: "admin-1"
      }),
      { merge: true }
    );
    expect(moveTransaction.update).toHaveBeenCalledWith(
      itemDoc.ref,
      expect.objectContaining({
        areaId: "area-c",
        areaNameSnapshot: "Landing Zone",
        spaceId: "space-c",
        updatedBy: "admin-1"
      })
    );
    expect(deleteBatch.delete).toHaveBeenCalledWith(areaDoc.ref);
    expect(mocks.getDocRef(spacePath).delete).toHaveBeenCalledTimes(1);
  });

  it("rejects changing a still-valid locked area destination", async () => {
    const areaPath = "households/h1/spaces/space-a/areas/area-1";
    const lockedSpacePath = "households/h1/spaces/space-b";
    const lockedAreaPath = "households/h1/spaces/space-b/areas/area-b";

    queueTransaction({
      [areaPath]: {
        householdId: "h1",
        spaceId: "space-a",
        deletingAt: "LOCKED",
        deleteTargetSpaceId: "space-b",
        deleteTargetAreaId: "area-b"
      },
      [lockedSpacePath]: {
        householdId: "h1"
      },
      [lockedAreaPath]: {
        householdId: "h1",
        spaceId: "space-b",
        name: "Desk"
      }
    });

    await expect(
      deleteAreaHandler(
        {
          householdId: "h1",
          spaceId: "space-a",
          areaId: "area-1",
          reassignTo: { spaceId: "space-c", areaId: "area-c" }
        },
        "admin-1"
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Deletion is already in progress. Refresh and try again."
    });
  });
});

describe("deleteItemHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.docRefs.clear();
    mocks.collections.clear();
    mocks.transactionQueue.length = 0;
    mocks.batchQueue.length = 0;
    mocks.requireHouseholdMember.mockResolvedValue("MEMBER");
  });

  it("keeps the item tombstoned when a later cleanup chunk fails", async () => {
    const itemPath = "households/h1/items/item-1";
    const listDocs = Array.from({ length: 451 }, (_, index) => ({
      id: `list-${index}`,
      ref: { id: `list-${index}` } as Ref
    }));

    queueTransaction({
      [itemPath]: {
        householdId: "h1",
        deletedAt: null
      }
    });
    setCollection(
      "households/h1/packingLists",
      createPackingListsCollection({
        itemIds: listDocs,
        packedItemIds: []
      })
    );
    const firstBatch = queueBatch();
    const secondBatch = queueBatch();
    firstBatch.commit.mockResolvedValue(undefined);
    secondBatch.commit.mockRejectedValue(new Error("chunk failed"));

    await expect(deleteItemHandler({ householdId: "h1", itemId: "item-1" }, "member-1")).rejects.toMatchObject({
      code: "aborted",
      message: expect.stringContaining("stays hidden")
    });

    expect(mocks.transactionQueue).toHaveLength(0);
    expect(mocks.getDocRef(itemPath).delete).not.toHaveBeenCalled();
  });

  it("resumes an already tombstoned delete and removes the item once cleanup is done", async () => {
    const itemPath = "households/h1/items/item-1";

    queueTransaction({
      [itemPath]: {
        householdId: "h1",
        deletedAt: "already-deleted"
      }
    });
    setCollection(
      "households/h1/packingLists",
      createPackingListsCollection({
        itemIds: [],
        packedItemIds: []
      })
    );
    mocks.getDocRef(itemPath).delete.mockResolvedValue(undefined);

    await expect(deleteItemHandler({ householdId: "h1", itemId: "item-1" }, "member-1")).resolves.toEqual({ ok: true });

    expect(mocks.getDocRef(itemPath).delete).toHaveBeenCalledTimes(1);
  });
});

describe("packing list handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.docRefs.clear();
    mocks.collections.clear();
    mocks.transactionQueue.length = 0;
    mocks.batchQueue.length = 0;
    mocks.requireHouseholdMember.mockResolvedValue("MEMBER");
  });

  it("creates packing lists with unique active item ids", async () => {
    const itemOnePath = "households/h1/items/item-1";
    const itemTwoPath = "households/h1/items/item-2";
    const listRootPath = "households/h1/packingLists";
    const listPath = `${listRootPath}/list-1`;

    setCollection(listRootPath, createCollectionWithDoc(listRootPath, "list-1"));
    const transaction = queueTransaction({
      [itemOnePath]: {
        householdId: "h1",
        deletedAt: null
      },
      [itemTwoPath]: {
        householdId: "h1",
        deletedAt: null
      }
    });

    await expect(
      createPackingListHandler(
        {
          householdId: "h1",
          name: "Weekend Trip",
          itemIds: ["item-1", "item-1", "item-2"]
        },
        "member-1"
      )
    ).resolves.toEqual({ ok: true, listId: "list-1" });

    expect(transaction.set).toHaveBeenCalledWith(
      mocks.getDocRef(listPath),
      expect.objectContaining({
        householdId: "h1",
        name: "Weekend Trip",
        itemIds: ["item-1", "item-2"],
        packedItemIds: [],
        createdBy: "member-1",
        updatedBy: "member-1"
      })
    );
  });

  it("rejects packing list updates that include deleted items", async () => {
    const listPath = "households/h1/packingLists/list-1";
    const itemOnePath = "households/h1/items/item-1";
    const itemTwoPath = "households/h1/items/item-2";

    queueTransaction({
      [listPath]: {
        householdId: "h1",
        itemIds: ["item-1"],
        packedItemIds: ["item-1"]
      },
      [itemOnePath]: {
        householdId: "h1",
        deletedAt: null
      },
      [itemTwoPath]: {
        householdId: "h1",
        deletedAt: "tombstoned"
      }
    });

    await expect(
      updatePackingListHandler(
        {
          householdId: "h1",
          listId: "list-1",
          itemIds: ["item-1", "item-2"]
        },
        "member-1"
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "One or more selected items no longer exist. Refresh and try again."
    });
  });

  it("rejects toggling a packed item when the item is already tombstoned", async () => {
    const listPath = "households/h1/packingLists/list-1";
    const itemPath = "households/h1/items/item-1";

    queueTransaction({
      [listPath]: {
        householdId: "h1",
        itemIds: ["item-1"],
        packedItemIds: []
      },
      [itemPath]: {
        householdId: "h1",
        deletedAt: "tombstoned"
      }
    });

    await expect(
      togglePackingListItemHandler(
        {
          householdId: "h1",
          listId: "list-1",
          itemId: "item-1",
          packed: true
        },
        "member-1"
      )
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "This item no longer exists."
    });
  });

  it("clears packed ids through the server handler", async () => {
    const listPath = "households/h1/packingLists/list-1";
    const transaction = queueTransaction({
      [listPath]: {
        householdId: "h1",
        itemIds: ["item-1"],
        packedItemIds: ["item-1"]
      }
    });

    await expect(
      clearPackingListPackedHandler(
        {
          householdId: "h1",
          listId: "list-1"
        },
        "member-1"
      )
    ).resolves.toEqual({ ok: true });

    expect(transaction.update).toHaveBeenCalledWith(
      mocks.getDocRef(listPath),
      expect.objectContaining({
        packedItemIds: [],
        updatedBy: "member-1"
      })
    );
  });

  it("deletes packing lists through the server handler", async () => {
    const listPath = "households/h1/packingLists/list-1";
    mocks.getDocRef(listPath).delete.mockResolvedValue(undefined);

    await expect(
      deletePackingListHandler(
        {
          householdId: "h1",
          listId: "list-1"
        },
        "member-1"
      )
    ).resolves.toEqual({ ok: true });

    expect(mocks.getDocRef(listPath).delete).toHaveBeenCalledTimes(1);
  });
});
