import { beforeEach, describe, expect, it, vi } from "vitest";

const requireHouseholdAdmin = vi.fn();

const inviteRef = {
  id: "invite-123",
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn()
};
const memberRef = { path: "households/h1/members/u2" };
const userRef = { path: "users/u2" };
const batch = {
  set: vi.fn(),
  update: vi.fn(),
  commit: vi.fn()
};
const tx = {
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};
// Default: invoke the callback once (the admin SDK only retries on contention).
// Individual tests override this to simulate retries.
const runTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
const inviteQueryGet = vi.fn();
const inviteCollection = {
  doc: vi.fn(() => inviteRef),
  where: vi.fn(() => ({
    limit: vi.fn(() => ({
      get: inviteQueryGet
    }))
  }))
};

vi.mock("../src/shared/authz.js", () => ({
  requireHouseholdAdmin
}));

vi.mock("../src/shared/firestore.js", () => ({
  FieldValue: {
    serverTimestamp: vi.fn(() => "server-timestamp")
  },
  db: {
    collection: vi.fn(() => inviteCollection),
    doc: vi.fn((path: string) => {
      if (path.includes("/members/")) return memberRef;
      if (path.startsWith("users/")) return userRef;
      return inviteRef;
    }),
    batch: vi.fn(() => batch),
    runTransaction
  },
  paths: {
    invites: (householdId: string) => `households/${householdId}/invites`,
    invite: (householdId: string, inviteId: string) => `households/${householdId}/invites/${inviteId}`,
    member: (householdId: string, uid: string) => `households/${householdId}/members/${uid}`,
    user: (uid: string) => `users/${uid}`
  }
}));

const {
  acceptHouseholdInviteHandler,
  createHouseholdInviteHandler,
  hashInviteToken,
  revokeHouseholdInviteHandler
} = await import("../src/invites.js");

describe("invite handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireHouseholdAdmin.mockResolvedValue("OWNER");
    inviteQueryGet.mockResolvedValue({ empty: true, docs: [] });
    inviteRef.get.mockResolvedValue({ exists: true });
    batch.commit.mockResolvedValue(undefined);
    runTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "MEMBER" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    });
  });

  it("creates invites with hashed tokens only", async () => {
    const result = await createHouseholdInviteHandler(
      { householdId: "h1", role: "MEMBER", expiresInHours: 48 },
      { uid: "owner-1" },
      "https://stow.test"
    );

    const inviteUrl = new URL(result.inviteUrl);
    const plaintextToken = inviteUrl.searchParams.get("token");
    expect(plaintextToken).toBeTruthy();
    expect(requireHouseholdAdmin).toHaveBeenCalledWith("h1", "owner-1");
    expect(inviteRef.set).toHaveBeenCalledTimes(1);

    const persistedInvite = inviteRef.set.mock.calls[0]?.[0];
    expect(persistedInvite).toMatchObject({
      role: "MEMBER",
      createdBy: "owner-1"
    });
    expect(persistedInvite).toHaveProperty("tokenHash", hashInviteToken(plaintextToken!));
    expect(persistedInvite).not.toHaveProperty("token");
  });

  it("refuses to build invite links from the Origin header in production", async () => {
    process.env.K_SERVICE = "stow-fn";
    delete process.env.APP_BASE_URL;
    try {
      await expect(
        createHouseholdInviteHandler({ householdId: "h1", role: "MEMBER" }, { uid: "admin-1" }, "https://evil.example")
      ).rejects.toMatchObject({ code: "failed-precondition" });
    } finally {
      delete process.env.K_SERVICE;
    }
  });

  it("uses APP_BASE_URL and ignores the Origin header in production", async () => {
    process.env.K_SERVICE = "stow-fn";
    process.env.APP_BASE_URL = "https://stow.example";
    try {
      const result = await createHouseholdInviteHandler(
        { householdId: "h1", role: "MEMBER" },
        { uid: "admin-1" },
        "https://evil.example"
      );
      expect(result.inviteUrl.startsWith("https://stow.example/invite?")).toBe(true);
      expect(result.inviteUrl).not.toContain("evil.example");
    } finally {
      delete process.env.K_SERVICE;
      delete process.env.APP_BASE_URL;
    }
  });

  it("accepts invites by token hash and stores membership metadata", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({
        role: "ADMIN",
        expiresAt: new Date(Date.now() + 60_000)
      }),
      get: (field: string) => (field === "createdBy" ? "owner-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({
        role: "ADMIN",
        expiresAt: new Date(Date.now() + 60_000)
      }),
      get: (field: string) => (field === "createdBy" ? "owner-1" : undefined)
    });

    await acceptHouseholdInviteHandler(
      { householdId: "h1", token: "plaintext-token-long-enough" },
      { uid: "u2", token: { email: "u2@example.com" } }
    );

    expect(inviteCollection.where).toHaveBeenCalledWith("tokenHash", "==", hashInviteToken("plaintext-token-long-enough"));
    expect(tx.get).toHaveBeenCalledWith(inviteDoc.ref);
    expect(tx.set).toHaveBeenCalledWith(
      memberRef,
      expect.objectContaining({
        uid: "u2",
        role: "ADMIN",
        email: "u2@example.com",
        createdBy: "owner-1"
      }),
      { merge: true }
    );
    expect(tx.set).toHaveBeenCalledWith(
      userRef,
      expect.objectContaining({
        currentHouseholdId: "h1"
      }),
      { merge: true }
    );
    expect(tx.update).toHaveBeenCalledWith(
      inviteDoc.ref,
      expect.objectContaining({
        acceptedBy: "u2"
      })
    );
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it("rejects acceptance when the invite was already accepted at transaction time", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    // Query (outside tx) returns a pending invite; the transactional re-read sees acceptedAt set.
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "MEMBER", acceptedAt: "already" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    });

    await expect(
      acceptHouseholdInviteHandler(
        { householdId: "h1", token: "a".repeat(32) },
        { uid: "u2", token: { email: "u2@example.com" } }
      )
    ).rejects.toMatchObject({ code: "already-exists" });
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("writes member, user, and invite updates inside the transaction on success", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "MEMBER" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    });

    await acceptHouseholdInviteHandler(
      { householdId: "h1", token: "a".repeat(32) },
      { uid: "u2", token: { email: "u2@example.com" } }
    );

    expect(tx.set).toHaveBeenCalledTimes(2); // member + user
    expect(tx.update).toHaveBeenCalledTimes(1); // invite acceptedAt
  });

  it("does not double-write when the admin SDK retries a losing transaction", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });

    // First read sees a pending invite; the contended retry re-reads an invite that a
    // concurrent accept already marked. Records the per-invocation tx-write counts.
    tx.get
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "MEMBER" }),
        get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: "MEMBER", acceptedAt: "already" }),
        get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
      });

    const writesPerInvocation: number[] = [];
    runTransaction.mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => {
      // Invocation 1: the SDK runs the callback, then discards it on a write conflict.
      tx.set.mockClear();
      tx.update.mockClear();
      await fn(tx).catch(() => undefined);
      writesPerInvocation.push(tx.set.mock.calls.length + tx.update.mock.calls.length);

      // Invocation 2: the SDK retries the same callback against the now-accepted invite.
      // It must throw cleanly without writing; surface that throw to the handler.
      tx.set.mockClear();
      tx.update.mockClear();
      try {
        return await fn(tx);
      } finally {
        writesPerInvocation.push(tx.set.mock.calls.length + tx.update.mock.calls.length);
      }
    });

    await expect(
      acceptHouseholdInviteHandler(
        { householdId: "h1", token: "a".repeat(32) },
        { uid: "u2", token: { email: "u2@example.com" } }
      )
    ).rejects.toMatchObject({ code: "already-exists" });

    // First invocation wrote (member+user+invite); the retried invocation wrote nothing.
    expect(writesPerInvocation).toEqual([3, 0]);
  });

  it("rejects acceptance when the invite is bound to a different email", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
      get: () => undefined
    });

    await expect(
      acceptHouseholdInviteHandler(
        { householdId: "h1", token: "a".repeat(32) },
        { uid: "u2", token: { email: "mallory@example.com" } }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("accepts case-insensitively when the bound email matches", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
      get: () => undefined
    });

    await expect(
      acceptHouseholdInviteHandler(
        { householdId: "h1", token: "a".repeat(32) },
        { uid: "u2", token: { email: "Alice@Example.com" } }
      )
    ).resolves.toEqual({ ok: true });
  });

  it("rejects acceptance of a bound invite when the caller has no email claim", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "MEMBER", invitedEmail: "alice@example.com" }),
      get: () => undefined
    });

    await expect(
      acceptHouseholdInviteHandler(
        { householdId: "h1", token: "a".repeat(32) },
        { uid: "u2", token: {} }
      )
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("rejects acceptance when the invite was revoked between query and transaction", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    tx.get.mockResolvedValue({ exists: false });

    await expect(
      acceptHouseholdInviteHandler(
        { householdId: "h1", token: "a".repeat(32) },
        { uid: "u2", token: { email: "u2@example.com" } }
      )
    ).rejects.toMatchObject({ code: "not-found" });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("rejects acceptance when the invite has expired at transaction time", async () => {
    const inviteDoc = {
      ref: { path: "households/h1/invites/invite-123" },
      data: () => ({ role: "MEMBER" }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    };
    inviteQueryGet.mockResolvedValue({
      empty: false,
      docs: [inviteDoc]
    });
    tx.get.mockResolvedValue({
      exists: true,
      data: () => ({ role: "MEMBER", expiresAt: { toDate: () => new Date(Date.now() - 1000) } }),
      get: (field: string) => (field === "createdBy" ? "admin-1" : undefined)
    });

    await expect(
      acceptHouseholdInviteHandler(
        { householdId: "h1", token: "a".repeat(32) },
        { uid: "u2", token: { email: "u2@example.com" } }
      )
    ).rejects.toMatchObject({ code: "deadline-exceeded" });
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });

  it("revokes invites through the backend handler", async () => {
    await revokeHouseholdInviteHandler({ householdId: "h1", inviteId: "invite-123" }, { uid: "owner-1" });

    expect(requireHouseholdAdmin).toHaveBeenCalledWith("h1", "owner-1");
    expect(inviteRef.delete).toHaveBeenCalledTimes(1);
  });
});
