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
const EMAIL_LINK_RETURN_TO_STORAGE_KEY = "stow_email_return_to";

function safeReturnTo(value?: string | null): string {
  if (!value) return "/spaces";
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin) return "/spaces";
    return `${url.pathname}${url.search}${url.hash}` || "/spaces";
  } catch {
    return value.startsWith("/") && !value.startsWith("//") ? value : "/spaces";
  }
}

export function isEmailLinkSignInUrl(currentUrl: string): boolean {
  return Boolean(auth && isSignInWithEmailLink(auth, currentUrl));
}

export function getPendingEmailLinkEmail(): string {
  return window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY) ?? "";
}

export function getPendingEmailLinkReturnTo(currentUrl?: string): string {
  const params = currentUrl ? new URL(currentUrl).searchParams : null;
  const continueUrl = params?.get("continueUrl");
  let fromContinueUrl: string | null = null;
  try {
    fromContinueUrl = continueUrl ? new URL(continueUrl).searchParams.get("returnTo") : null;
  } catch {
    fromContinueUrl = null;
  }
  const fromUrl = params?.get("returnTo") ?? fromContinueUrl;
  return safeReturnTo(fromUrl ?? window.localStorage.getItem(EMAIL_LINK_RETURN_TO_STORAGE_KEY));
}

export async function signInWithGoogle(): Promise<User> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function sendEmailLink(email: string, returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`): Promise<void> {
  if (!auth) throw new Error("Firebase Auth is not configured");
  const finishUrl = new URL("/auth/finish", window.location.origin);
  finishUrl.searchParams.set("returnTo", safeReturnTo(returnTo));
  await sendSignInLinkToEmail(auth, email, {
    url: finishUrl.toString(),
    handleCodeInApp: true
  });
  window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
  window.localStorage.setItem(EMAIL_LINK_RETURN_TO_STORAGE_KEY, safeReturnTo(returnTo));
}

export async function completeEmailLinkSignIn(currentUrl: string, email: string): Promise<User> {
  if (!auth || !isSignInWithEmailLink(auth, currentUrl)) {
    throw new Error("This sign-in link is invalid or has already been used");
  }
  if (!email.trim()) throw new Error("Email is required to complete sign-in");
  try {
    const result = await signInWithEmailLink(auth, email, currentUrl);
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
    window.localStorage.removeItem(EMAIL_LINK_RETURN_TO_STORAGE_KEY);
    return result.user;
  } catch (error) {
    const code = (error as { code?: string })?.code ?? "";
    if (code === "auth/invalid-action-code" || code === "auth/expired-action-code") {
      // Terminal for this link: a stale stored email would mislead the next attempt.
      window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
      window.localStorage.removeItem(EMAIL_LINK_RETURN_TO_STORAGE_KEY);
    }
    throw error;
  }
}

export async function signOutUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}
