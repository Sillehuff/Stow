import { getFunctionsClient } from "@/lib/firebase/client";
import type { HouseholdLlmConfig, VisionCategorizeRequest, VisionCategorizeResponse } from "@/types/llm";
import type { Role } from "@/types/domain";

async function requireFunctions() {
  const functions = await getFunctionsClient();
  if (!functions) throw new Error("Firebase Functions is not configured");
  return functions;
}

async function callFunction<TInput, TOutput>(name: string, input: TInput): Promise<TOutput> {
  const [{ httpsCallable }, functions] = await Promise.all([
    import("firebase/functions"),
    requireFunctions()
  ]);
  const callable = httpsCallable<TInput, TOutput>(functions, name);
  const result = await callable(input);
  return result.data;
}

export async function createHouseholdInvite(input: {
  householdId: string;
  role: Role;
  expiresInHours?: number;
}): Promise<{ inviteId: string; inviteUrl: string; expiresAt: string }> {
  return callFunction<typeof input, { inviteId: string; inviteUrl: string; expiresAt: string }>("createHouseholdInvite", input);
}

export async function acceptHouseholdInvite(input: { householdId: string; token: string }): Promise<void> {
  await callFunction<typeof input, { ok: true }>("acceptHouseholdInvite", input);
}

export async function saveHouseholdLlmConfig(input: {
  householdId: string;
  config: HouseholdLlmConfig;
}): Promise<void> {
  await callFunction<typeof input, { ok: true }>("saveHouseholdLlmConfig", input);
}

export async function setHouseholdLlmSecret(input: {
  householdId: string;
  apiKey: string;
}): Promise<void> {
  await callFunction<typeof input, { ok: true }>("setHouseholdLlmSecret", input);
}

export async function validateHouseholdLlmConfig(input: {
  householdId: string;
}): Promise<{ ok: boolean; message: string }> {
  return callFunction<typeof input, { ok: boolean; message: string }>("validateHouseholdLlmConfig", input);
}

export async function visionCategorizeItemImage(
  input: VisionCategorizeRequest
): Promise<VisionCategorizeResponse> {
  return callFunction<VisionCategorizeRequest, VisionCategorizeResponse>("visionCategorizeItemImage", input);
}
