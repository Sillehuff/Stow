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
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { connectStorageEmulator, getStorage } from "firebase/storage";
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
export const storage = app ? getStorage(app) : null;
export const functions = app ? getFunctions(app, firebaseEnv.functionsRegion) : null;
export const googleProvider = new GoogleAuthProvider();

let emulatorsConnected = false;

export async function initializeFirebaseClient(): Promise<void> {
  if (!app || !auth) return;

  await setPersistence(auth, browserLocalPersistence);

  if (useFirebaseEmulators && !emulatorsConnected) {
    if (db) connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    if (functions) connectFunctionsEmulator(functions, "127.0.0.1", 5001);
    if (storage) connectStorageEmulator(storage, "127.0.0.1", 9199);
    emulatorsConnected = true;
  }
}

export { app, isFirebaseConfigured };
