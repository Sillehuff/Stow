import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import type { HouseholdLlmConfig, VisionCategorizeRequest, VisionCategorizeResponse } from "@/types/llm";
import type { Role } from "@/types/domain";

function requireFunctions() {
  if (!functions) throw new Error("Firebase Functions is not configured");
  return functions;
}

export async function createHouseholdInvite(input: {
  householdId: string;
  role: Role;
  expiresInHours?: number;
}): Promise<{ inviteId: string; inviteUrl: string; expiresAt: string }> {
  const callable = httpsCallable<typeof input, { inviteId: string; inviteUrl: string; expiresAt: string }>(
    requireFunctions(),
    "createHouseholdInvite"
  );
  const result = await callable(input);
  return result.data;
}

export async function acceptHouseholdInvite(input: { householdId: string; token: string }): Promise<void> {
  const callable = httpsCallable<typeof input, { ok: true }>(requireFunctions(), "acceptHouseholdInvite");
  await callable(input);
}

export async function saveHouseholdLlmConfig(input: {
  householdId: string;
  config: HouseholdLlmConfig;
}): Promise<void> {
  const callable = httpsCallable<typeof input, { ok: true }>(requireFunctions(), "saveHouseholdLlmConfig");
  await callable(input);
}

export async function setHouseholdLlmSecret(input: {
  householdId: string;
  apiKey: string;
}): Promise<void> {
  const callable = httpsCallable<typeof input, { ok: true }>(requireFunctions(), "setHouseholdLlmSecret");
  await callable(input);
}

export async function validateHouseholdLlmConfig(input: {
  householdId: string;
}): Promise<{ ok: boolean; message: string }> {
  const callable = httpsCallable<typeof input, { ok: boolean; message: string }>(
    requireFunctions(),
    "validateHouseholdLlmConfig"
  );
  const result = await callable(input);
  return result.data;
}

export async function visionCategorizeItemImage(
  input: VisionCategorizeRequest
): Promise<VisionCategorizeResponse> {
  const callable = httpsCallable<VisionCategorizeRequest, VisionCategorizeResponse>(
    requireFunctions(),
    "visionCategorizeItemImage"
  );
  const result = await callable(input);
  return result.data;
}
