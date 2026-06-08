import { useEffect, useState } from "react";
import { deleteField, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase/client";
import { householdPaths } from "@/lib/firebase/paths";

type BootstrapState = {
  householdId: string | null;
  loading: boolean;
  error: string | null;
};

async function ensureBootstrap(user: User): Promise<string> {
  if (!db) throw new Error("Firestore is not configured");

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);
  const existingHouseholdId = userSnap.exists() ? (userSnap.data().currentHouseholdId as string | undefined) : undefined;
  if (existingHouseholdId) {
    const householdRef = doc(db, householdPaths.root(existingHouseholdId));
    const memberRef = doc(db, householdPaths.member(existingHouseholdId, user.uid));
    const [householdSnap, memberSnap] = await Promise.all([getDoc(householdRef), getDoc(memberRef)]);

    if (householdSnap.exists() && memberSnap.exists()) {
      if (memberSnap.data().uid !== user.uid) {
        const repairBatch = writeBatch(db);
        repairBatch.set(
          memberRef,
          {
            uid: user.uid,
            email: user.email ?? null,
            displayName: user.displayName ?? null,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
        await repairBatch.commit();
      }
      return existingHouseholdId;
    }

    const repairBatch = writeBatch(db);
    repairBatch.set(
      userRef,
      {
        currentHouseholdId: deleteField(),
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
    await repairBatch.commit();
  }

  const householdId = crypto.randomUUID();
  const householdRef = doc(db, householdPaths.root(householdId));
  const memberRef = doc(db, householdPaths.member(householdId, user.uid));
  const llmRef = doc(db, householdPaths.llmConfig(householdId));

  const batch = writeBatch(db);
  batch.set(householdRef, {
    name: `${user.displayName ?? "My"} Household`,
    createdAt: serverTimestamp(),
    createdBy: user.uid
  });
  batch.set(memberRef, {
    uid: user.uid,
    role: "OWNER",
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    createdAt: serverTimestamp(),
    createdBy: user.uid
  });
  batch.set(userRef, {
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    currentHouseholdId: householdId,
    updatedAt: serverTimestamp()
  }, { merge: true });
  batch.set(llmRef, {
    enabled: false,
    providerType: "gemini",
    model: "gemini-2.5-flash",
    promptProfile: "default_inventory",
    temperature: 0.2,
    maxTokens: 400
  });
  await batch.commit();

  return householdId;
}

export function useHouseholdBootstrap(user: User | null) {
  const [state, setState] = useState<BootstrapState>({
    householdId: null,
    loading: !!user,
    error: null
  });

  useEffect(() => {
    if (!user) {
      setState({ householdId: null, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    ensureBootstrap(user)
      .then((householdId) => {
        if (!cancelled) setState({ householdId, loading: false, error: null });
      })
      .catch((error) => {
        if (!cancelled) {
          setState({
            householdId: null,
            loading: false,
            error: error instanceof Error ? error.message : "Failed to bootstrap household"
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
