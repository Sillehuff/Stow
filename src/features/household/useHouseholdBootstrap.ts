import { useEffect, useState } from "react";
import { doc, getDoc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase/client";
import { householdPaths } from "@/lib/firebase/paths";
import { normalizeSeedForHousehold, stripUndefined } from "@/features/stow/seed";

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
    return existingHouseholdId;
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
    providerType: "openai_compatible",
    model: "gpt-4.1-mini",
    baseUrl: "https://api.openai.com/v1",
    promptProfile: "default_inventory",
    temperature: 0.2,
    maxTokens: 400
  });
  await batch.commit();

  const seed = normalizeSeedForHousehold(householdId);
  const seedBatch = writeBatch(db);
  for (const space of seed.spaces) {
    seedBatch.set(doc(db, householdPaths.space(householdId, space.id)), stripUndefined({
      ...space,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  }
  for (const area of seed.areas) {
    seedBatch.set(doc(db, householdPaths.area(householdId, area.spaceId, area.id)), stripUndefined({
      ...area,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }));
  }
  for (const item of seed.items) {
    seedBatch.set(doc(db, householdPaths.item(householdId, item.id)), stripUndefined({
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid,
      updatedBy: user.uid
    }));
  }
  await seedBatch.commit();

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
