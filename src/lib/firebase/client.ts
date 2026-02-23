import { initializeApp, getApps, getApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence
} from "firebase/auth";
import type { Functions } from "firebase/functions";
import type { FirebaseStorage } from "firebase/storage";
import { firebaseEnv, isFirebaseConfigured, useFirebaseEmulators } from "@/config/env";

const app = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseEnv))
  : null;

export const db = app
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    })
  : null;

export const auth = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();

let emulatorsConnected = false;
let functionsClientPromise: Promise<Functions | null> | null = null;
let storageClientPromise: Promise<FirebaseStorage | null> | null = null;

export async function initializeFirebaseClient(): Promise<void> {
  if (!app || !auth) return;

  await setPersistence(auth, browserLocalPersistence);

  if (useFirebaseEmulators && !emulatorsConnected) {
    if (db) connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    emulatorsConnected = true;
  }
}

export async function getFunctionsClient(): Promise<Functions | null> {
  if (!app) return null;
  if (!functionsClientPromise) {
    functionsClientPromise = (async () => {
      const { getFunctions, connectFunctionsEmulator } = await import("firebase/functions");
      const instance = getFunctions(app, firebaseEnv.functionsRegion);
      if (useFirebaseEmulators) {
        connectFunctionsEmulator(instance, "127.0.0.1", 5001);
      }
      return instance;
    })();
  }
  return functionsClientPromise;
}

export async function getStorageClient(): Promise<FirebaseStorage | null> {
  if (!app) return null;
  if (!storageClientPromise) {
    storageClientPromise = (async () => {
      const { getStorage, connectStorageEmulator } = await import("firebase/storage");
      const instance = getStorage(app);
      if (useFirebaseEmulators) {
        connectStorageEmulator(instance, "127.0.0.1", 9199);
      }
      return instance;
    })();
  }
  return storageClientPromise;
}

export { app, isFirebaseConfigured };
