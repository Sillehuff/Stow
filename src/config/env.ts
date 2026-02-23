const env = import.meta.env;

export const firebaseEnv = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? "",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? "",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: env.VITE_FIREBASE_APP_ID ?? "",
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID ?? "",
  functionsRegion: env.VITE_FUNCTIONS_REGION ?? "us-central1"
};

export const isFirebaseConfigured = Boolean(
  firebaseEnv.apiKey &&
    firebaseEnv.authDomain &&
    firebaseEnv.projectId &&
    firebaseEnv.storageBucket &&
    firebaseEnv.messagingSenderId &&
    firebaseEnv.appId
);

export const useFirebaseEmulators =
  (env.VITE_USE_FIREBASE_EMULATORS ?? "").toLowerCase() === "true";
