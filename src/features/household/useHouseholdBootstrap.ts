import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "@/lib/firebase/client";
import { bootstrapHousehold } from "@/lib/firebase/functions";

type BootstrapState = {
  householdId: string | null;
  loading: boolean;
  error: string | null;
};

const bootstrapRequestsByUid = new Map<string, Promise<string>>();

async function ensureBootstrap(user: User): Promise<string> {
  if (!db) throw new Error("Firestore is not configured");
  const existingRequest = bootstrapRequestsByUid.get(user.uid);
  if (existingRequest) return existingRequest;

  const request = bootstrapHousehold()
    .then((result) => result.householdId)
    .finally(() => {
      bootstrapRequestsByUid.delete(user.uid);
    });

  bootstrapRequestsByUid.set(user.uid, request);
  return request;
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

  useEffect(() => {
    if (!user || !db) return;

    const userRef = doc(db, "users", user.uid);
    return onSnapshot(userRef, (snap) => {
      if (!snap.exists()) return;

      const currentHouseholdId = (snap.data().currentHouseholdId as string | null | undefined) ?? null;
      const removedFromHouseholdAt = snap.data().removedFromHouseholdAt;

      if (!currentHouseholdId && removedFromHouseholdAt) {
        setState({
          householdId: null,
          loading: false,
          error: "You no longer have access to this household. Ask an owner to invite you again."
        });
        return;
      }

      if (currentHouseholdId) {
        setState((prev) =>
          prev.householdId === currentHouseholdId && prev.error === null && !prev.loading
            ? prev
            : { householdId: currentHouseholdId, loading: false, error: null }
        );
      }
    });
  }, [user]);

  return state;
}
