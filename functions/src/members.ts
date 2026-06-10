import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./shared/firestore.js";
import { requireHouseholdAdmin } from "./shared/authz.js";
import {
  removeMemberInputSchema,
  updateMemberRoleInputSchema,
  type Role
} from "./shared/schemas.js";

function assertAdminTargetAllowed(targetRole: Role, nextRole?: Role) {
  if (targetRole === "OWNER") {
    throw new HttpsError("permission-denied", "Admins cannot manage owners");
  }
  if (nextRole === "OWNER") {
    throw new HttpsError("permission-denied", "Admins cannot assign owner");
  }
}

export async function updateHouseholdMemberRoleHandler(raw: unknown, actorUid: string) {
  const input = updateMemberRoleInputSchema.parse(raw);
  const actorRole = (await requireHouseholdAdmin(input.householdId, actorUid)) as Role;
  const memberRef = db.doc(paths.member(input.householdId, input.uid));
  const ownersQuery = db.collection(paths.members(input.householdId)).where("role", "==", "OWNER");

  await db.runTransaction(async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) {
      throw new HttpsError("not-found", "Household member not found");
    }
    const targetRole = memberSnap.get("role") as Role;
    if (targetRole !== "OWNER" && targetRole !== "ADMIN" && targetRole !== "MEMBER") {
      throw new HttpsError("failed-precondition", "Household member role is invalid");
    }

    if (actorRole === "ADMIN") {
      assertAdminTargetAllowed(targetRole, input.role);
    }

    const isOwnerDemotion = targetRole === "OWNER" && input.role !== "OWNER";
    if (actorRole !== "ADMIN" && isOwnerDemotion) {
      // Registers the owners query in the transaction's read set; this arms the version
      // check that enforces the at-least-one-owner invariant under concurrent demotion.
      // Must run inside the tx — do not refactor away.
      const owners = await tx.get(ownersQuery);
      if (owners.size <= 1) {
        throw new HttpsError("failed-precondition", "This household must keep at least one owner");
      }
    }

    if (targetRole === input.role) {
      return;
    }

    tx.set(
      memberRef,
      {
        uid: input.uid,
        role: input.role,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: actorUid
      },
      { merge: true }
    );
  });

  return { ok: true as const };
}

export async function removeHouseholdMemberHandler(raw: unknown, actorUid: string) {
  const input = removeMemberInputSchema.parse(raw);
  const actorRole = (await requireHouseholdAdmin(input.householdId, actorUid)) as Role;
  const memberRef = db.doc(paths.member(input.householdId, input.uid));
  const userRef = db.doc(paths.user(input.uid));
  const ownersQuery = db.collection(paths.members(input.householdId)).where("role", "==", "OWNER");

  await db.runTransaction(async (tx) => {
    // Admin SDK transactions require ALL reads before ANY writes — read member, owners
    // (when relevant), and the user doc up front, then perform the deletes/sets below.
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) {
      throw new HttpsError("not-found", "Household member not found");
    }
    const targetRole = memberSnap.get("role") as Role;
    if (targetRole !== "OWNER" && targetRole !== "ADMIN" && targetRole !== "MEMBER") {
      throw new HttpsError("failed-precondition", "Household member role is invalid");
    }

    if (actorRole === "ADMIN") {
      assertAdminTargetAllowed(targetRole);
    }

    if (actorRole !== "ADMIN" && targetRole === "OWNER") {
      // Registers the owners query in the transaction's read set; this arms the version
      // check that enforces the at-least-one-owner invariant under concurrent removal.
      // Must run inside the tx — do not refactor away.
      const owners = await tx.get(ownersQuery);
      if (owners.size <= 1) {
        throw new HttpsError("failed-precondition", "This household must keep at least one owner");
      }
    }

    const userSnap = await tx.get(userRef);

    tx.delete(memberRef);

    if (userSnap.exists && userSnap.get("currentHouseholdId") === input.householdId) {
      tx.set(
        userRef,
        {
          currentHouseholdId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }
  });

  return { ok: true as const };
}
