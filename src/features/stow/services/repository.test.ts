import { afterEach, describe, expect, it, vi } from "vitest";

const setCalls: Array<{ payload: Record<string, unknown> }> = [];
const commit = vi.fn(async () => undefined);

vi.mock("firebase/firestore", () => {
  let autoId = 0;
  return {
    addDoc: vi.fn(),
    arrayRemove: vi.fn(),
    arrayUnion: vi.fn(),
    collection: vi.fn(() => ({ __type: "collection" })),
    collectionGroup: vi.fn(),
    deleteDoc: vi.fn(),
    doc: vi.fn((_col: unknown, id?: string) => ({ id: id ?? `auto-${++autoId}` })),
    getDocs: vi.fn(),
    onSnapshot: vi.fn(),
    orderBy: vi.fn(),
    query: vi.fn(),
    serverTimestamp: vi.fn(() => "__ts__"),
    setDoc: vi.fn(),
    updateDoc: vi.fn(),
    where: vi.fn(),
    writeBatch: vi.fn(() => ({
      set: (_ref: { id: string }, payload: Record<string, unknown>) => {
        setCalls.push({ payload });
      },
      commit
    }))
  };
});

vi.mock("@/lib/firebase/client", () => ({ db: {} }));
vi.mock("@/lib/firebase/functions", () => ({
  removeHouseholdMember: vi.fn(),
  revokeHouseholdInvite: vi.fn(),
  updateHouseholdMemberRole: vi.fn()
}));

import { inventoryRepository, normalizeItemDoc } from "@/features/stow/services/repository";

afterEach(() => {
  setCalls.length = 0;
  commit.mockClear();
});

const validItemDoc = {
  householdId: "h1",
  spaceId: "s1",
  areaId: "a1",
  areaNameSnapshot: "Desk",
  name: "Keyboard",
  kind: "item",
  tags: [],
  isPacked: false,
  status: "home"
};

// normalizeItemDoc takes a Firestore snapshot ({ id, data() }), so wrap raw fields.
const snapOf = (data: Record<string, unknown>) => ({ id: "i1", data: () => data });

describe("normalizeItemDoc", () => {
  it("defaults malformed name/notes/value instead of crashing the UI", () => {
    const normalized = normalizeItemDoc(snapOf({ ...validItemDoc, name: 42, notes: null, value: "abc" }));
    expect(normalized.name).toBe("Untitled item");
    expect(normalized.notes).toBe("");
    expect(normalized.value).toBeNull();
  });
});

describe("createItemsBatch", () => {
  it("writes one doc per item with createItem defaults and returns ids", async () => {
    const ids = await inventoryRepository.createItemsBatch({
      householdId: "h1",
      userId: "u1",
      items: [
        { name: "Keyboard", spaceId: "s1", areaId: "a1", areaNameSnapshot: "Desk", value: 140, tags: ["Tech"] },
        { name: "Box", spaceId: "s1", areaId: "a1", areaNameSnapshot: "Desk" }
      ]
    });

    expect(ids).toHaveLength(2);
    expect(setCalls).toHaveLength(2);
    expect(commit).toHaveBeenCalledTimes(1);

    const first = setCalls[0].payload;
    expect(first).toMatchObject({
      householdId: "h1",
      spaceId: "s1",
      areaId: "a1",
      areaNameSnapshot: "Desk",
      name: "Keyboard",
      kind: "item",
      isPacked: false,
      value: 140,
      tags: ["Tech"],
      createdBy: "u1",
      updatedBy: "u1"
    });
    expect(first.entryMode).toBeDefined();
    expect(first.photoStatus).toBeDefined();

    const second = setCalls[1].payload;
    expect(second).toMatchObject({ name: "Box", value: null, tags: [], image: null, notes: "" });
  });

  it("returns an empty array for an empty items list", async () => {
    const ids = await inventoryRepository.createItemsBatch({ householdId: "h1", userId: "u1", items: [] });
    expect(ids).toEqual([]);
    expect(setCalls).toHaveLength(0);
    expect(commit).not.toHaveBeenCalled();
  });
});
