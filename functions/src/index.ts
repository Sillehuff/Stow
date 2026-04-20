import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { logger } from "firebase-functions";
import { ZodError } from "zod";
import { bootstrapHouseholdHandler } from "./bootstrap.js";
import { createHouseholdInviteHandler, acceptHouseholdInviteHandler, revokeHouseholdInviteHandler } from "./invites.js";
import {
  saveHouseholdLlmConfigHandler,
  setHouseholdLlmSecretHandler,
  validateHouseholdLlmConfigHandler
} from "./llmConfig.js";
import { removeHouseholdMemberHandler, updateHouseholdMemberRoleHandler } from "./members.js";
import {
  clearPackingListPackedHandler,
  createPackingListHandler,
  deleteAreaHandler,
  deleteItemHandler,
  deletePackingListHandler,
  deleteSpaceHandler,
  togglePackingListItemHandler,
  updatePackingListHandler
} from "./stow.js";
import { visionCategorizeItemImageHandler } from "./vision.js";

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
  return new HttpsError("internal", error instanceof Error ? error.message : "Unexpected error");
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

export const bootstrapHousehold = onCall(async (request) => {
  try {
    return await bootstrapHouseholdHandler(
      request.auth ? { uid: request.auth.uid, token: request.auth.token as { email?: string; name?: string } } : undefined
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

export const deleteHouseholdArea = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await deleteAreaHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const deleteHouseholdSpace = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await deleteSpaceHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const deleteHouseholdItem = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await deleteItemHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const createHouseholdPackingList = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await createPackingListHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const updateHouseholdPackingList = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await updatePackingListHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const deleteHouseholdPackingList = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await deletePackingListHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const toggleHouseholdPackingListItem = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await togglePackingListItemHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});

export const clearHouseholdPackingListPacked = onCall(async (request) => {
  try {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    return await clearPackingListPackedHandler(request.data, uid);
  } catch (error) {
    throw mapError(error);
  }
});
