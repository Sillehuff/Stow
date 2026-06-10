import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { logger } from "firebase-functions";
import { ZodError } from "zod";
import {
  createHouseholdInviteHandler,
  acceptHouseholdInviteHandler,
  revokeHouseholdInviteHandler
} from "./invites.js";
import {
  saveHouseholdLlmConfigHandler,
  setHouseholdLlmSecretHandler,
  validateHouseholdLlmConfigHandler
} from "./llmConfig.js";
import { visionCategorizeItemImageHandler, visionDetectShelfItemsHandler } from "./vision.js";
import { removeHouseholdMemberHandler, updateHouseholdMemberRoleHandler } from "./members.js";

setGlobalOptions({
  region: process.env.FUNCTIONS_REGION || "us-central1",
  maxInstances: 10
});

function mapError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    return new HttpsError("invalid-argument", issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request");
  }
  logger.error("Unhandled function error", error);
  return new HttpsError("internal", "Something went wrong. Please try again.");
}

export const createHouseholdInvite = onCall(async (request) => {
  try {
    return await createHouseholdInviteHandler(
      request.data,
      request.auth ? { uid: request.auth.uid } : undefined,
      request.rawRequest.get("origin") ?? undefined
    );
  } catch (error) {
    throw mapError(error);
  }
});

export const acceptHouseholdInvite = onCall(async (request) => {
  try {
    return await acceptHouseholdInviteHandler(
      request.data,
      request.auth ? { uid: request.auth.uid, token: request.auth.token as { email?: string } } : undefined
    );
  } catch (error) {
    throw mapError(error);
  }
});

export const revokeHouseholdInvite = onCall(async (request) => {
  try {
    return await revokeHouseholdInviteHandler(
      request.data,
      request.auth ? { uid: request.auth.uid } : undefined
    );
  } catch (error) {
    throw mapError(error);
  }
});

export const updateHouseholdMemberRole = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await updateHouseholdMemberRoleHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const removeHouseholdMember = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await removeHouseholdMemberHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const saveHouseholdLlmConfig = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await saveHouseholdLlmConfigHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const setHouseholdLlmSecret = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await setHouseholdLlmSecretHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const validateHouseholdLlmConfig = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await validateHouseholdLlmConfigHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const visionCategorizeItemImage = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await visionCategorizeItemImageHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const visionDetectShelfItems = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await visionDetectShelfItemsHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});
