import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const requireHouseholdAdmin = vi.fn();

const memberRef = {
  path: "households/h1/members/target-user",
  get: vi.fn(),
  set: vi.fn()
};
const userRef = {
  path: "users/target-user",
  get: vi.fn()
};
const batch = {
  delete: vi.fn(),
  set: vi.fn(),
  commit: vi.fn()
};
const ownerCountGet = vi.fn();

vi.mock("../src/shared/authz.js", () => ({
  requireHouseholdAdmin
}));

vi.mock("../src/shared/firestore.js", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "server-timestamp"),
    delete: vi.fn(() => "delete-field")
  },
  db: {
    doc: vi.fn((path: string) => {
      if (path.includes("/members/")) return memberRef;
      return userRef;
    }),
    collection: vi.fn(() => ({
      where: vi.fn(() => ({
        get: ownerCountGet
      }))
    })),
    batch: vi.fn(() => batch)
  },
  paths: {
    member: (householdId: string, uid: string) => `households/${householdId}/members/${uid}`,
    members: (householdId: string) => `households/${householdId}/members`,
    user: (uid: string) => `users/${uid}`
  }
}));

const {
  removeHouseholdMemberHandler,
  updateHouseholdMemberRoleHandler
} = await import("../src/members.js");

describe("member management handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHouseholdAdmin.mockResolvedValue("OWNER");
    memberRef.get.mockResolvedValue({
      exists: true,
      get: (field: string) => (field === "role" ? "MEMBER" : undefined),
      data: () => ({ role: "MEMBER" })
    });
    userRef.get.mockResolvedValue({
      exists: false,
      get: () => undefined,
      ref: userRef
    });
    ownerCountGet.mockResolvedValue({ size: 2 });
    batch.commit.mockResolvedValue(undefined);
  });

  it("blocks admins from promoting members to owner", async () => {
    requireHouseholdAdmin.mockResolvedValue("ADMIN");

    await expect(
      updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "OWNER" }, "admin-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "permission-denied"
    });
    expect(memberRef.set).not.toHaveBeenCalled();
  });

  it("blocks admins from removing existing owners", async () => {
    requireHouseholdAdmin.mockResolvedValue("ADMIN");
    memberRef.get.mockResolvedValue({
      exists: true,
      get: (field: string) => (field === "role" ? "OWNER" : undefined),
      data: () => ({ role: "OWNER" })
    });

    await expect(
      removeHouseholdMemberHandler({ householdId: "h1", uid: "target-user" }, "admin-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "permission-denied"
    });
    expect(batch.delete).not.toHaveBeenCalled();
  });

  it("prevents demoting the last remaining owner", async () => {
    memberRef.get.mockResolvedValue({
      exists: true,
      get: (field: string) => (field === "role" ? "OWNER" : undefined),
      data: () => ({ role: "OWNER" })
    });
    ownerCountGet.mockResolvedValue({ size: 1 });

    await expect(
      updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "ADMIN" }, "owner-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "failed-precondition"
    });
    expect(memberRef.set).not.toHaveBeenCalled();
  });

  it("allows owners to promote another member to owner", async () => {
    await updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "OWNER" }, "owner-1");

    expect(memberRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "target-user",
        role: "OWNER",
        updatedBy: "owner-1"
      }),
      { merge: true }
    );
  });

  it("clears the removed member household pointer when it still targets the household", async () => {
    userRef.get.mockResolvedValue({
      exists: true,
      get: (field: string) => (field === "currentHouseholdId" ? "h1" : undefined),
      ref: userRef
    });

    await removeHouseholdMemberHandler({ householdId: "h1", uid: "target-user" }, "owner-1");

    expect(batch.delete).toHaveBeenCalledWith(memberRef);
    expect(batch.set).toHaveBeenCalledWith(
      userRef,
      expect.objectContaining({
        currentHouseholdId: "delete-field"
      }),
      { merge: true }
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
