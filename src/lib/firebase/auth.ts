import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInAnonymously,
  signInWithEmailLink,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";
import { EMULATOR_QA_PASSWORD, EMULATOR_QA_USERS } from "@/lib/firebase/emulatorQa";

const EMAIL_LINK_STORAGE_KEY = "stow_email_for_signin";
const EMAIL_LINK_CONTINUE_PATH_STORAGE_KEY = "stow_email_link_continue_path";

function sanitizeContinuePath(value: string | null | undefined): string {
  if (!value) return "/";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/";
    const nextPath = `${url.pathname}${url.search}${url.hash}`;
    return nextPath.startsWith("/auth/finish") ? "/" : nextPath || "/";
  } catch {
    return value.startsWith("/") && !value.startsWith("//") ? value : "/";
  }
}

export async function signInWithGoogle(): Promise<User> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function sendEmailLink(email: string, continuePath?: string): Promise<void> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  const finishUrl = new URL("/auth/finish", window.location.origin);
  const nextPath = sanitizeContinuePath(continuePath);
  if (nextPath !== "/") {
    finishUrl.searchParams.set("continue", nextPath);
  }
  await sendSignInLinkToEmail(auth, email, {
    url: finishUrl.toString(),
    handleCodeInApp: true
  });
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
  window.localStorage.setItem(EMAIL_LINK_CONTINUE_PATH_STORAGE_KEY, nextPath);
}

export async function completeEmailLinkSignIn(currentUrl: string): Promise<{ user: User | null; continuePath: string } | null> {
  if (!auth || !isSignInWithEmailLink(auth, currentUrl)) return null;
  const saved = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  const email = saved ?? window.prompt("Confirm your email to complete sign-in") ?? "";
  if (!email) throw new Error("Email is required to complete sign-in");
  const result = await signInWithEmailLink(auth, email, currentUrl);
  const current = new URL(currentUrl, window.location.origin);
  const continuePath = sanitizeContinuePath(
    current.searchParams.get("continue") ?? window.localStorage.getItem(EMAIL_LINK_CONTINUE_PATH_STORAGE_KEY)
  );
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  window.localStorage.removeItem(EMAIL_LINK_CONTINUE_PATH_STORAGE_KEY);
  return { user: result.user, continuePath };
}

export async function signInWithEmailPassword(email: string, password: string): Promise<User> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signInAnonymouslyUser(): Promise<User> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export { EMULATOR_QA_PASSWORD, EMULATOR_QA_USERS };
