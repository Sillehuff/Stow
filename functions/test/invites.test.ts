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
    batch: vi.fn(() => batch)
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

    await acceptHouseholdInviteHandler(
      { householdId: "h1", token: "plaintext-token-long-enough" },
      { uid: "u2", token: { email: "u2@example.com" } }
    );

    expect(inviteCollection.where).toHaveBeenCalledWith("tokenHash", "==", hashInviteToken("plaintext-token-long-enough"));
    expect(batch.set).toHaveBeenCalledWith(
      memberRef,
      expect.objectContaining({
        uid: "u2",
        role: "ADMIN",
        email: "u2@example.com",
        createdBy: "owner-1"
      }),
      { merge: true }
    );
    expect(batch.set).toHaveBeenCalledWith(
      userRef,
      expect.objectContaining({
        currentHouseholdId: "h1"
      }),
      { merge: true }
    );
    expect(batch.update).toHaveBeenCalledWith(
      inviteDoc.ref,
      expect.objectContaining({
        acceptedBy: "u2"
      })
    );
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it("revokes invites through the backend handler", async () => {
    await revokeHouseholdInviteHandler({ householdId: "h1", inviteId: "invite-123" }, { uid: "owner-1" });

    expect(requireHouseholdAdmin).toHaveBeenCalledWith("h1", "owner-1");
    expect(inviteRef.delete).toHaveBeenCalledTimes(1);
  });
});
