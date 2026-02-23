import admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

export const FieldValue = admin.firestore.FieldValue;

export const paths = {
  household: (householdId: string) => `households/${householdId}`,
  member: (householdId: string, uid: string) => `households/${householdId}/members/${uid}`,
  members: (householdId: string) => `households/${householdId}/members`,
  invite: (householdId: string, inviteId: string) => `households/${householdId}/invites/${inviteId}`,
  invites: (householdId: string) => `households/${householdId}/invites`,
  llmConfig: (householdId: string) => `households/${householdId}/settings/llm`,
  llmSecret: (householdId: string) => `households/${householdId}/settings/llmSecret`,
  visionJobs: (householdId: string) => `households/${householdId}/visionJobs`,
  user: (uid: string) => `users/${uid}`
};
