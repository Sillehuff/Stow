import { randomUUID } from "node:crypto";
import { HttpsError } from "firebase-functions/v2/https";
import { FieldValue, db, paths } from "./shared/firestore.js";

export async function bootstrapHouseholdHandler(
  requestAuth: { uid?: string; token?: { email?: string; name?: string } } | undefined
) {
  const uid = requestAuth?.uid ?? (() => {
    throw new HttpsError("unauthenticated", "Authentication required");
  })();

  return db.runTransaction(async (transaction) => {
    const userRef = db.doc(paths.user(uid));
    const userSnap = await transaction.get(userRef);
    const currentHouseholdId =
      userSnap.exists && typeof userSnap.get("currentHouseholdId") === "string"
        ? (userSnap.get("currentHouseholdId") as string)
        : null;

    if (currentHouseholdId) {
      const currentMemberSnap = await transaction.get(db.doc(paths.member(currentHouseholdId, uid)));
      if (currentMemberSnap.exists) {
        return { householdId: currentHouseholdId };
      }
    }

    if (userSnap.exists && userSnap.get("removedFromHouseholdAt")) {
      throw new HttpsError("failed-precondition", "You no longer have access to this household. Ask an owner to invite you again.");
    }

    const membershipsSnap = await transaction.get(db.collectionGroup("members"));
    const existingMembership = membershipsSnap.docs.find((membershipDoc) => membershipDoc.id === uid);
    if (existingMembership) {
      const householdId = existingMembership.ref.parent.parent?.id ?? null;
      if (!householdId) {
        throw new HttpsError("failed-precondition", "Existing membership is invalid");
      }

      transaction.set(
        userRef,
        {
          email: requestAuth?.token?.email ?? userSnap.get("email") ?? null,
          displayName: requestAuth?.token?.name ?? userSnap.get("displayName") ?? null,
          currentHouseholdId: householdId,
          removedFromHouseholdAt: FieldValue.delete(),
          removedFromHouseholdId: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return { householdId };
    }

    const householdId = randomUUID();
    const householdRef = db.doc(paths.household(householdId));
    const memberRef = db.doc(paths.member(householdId, uid));
    const llmRef = db.doc(paths.llmConfig(householdId));

    transaction.set(householdRef, {
      name: `${requestAuth?.token?.name ?? "My"} Household`,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid
    });
    transaction.set(memberRef, {
      role: "OWNER",
      email: requestAuth?.token?.email ?? null,
      displayName: requestAuth?.token?.name ?? null,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid
    });
    transaction.set(
      userRef,
      {
        email: requestAuth?.token?.email ?? null,
        displayName: requestAuth?.token?.name ?? null,
        currentHouseholdId: householdId,
        removedFromHouseholdAt: FieldValue.delete(),
        removedFromHouseholdId: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    transaction.set(llmRef, {
      enabled: false,
      providerType: "openai_compatible",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      promptProfile: "default_inventory",
      temperature: 0.2,
      maxTokens: 400
    });

    return { householdId };
  });
}
