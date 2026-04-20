import { createHash, randomBytes } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./shared/firestore.js";
import { acceptInviteInputSchema, createInviteInputSchema, revokeInviteInputSchema } from "./shared/schemas.js";
import { requireHouseholdAdmin } from "./shared/authz.js";

function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function inviteDocRef(householdId: string, inviteId: string) {
  return db.doc(`${paths.invites(householdId)}/${inviteId}`);
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

  await db.runTransaction(async (transaction) => {
    if (input.replaceInviteId) {
      const existingInviteRef = inviteDocRef(input.householdId, input.replaceInviteId);
      const existingInviteSnap = await transaction.get(existingInviteRef);
      if (!existingInviteSnap.exists) {
        throw new HttpsError("not-found", "Invite not found");
      }
      if (existingInviteSnap.get("acceptedAt")) {
        throw new HttpsError("failed-precondition", "Accepted invites cannot be regenerated");
      }
      transaction.delete(existingInviteRef);
    }

    transaction.set(inviteRef, {
      role: input.role,
      token,
      tokenHash,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      expiresAt
    });
  });

  const baseUrl = process.env.APP_BASE_URL ?? originHeader ?? "http://localhost:5173";
  const normalizedBase = baseUrl.replace(/\/+$/, "");

  return {
    inviteId: inviteRef.id,
    inviteUrl: `${normalizedBase}/invite?householdId=${encodeURIComponent(input.householdId)}&token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString()
  };
}

export async function revokeHouseholdInviteHandler(raw: unknown, requestAuth: { uid?: string } | undefined) {
  const uid = requestAuth?.uid ?? (() => {
    throw new HttpsError("unauthenticated", "Authentication required");
  })();
  const input = revokeInviteInputSchema.parse(raw);
  await requireHouseholdAdmin(input.householdId, uid);

  await db.runTransaction(async (transaction) => {
    const inviteRef = inviteDocRef(input.householdId, input.inviteId);
    const inviteSnap = await transaction.get(inviteRef);
    if (!inviteSnap.exists) {
      return;
    }
    if (inviteSnap.get("acceptedAt")) {
      throw new HttpsError("failed-precondition", "Accepted invites cannot be revoked");
    }
    transaction.delete(inviteRef);
  });

  return { ok: true as const };
}

export async function acceptHouseholdInviteHandler(raw: unknown, requestAuth: { uid?: string; token?: { email?: string } } | undefined) {
  const uid = requestAuth?.uid ?? (() => {
    throw new HttpsError("unauthenticated", "Authentication required");
  })();
  const input = acceptInviteInputSchema.parse(raw);
  const tokenHash = hashInviteToken(input.token);

  await db.runTransaction(async (transaction) => {
    const inviteQuery = db
      .collection(paths.invites(input.householdId))
      .where("tokenHash", "==", tokenHash)
      .limit(1);
    const inviteQuerySnap = await transaction.get(inviteQuery);

    if (inviteQuerySnap.empty) {
      throw new HttpsError("not-found", "Invite not found or invalid");
    }

    const inviteDoc = inviteQuerySnap.docs[0];
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
    if (inviteData.role !== "MEMBER" && inviteData.role !== "ADMIN") {
      throw new HttpsError("failed-precondition", "Invite role is invalid");
    }

    const memberRef = db.doc(paths.member(input.householdId, uid));
    const userRef = db.doc(paths.user(uid));
    const [userSnap, memberSnap] = await Promise.all([
      transaction.get(userRef),
      transaction.get(memberRef)
    ]);

    if (memberSnap.exists) {
      throw new HttpsError("failed-precondition", "You already belong to this household");
    }

    const currentHouseholdId =
      userSnap.exists && typeof userSnap.get("currentHouseholdId") === "string"
        ? (userSnap.get("currentHouseholdId") as string)
        : null;
    if (currentHouseholdId && currentHouseholdId !== input.householdId) {
      throw new HttpsError(
        "failed-precondition",
        "This account already belongs to another household. Sign in with a different account to accept this invite."
      );
    }

    transaction.set(memberRef, {
      role: inviteData.role,
      email: requestAuth?.token?.email ?? null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: inviteDoc.get("createdBy") ?? null
    });

    transaction.set(userRef, {
      currentHouseholdId: input.householdId,
      removedFromHouseholdAt: FieldValue.delete(),
      removedFromHouseholdId: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.update(inviteDoc.ref, {
      acceptedAt: FieldValue.serverTimestamp(),
      acceptedBy: uid
    });
  });

  return { ok: true as const };
}
