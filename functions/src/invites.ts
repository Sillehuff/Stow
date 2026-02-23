import { createHash, randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./shared/firestore.js";
import { acceptInviteInputSchema, createInviteInputSchema } from "./shared/schemas.js";
import { requireHouseholdAdmin } from "./shared/authz.js";

function hashInviteToken(token: string) {
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
    token,
    tokenHash,
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    expiresAt
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

  const inviteDoc = inviteQuery.docs[0];
  const inviteData = inviteDoc.data() as {
    role: string;
    expiresAt?: { toDate?: () => Date } | Date;
    acceptedAt?: unknown;
  };

  if (inviteData.acceptedAt) {
    throw new HttpsError("already-exists", "Invite has already been used");
  }

  const expiresDate =
    inviteData.expiresAt instanceof Date
      ? inviteData.expiresAt
      : inviteData.expiresAt?.toDate?.();
  if (expiresDate && expiresDate.getTime() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "Invite has expired");
  }

  const memberRef = db.doc(paths.member(input.householdId, uid));
  const userRef = db.doc(paths.user(uid));
  const batch = db.batch();
  batch.set(
    memberRef,
    {
      role: inviteData.role,
      email: requestAuth?.token?.email ?? null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: inviteDoc.get("createdBy") ?? null
    },
    { merge: true }
  );
  batch.set(userRef, { currentHouseholdId: input.householdId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  batch.update(inviteDoc.ref, {
    acceptedAt: FieldValue.serverTimestamp(),
    acceptedBy: uid
  });
  await batch.commit();
  return { ok: true as const };
}
