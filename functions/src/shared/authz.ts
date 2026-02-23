import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { db, paths } from "./firestore.js";

export function requireUid(request: CallableRequest<unknown>): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
  return uid;
}

export async function getMembershipRole(householdId: string, uid: string): Promise<string | null> {
  const snap = await db.doc(paths.member(householdId, uid)).get();
  if (!snap.exists) return null;
  return (snap.data()?.role as string | undefined) ?? null;
}

export async function requireHouseholdMember(householdId: string, uid: string): Promise<string> {
  const role = await getMembershipRole(householdId, uid);
  if (!role) throw new HttpsError("permission-denied", "You are not a member of this household");
  return role;
}

export async function requireHouseholdAdmin(householdId: string, uid: string): Promise<string> {
  const role = await requireHouseholdMember(householdId, uid);
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new HttpsError("permission-denied", "Admin role required");
  }
  return role;
}
