import { useEffect, useState } from "react";
import { deleteField, doc, getDoc, getDocFromServer, runTransaction, serverTimestamp, writeBatch } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase/client";
import { householdPaths } from "@/lib/firebase/paths";
import { buildStarterSpaces } from "@/features/stow/seed";
import { toUserErrorMessage } from "@/lib/firebase/errors";

type BootstrapState = {
  householdId: string | null;
  loading: boolean;
  error: string | null;
};

async function ensureBootstrap(user: User): Promise<string> {
  if (!db) throw new Error("Firestore is not configured");
  // Bind a non-null reference so the transaction closure keeps the narrowing.
  const firestore = db;

  const userRef = doc(firestore, "users", user.uid);
  let userSnap;
  try {
    userSnap = await getDocFromServer(userRef);
  } catch {
    userSnap = await getDoc(userRef); // offline: cached doc keeps returning users working
  }
  const existingHouseholdId = userSnap.exists() ? (userSnap.data().currentHouseholdId as string | undefined) : undefined;
  if (existingHouseholdId) {
    const householdRef = doc(firestore, householdPaths.root(existingHouseholdId));
    const memberRef = doc(firestore, householdPaths.member(existingHouseholdId, user.uid));
    const [householdSnap, memberSnap] = await Promise.all([getDoc(householdRef), getDoc(memberRef)]);

    if (householdSnap.exists() && memberSnap.exists()) {
      if (memberSnap.data().uid !== user.uid) {
        const repairBatch = writeBatch(firestore);
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

    const repairBatch = writeBatch(firestore);
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
  const householdRef = doc(firestore, householdPaths.root(householdId));
  const memberRef = doc(firestore, householdPaths.member(householdId, user.uid));
  const llmRef = doc(firestore, householdPaths.llmConfig(householdId));

  const winnerHouseholdId = await runTransaction(firestore, async (tx) => {
    const fresh = await tx.get(userRef);
    const current = fresh.exists() ? (fresh.data().currentHouseholdId as string | undefined) : undefined;
    if (current) return current; // another device or invite-accept won the race

    tx.set(householdRef, {
      name: `${user.displayName ?? "My"} Household`,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    tx.set(memberRef, {
      uid: user.uid,
      role: "OWNER",
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      createdAt: serverTimestamp(),
      createdBy: user.uid
    });
    tx.set(userRef, {
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      currentHouseholdId: householdId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    tx.set(llmRef, {
      enabled: false,
      providerType: "gemini",
      model: "gemini-2.5-flash",
      promptProfile: "default_inventory",
      temperature: 0.2,
      maxTokens: 400
    });

    const starter = buildStarterSpaces(householdId);
    for (const space of starter.spaces) {
      tx.set(doc(firestore, householdPaths.space(householdId, space.id)), {
        ...space,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    for (const area of starter.areas) {
      tx.set(doc(firestore, householdPaths.area(householdId, area.spaceId, area.id)), {
        ...area,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    return householdId;
  });

  if (winnerHouseholdId !== householdId) {
    // Lost the race — validate the winning household the same way the top of this function does.
    return ensureBootstrap(user);
  }
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
            error: toUserErrorMessage(error, "Failed to set up your household")
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return state;
}
