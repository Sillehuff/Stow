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

import { incrementalSnapshotMapper, inventoryRepository, normalizeItemDoc } from "@/features/stow/services/repository";

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

describe("updateItem", () => {
  it("never passes undefined-valued fields to updateDoc", async () => {
    const { updateDoc } = await import("firebase/firestore");

    await inventoryRepository.updateItem({
      householdId: "h1",
      itemId: "i1",
      userId: "u1",
      // A caller that builds its patch from optional inputs can produce undefined
      // values; updateDoc throws on any of them (no ignoreUndefinedProperties).
      patch: { name: "Passport", value: undefined, notes: undefined, image: null }
    });

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const payload = (updateDoc as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    expect(Object.values(payload)).not.toContain(undefined);
    expect(payload).toMatchObject({ name: "Passport", image: null, updatedBy: "u1" });
    expect("value" in payload).toBe(false);
    expect("notes" in payload).toBe(false);
  });
});

describe("incrementalSnapshotMapper", () => {
  type Row = { id: string; name: string };
  const mapRow = (snap: { id: string; data(): Record<string, unknown> }): Row | null => {
    const data = snap.data();
    return typeof data.name === "string" ? { id: snap.id, name: data.name } : null;
  };
  const docSnap = (id: string, data: Record<string, unknown>) => ({ id, data: () => data });
  const querySnap = (
    docs: ReturnType<typeof docSnap>[],
    changes: Array<{ type: "added" | "modified" | "removed"; doc: ReturnType<typeof docSnap> }>
  ) =>
    ({
      docs,
      docChanges: () => changes,
      metadata: { fromCache: false, hasPendingWrites: false }
    }) as never;

  it("maps an initial snapshot in query order", () => {
    const map = incrementalSnapshotMapper(mapRow);
    const a = docSnap("a", { name: "Alpha" });
    const b = docSnap("b", { name: "Beta" });
    const state = map(querySnap([b, a], [{ type: "added", doc: a }, { type: "added", doc: b }]));
    expect(state.data.map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("keeps unchanged objects referentially identical across snapshots", () => {
    const map = incrementalSnapshotMapper(mapRow);
    const a = docSnap("a", { name: "Alpha" });
    const b = docSnap("b", { name: "Beta" });
    const first = map(querySnap([a, b], [{ type: "added", doc: a }, { type: "added", doc: b }]));
    const b2 = docSnap("b", { name: "Beta v2" });
    const second = map(querySnap([b2, a], [{ type: "modified", doc: b2 }]));
    expect(second.data.map((row) => row.name)).toEqual(["Beta v2", "Alpha"]);
    expect(second.data[1]).toBe(first.data[0]); // "a" untouched → same object
    expect(second.data[0]).not.toBe(first.data[1]); // "b" re-mapped
  });

  it("drops removed docs and docs the mapper rejects", () => {
    const map = incrementalSnapshotMapper(mapRow);
    const a = docSnap("a", { name: "Alpha" });
    const stub = docSnap("s", { position: 3 }); // name-less stub → mapper returns null
    const first = map(
      querySnap([a, stub], [{ type: "added", doc: a }, { type: "added", doc: stub }])
    );
    expect(first.data.map((row) => row.id)).toEqual(["a"]);
    const second = map(querySnap([stub], [{ type: "removed", doc: a }]));
    expect(second.data).toEqual([]);
  });

  it("re-adding a previously removed doc resurfaces it", () => {
    const map = incrementalSnapshotMapper(mapRow);
    const a = docSnap("a", { name: "Alpha" });
    map(querySnap([a], [{ type: "added", doc: a }]));
    map(querySnap([], [{ type: "removed", doc: a }]));
    const third = map(querySnap([a], [{ type: "added", doc: a }]));
    expect(third.data.map((row) => row.id)).toEqual(["a"]);
  });
});
