import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  type User
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase/client";

const EMAIL_LINK_STORAGE_KEY = "stow_email_for_signin";

export async function signInWithGoogle(): Promise<User> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function sendEmailLink(email: string): Promise<void> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  await sendSignInLinkToEmail(auth, email, {
    url: window.location.origin + "/auth/finish",
    handleCodeInApp: true
  });
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
}

export async function completeEmailLinkSignIn(currentUrl: string): Promise<User | null> {
  if (!auth || !isSignInWithEmailLink(auth, currentUrl)) return null;
  const saved = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  const email = saved ?? window.prompt("Confirm your email to complete sign-in") ?? "";
  if (!email) throw new Error("Email is required to complete sign-in");
  const result = await signInWithEmailLink(auth, email, currentUrl);
  window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}
