import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpsError } from "firebase-functions/v2/https";

const requireHouseholdAdmin = vi.fn();

const memberRef = {
  path: "households/h1/members/target-user"
};
const userRef = {
  path: "users/target-user"
};
// The owners query handle returned by db.collection(...).where(...). tx.get branches on
// argument identity to distinguish this query from the member/user doc refs.
const ownersQuery = { path: "households/h1/members?role==OWNER" };

const tx = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn()
};
// Default: invoke the callback once (the admin SDK only retries on contention).
const runTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));

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
      where: vi.fn(() => ownersQuery)
    })),
    runTransaction
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

type SnapInit = { role?: string; currentHouseholdId?: string };

function memberSnap(role: string) {
  return {
    exists: true,
    get: (field: string) => (field === "role" ? role : undefined),
    data: () => ({ role })
  };
}

function userSnap(init: SnapInit) {
  return {
    exists: init.role === undefined ? false : true,
    get: (field: string) => (field === "currentHouseholdId" ? init.currentHouseholdId : undefined),
    ref: userRef
  };
}

describe("member management handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHouseholdAdmin.mockResolvedValue("OWNER");
    runTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    // Default member read returns a plain MEMBER; owners query reports a healthy count of 2;
    // user doc is absent. Individual tests override per scenario.
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("MEMBER");
      if (refOrQuery === ownersQuery) return { size: 2 };
      // user doc
      return { exists: false, get: () => undefined, ref: userRef };
    });
  });

  it("blocks admins from promoting members to owner", async () => {
    requireHouseholdAdmin.mockResolvedValue("ADMIN");

    await expect(
      updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "OWNER" }, "admin-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "permission-denied"
    });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("blocks admins from managing existing owners on role updates", async () => {
    requireHouseholdAdmin.mockResolvedValue("ADMIN");
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("OWNER");
      if (refOrQuery === ownersQuery) return { size: 2 };
      return userSnap({});
    });

    await expect(
      updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "MEMBER" }, "admin-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "permission-denied"
    });
    expect(tx.set).not.toHaveBeenCalled();
    // Admins are gated before the owner-count branch; the owners query is never read.
    expect(tx.get).not.toHaveBeenCalledWith(ownersQuery);
  });

  it("blocks admins from removing existing owners", async () => {
    requireHouseholdAdmin.mockResolvedValue("ADMIN");
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("OWNER");
      if (refOrQuery === ownersQuery) return { size: 2 };
      return userSnap({});
    });

    await expect(
      removeHouseholdMemberHandler({ householdId: "h1", uid: "target-user" }, "admin-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "permission-denied"
    });
    expect(tx.delete).not.toHaveBeenCalled();
    // Admins are gated before the owner-count branch; the owners query is never read.
    expect(tx.get).not.toHaveBeenCalledWith(ownersQuery);
  });

  it("prevents demoting the last remaining owner", async () => {
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("OWNER");
      if (refOrQuery === ownersQuery) return { size: 1 };
      return userSnap({});
    });

    await expect(
      updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "ADMIN" }, "owner-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "failed-precondition"
    });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("blocks last-owner demotion using the owner count read inside the transaction", async () => {
    requireHouseholdAdmin.mockResolvedValue("OWNER");
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) {
        return {
          exists: true,
          get: (f: string) => (f === "role" ? "OWNER" : undefined),
          data: () => ({ role: "OWNER" })
        };
      }
      return { size: 1 }; // owners query: this is the last owner
    });

    await expect(
      updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "MEMBER" }, "owner-1")
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(tx.set).not.toHaveBeenCalled();
    // Pin the load-bearing invariant: the owner count MUST be read inside the transaction.
    // A refactor that moves it back outside the tx fails here even with the same count value.
    expect(tx.get).toHaveBeenCalledWith(ownersQuery);
  });

  it("prevents removing the last remaining owner", async () => {
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("OWNER");
      if (refOrQuery === ownersQuery) return { size: 1 };
      return userSnap({});
    });

    await expect(
      removeHouseholdMemberHandler({ householdId: "h1", uid: "target-user" }, "owner-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "failed-precondition"
    });
    expect(tx.delete).not.toHaveBeenCalled();
    // Pin the load-bearing invariant: the owner count MUST be read inside the transaction.
    // A refactor that moves it back outside the tx fails here even with the same count value.
    expect(tx.get).toHaveBeenCalledWith(ownersQuery);
  });

  it("allows owners to promote another member to owner", async () => {
    await updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "OWNER" }, "owner-1");

    expect(tx.set).toHaveBeenCalledWith(
      memberRef,
      expect.objectContaining({
        uid: "target-user",
        role: "OWNER",
        updatedBy: "owner-1"
      }),
      { merge: true }
    );
  });

  it("does not write when the target role already matches the requested role", async () => {
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("MEMBER");
      if (refOrQuery === ownersQuery) return { size: 2 };
      return userSnap({});
    });

    await updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "MEMBER" }, "owner-1");

    expect(tx.set).not.toHaveBeenCalled();
  });

  it("rejects when the member document is missing", async () => {
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return { exists: false };
      if (refOrQuery === ownersQuery) return { size: 2 };
      return userSnap({});
    });

    await expect(
      updateHouseholdMemberRoleHandler({ householdId: "h1", uid: "target-user", role: "ADMIN" }, "owner-1")
    ).rejects.toMatchObject<HttpsError>({
      code: "not-found"
    });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("removes a plain member and deletes the membership doc", async () => {
    await removeHouseholdMemberHandler({ householdId: "h1", uid: "target-user" }, "owner-1");

    expect(tx.delete).toHaveBeenCalledWith(memberRef);
    expect(tx.set).not.toHaveBeenCalled();
    // Removing a plain MEMBER never triggers the owner-count guard.
    expect(tx.get).not.toHaveBeenCalledWith(ownersQuery);
  });

  it("clears the removed member household pointer when it still targets the household", async () => {
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("MEMBER");
      if (refOrQuery === ownersQuery) return { size: 2 };
      return userSnap({ role: "MEMBER", currentHouseholdId: "h1" });
    });

    await removeHouseholdMemberHandler({ householdId: "h1", uid: "target-user" }, "owner-1");

    expect(tx.delete).toHaveBeenCalledWith(memberRef);
    expect(tx.set).toHaveBeenCalledWith(
      userRef,
      expect.objectContaining({
        currentHouseholdId: "delete-field"
      }),
      { merge: true }
    );
  });

  it("leaves the household pointer untouched when it targets a different household", async () => {
    tx.get.mockImplementation(async (refOrQuery: unknown) => {
      if (refOrQuery === memberRef) return memberSnap("MEMBER");
      if (refOrQuery === ownersQuery) return { size: 2 };
      return userSnap({ role: "MEMBER", currentHouseholdId: "other-household" });
    });

    await removeHouseholdMemberHandler({ householdId: "h1", uid: "target-user" }, "owner-1");

    expect(tx.delete).toHaveBeenCalledWith(memberRef);
    expect(tx.set).not.toHaveBeenCalled();
  });
});
