import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./shared/firestore.js";
import { requireHouseholdAdmin } from "./shared/authz.js";
import {
  removeMemberInputSchema,
  updateMemberRoleInputSchema,
  type Role
} from "./shared/schemas.js";

type MemberRecord = {
  role?: Role;
};

async function getMemberRecord(householdId: string, uid: string) {
  const memberRef = db.doc(paths.member(householdId, uid));
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new HttpsError("not-found", "Household member not found");
  }

  const role = memberSnap.get("role");
  if (role !== "OWNER" && role !== "ADMIN" && role !== "MEMBER") {
    throw new HttpsError("failed-precondition", "Household member role is invalid");
  }

  return { memberRef, memberSnap, member: memberSnap.data() as MemberRecord & { role: Role } };
}

async function countOwners(householdId: string) {
  const ownersSnap = await db.collection(paths.members(householdId)).where("role", "==", "OWNER").get();
  return ownersSnap.size;
}

function assertAdminTargetAllowed(targetRole: Role, nextRole?: Role) {
  if (targetRole === "OWNER") {
    throw new HttpsError("permission-denied", "Admins cannot manage owners");
  }
  if (nextRole === "OWNER") {
    throw new HttpsError("permission-denied", "Admins cannot assign owner");
  }
}

async function assertMemberManagementAllowed(input: {
  householdId: string;
  actorUid: string;
  actorRole: Role;
  targetUid: string;
  targetRole: Role;
  nextRole?: Role;
  action: "updateRole" | "remove";
}) {
  if (input.actorRole === "ADMIN") {
    assertAdminTargetAllowed(input.targetRole, input.nextRole);
    return;
  }

  const isOwnerDemotion = input.action === "updateRole" && input.targetRole === "OWNER" && input.nextRole !== "OWNER";
  const isOwnerRemoval = input.action === "remove" && input.targetRole === "OWNER";

  if (isOwnerDemotion || isOwnerRemoval) {
    const ownerCount = await countOwners(input.householdId);
    if (ownerCount <= 1) {
      throw new HttpsError("failed-precondition", "This household must keep at least one owner");
    }
  }
}

export async function updateHouseholdMemberRoleHandler(raw: unknown, actorUid: string) {
  const input = updateMemberRoleInputSchema.parse(raw);
  const actorRole = (await requireHouseholdAdmin(input.householdId, actorUid)) as Role;
  const { memberRef, member } = await getMemberRecord(input.householdId, input.uid);

  await assertMemberManagementAllowed({
    householdId: input.householdId,
    actorUid,
    actorRole,
    targetUid: input.uid,
    targetRole: member.role,
    nextRole: input.role,
    action: "updateRole"
  });

  if (member.role === input.role) {
    return { ok: true as const };
  }

  await memberRef.set(
    {
      uid: input.uid,
      role: input.role,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorUid
    },
    { merge: true }
  );

  return { ok: true as const };
}

export async function removeHouseholdMemberHandler(raw: unknown, actorUid: string) {
  const input = removeMemberInputSchema.parse(raw);
  const actorRole = (await requireHouseholdAdmin(input.householdId, actorUid)) as Role;
  const [{ memberRef, member }, userSnap] = await Promise.all([
    getMemberRecord(input.householdId, input.uid),
    db.doc(paths.user(input.uid)).get()
  ]);

  await assertMemberManagementAllowed({
    householdId: input.householdId,
    actorUid,
    actorRole,
    targetUid: input.uid,
    targetRole: member.role,
    action: "remove"
  });

  const batch = db.batch();
  batch.delete(memberRef);

  if (userSnap.exists && userSnap.get("currentHouseholdId") === input.householdId) {
    batch.set(
      userSnap.ref,
      {
        currentHouseholdId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  await batch.commit();
  return { ok: true as const };
}
