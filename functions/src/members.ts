import { HttpsError } from "firebase-functions/v2/https";
import { db, FieldValue, paths } from "./shared/firestore.js";
import { removeHouseholdMemberInputSchema, updateMemberRoleInputSchema } from "./shared/schemas.js";

function ownersQuery(householdId: string) {
  return db.collection(paths.members(householdId)).where("role", "==", "OWNER");
}

async function requireActingAdminRole(
  transaction: FirebaseFirestore.Transaction,
  householdId: string,
  actingUid: string
) {
  const actingMemberRef = db.doc(paths.member(householdId, actingUid));
  const actingMemberSnap = await transaction.get(actingMemberRef);
  if (!actingMemberSnap.exists) {
    throw new HttpsError("permission-denied", "Admin role required");
  }

  const actingRole = actingMemberSnap.get("role");
  if (actingRole !== "OWNER" && actingRole !== "ADMIN") {
    throw new HttpsError("permission-denied", "Admin role required");
  }

  return actingRole;
}

export async function updateHouseholdMemberRoleHandler(raw: unknown, actingUid: string) {
  const input = updateMemberRoleInputSchema.parse(raw);

  await db.runTransaction(async (transaction) => {
    const actingRole = await requireActingAdminRole(transaction, input.householdId, actingUid);
    const memberRef = db.doc(paths.member(input.householdId, input.uid));
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists) {
      throw new HttpsError("not-found", "Member not found");
    }

    const currentRole = memberSnap.get("role");
    if (typeof currentRole !== "string") {
      throw new HttpsError("failed-precondition", "Member role is invalid");
    }
    if (currentRole === input.role) {
      return;
    }

    if (actingRole !== "OWNER" && (currentRole === "OWNER" || input.role === "OWNER")) {
      throw new HttpsError("permission-denied", "Only owners can change owner roles");
    }

    if (currentRole === "OWNER" && input.role !== "OWNER") {
      const ownersSnap = await transaction.get(ownersQuery(input.householdId));
      if (ownersSnap.size <= 1) {
        throw new HttpsError("failed-precondition", "Household must keep at least one owner");
      }
    }

    transaction.update(memberRef, {
      role: input.role
    });
  });

  return { ok: true as const };
}

export async function removeHouseholdMemberHandler(raw: unknown, actingUid: string) {
  const input = removeHouseholdMemberInputSchema.parse(raw);

  if (input.uid === actingUid) {
    throw new HttpsError("failed-precondition", "Ask another owner or admin to remove this account");
  }

  await db.runTransaction(async (transaction) => {
    const actingRole = await requireActingAdminRole(transaction, input.householdId, actingUid);
    const memberRef = db.doc(paths.member(input.householdId, input.uid));
    const userRef = db.doc(paths.user(input.uid));
    const memberSnap = await transaction.get(memberRef);
    if (!memberSnap.exists) {
      throw new HttpsError("not-found", "Member not found");
    }

    const currentRole = memberSnap.get("role");
    if (typeof currentRole !== "string") {
      throw new HttpsError("failed-precondition", "Member role is invalid");
    }

    if (actingRole !== "OWNER" && currentRole === "OWNER") {
      throw new HttpsError("permission-denied", "Only owners can remove another owner");
    }

    if (currentRole === "OWNER") {
      const ownersSnap = await transaction.get(ownersQuery(input.householdId));
      if (ownersSnap.size <= 1) {
        throw new HttpsError("failed-precondition", "Household must keep at least one owner");
      }
    }

    const userSnap = await transaction.get(userRef);
    if (userSnap.exists && userSnap.get("currentHouseholdId") === input.householdId) {
      transaction.set(
        userRef,
        {
          currentHouseholdId: null,
          removedFromHouseholdAt: FieldValue.serverTimestamp(),
          removedFromHouseholdId: input.householdId,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    transaction.delete(memberRef);
  });

  return { ok: true as const };
}
