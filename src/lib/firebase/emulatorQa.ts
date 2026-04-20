export const EMULATOR_QA_PASSWORD = "Passw0rd!";
export const EMULATOR_QA_HOUSEHOLD_ID = "qa-household";
export const EMULATOR_QA_INVITE_TOKEN = "qa-member-invite-token";
export const DEFAULT_FIREBASE_PROJECT_ID = "stow-50f36";

export const EMULATOR_QA_USERS = [
  { uid: "qa-owner", label: "QA Owner", email: "qa-owner@example.com", role: "OWNER" },
  { uid: "qa-admin", label: "QA Admin", email: "qa-admin@example.com", role: "ADMIN" },
  { uid: "qa-member", label: "QA Member", email: "qa-member@example.com", role: "MEMBER" }
] as const;
