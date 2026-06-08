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

declare global {
  // Vite HMR can reload this module while Firebase singletons remain alive.
  // Keep emulator connection state outside the module to avoid duplicate connects.
  var __stowFirebaseEmulatorsConnected: boolean | undefined;
}

function isDuplicateEmulatorConnect(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /emulator|already|settings can no longer be changed/i.test(message);
}

export async function initializeFirebaseClient(): Promise<void> {
  if (!app || !auth) return;

  if (useFirebaseEmulators && !emulatorsConnected && !globalThis.__stowFirebaseEmulatorsConnected) {
    try {
      if (db) connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } catch (error) {
      if (!isDuplicateEmulatorConnect(error)) throw error;
    }

    try {
      const authWithEmulator = auth as typeof auth & { emulatorConfig?: unknown };
      if (!authWithEmulator.emulatorConfig) {
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      }
    } catch (error) {
      if (!isDuplicateEmulatorConnect(error)) throw error;
    }

    emulatorsConnected = true;
    globalThis.__stowFirebaseEmulatorsConnected = true;
  } else if (useFirebaseEmulators) {
    emulatorsConnected = true;
  }

  await setPersistence(auth, browserLocalPersistence);
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
