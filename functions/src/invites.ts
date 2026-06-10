import { createHash, randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./shared/firestore.js";
import { acceptInviteInputSchema, createInviteInputSchema, revokeInviteInputSchema } from "./shared/schemas.js";
import { requireHouseholdAdmin } from "./shared/authz.js";

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createHouseholdInviteHandler(raw: unknown, requestAuth: { uid?: string } | undefined, originHeader?: string) {
  const uid = requestAuth?.uid ?? (() => {
    throw new HttpsError("unauthenticated", "Authentication required");
  })();
  const input = createInviteInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);

  const token = randomBytes(24).toString("base64url");
  const tokenHash = hashInviteToken(token);
  const inviteRef = db.collection(paths.invites(input.householdId)).doc();
  const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 72) * 60 * 60 * 1000);

  await inviteRef.set({
    role: input.role,
    tokenHash,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    expiresAt,
    invitedEmail: input.email?.trim().toLowerCase() ?? null
  });

  const baseUrl = process.env.APP_BASE_URL ?? originHeader ?? "http://localhost:5173";
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  return {
    inviteId: inviteRef.id,
    inviteUrl: `${normalizedBase}/invite?householdId=${encodeURIComponent(input.householdId)}&token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString()
  };
}

export async function acceptHouseholdInviteHandler(raw: unknown, requestAuth: { uid?: string; token?: { email?: string } } | undefined) {
  const uid = requestAuth?.uid ?? (() => {
    throw new HttpsError("unauthenticated", "Authentication required");
  })();
  const input = acceptInviteInputSchema.parse(raw);
  const tokenHash = hashInviteToken(input.token);

  const inviteQuery = await db
    .collection(paths.invites(input.householdId))
    .where("tokenHash", "==", tokenHash)
    .limit(1)
    .get();

  if (inviteQuery.empty) {
    throw new HttpsError("not-found", "Invite not found or invalid");
  }

  const inviteRef = inviteQuery.docs[0].ref;
  const memberRef = db.doc(paths.member(input.householdId, uid));
  const userRef = db.doc(paths.user(uid));

  await db.runTransaction(async (tx) => {
    // Registers inviteRef in the transaction's read set; this arms the version check
    // that enforces single-use. Must precede the writes below — do not refactor away.
    const snap = await tx.get(inviteRef);
    if (!snap.exists) throw new HttpsError("not-found", "Invite not found or invalid");
    const inviteData = snap.data() as {
      role: string;
      expiresAt?: { toDate?: () => Date } | Date;
      acceptedAt?: unknown;
      invitedEmail?: string | null;
    };

    if (inviteData.acceptedAt) throw new HttpsError("already-exists", "Invite has already been used");

    const expiresDate =
      inviteData.expiresAt instanceof Date ? inviteData.expiresAt : inviteData.expiresAt?.toDate?.();
    if (expiresDate && expiresDate.getTime() < Date.now()) {
      throw new HttpsError("deadline-exceeded", "Invite has expired");
    }

    if (inviteData.invitedEmail) {
      const callerEmail = (requestAuth?.token?.email ?? "").trim().toLowerCase();
      if (callerEmail !== inviteData.invitedEmail) {
        // permission-denied (not not-found) is deliberate: the valid token already proves the
        // invite exists, the message names no email, and the specific copy lets a legitimate
        // invitee who signed in with the wrong account understand they need to switch accounts.
        throw new HttpsError("permission-denied", "This invite was issued to a different email address");
      }
    }

    tx.set(
      memberRef,
      {
        uid,
        role: inviteData.role,
        email: requestAuth?.token?.email ?? null,
        createdAt: FieldValue.serverTimestamp(),
        createdBy: snap.get("createdBy") ?? null
      },
      { merge: true }
    );
    tx.set(
      userRef,
      { currentHouseholdId: input.householdId, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    tx.update(inviteRef, { acceptedAt: FieldValue.serverTimestamp(), acceptedBy: uid });
  });
  return { ok: true as const };
}

export async function revokeHouseholdInviteHandler(raw: unknown, requestAuth: { uid?: string } | undefined) {
  const uid = requestAuth?.uid ?? (() => {
    throw new HttpsError("unauthenticated", "Authentication required");
  })();
  const input = revokeInviteInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);

  const inviteRef = db.doc(paths.invite(input.householdId, input.inviteId));
  const inviteSnap = await inviteRef.get();
  if (!inviteSnap.exists) {
    throw new HttpsError("not-found", "Invite not found");
  }

  await inviteRef.delete();
  return { ok: true as const };
}
