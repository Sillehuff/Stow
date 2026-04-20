import { useState } from "react";
import type { ReactNode } from "react";
import { useFirebaseEmulators } from "@/config/env";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import {
  EMULATOR_QA_PASSWORD,
  EMULATOR_QA_USERS,
  sendEmailLink,
  signInAnonymouslyUser,
  signInWithEmailPassword,
  signInWithGoogle
} from "@/lib/firebase/auth";
import { toLoggedUserErrorMessage } from "@/lib/firebase/errors";
import { useAuthContext } from "@/features/auth/AuthProvider";

export function AuthGate({
  children,
  unauthTitle,
  unauthSubtitle,
  beforeAuthForm
}: {
  children: ReactNode;
  unauthTitle?: string;
  unauthSubtitle?: ReactNode;
  beforeAuthForm?: ReactNode;
}) {
  const { user, loading } = useAuthContext();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isFirebaseConfigured) {
    return (
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Stow</h1>
          <p>Firebase is not configured yet.</p>
          <p className="muted">
            Copy `.env.example` to `.env.local`, fill in Firebase web app credentials, then restart the dev
            server.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Stow</h1>
          <p>Checking session…</p>
        </div>
      </div>
    );
  }

  if (user) return <>{children}</>;

  return (
    <div className="center-shell">
      <div className="panel auth-panel">
        <h1>{unauthTitle || "Stow"}</h1>
        <p className="muted">{unauthSubtitle || "Sign in to access your shared household inventory."}</p>
        {beforeAuthForm}
        {error ? <div className="banner error">{error}</div> : null}
        {message ? <div className="banner ok">{message}</div> : null}
        <button
          className="btn primary"
          disabled={pending !== null}
          onClick={async () => {
            setError(null);
            setMessage(null);
            setPending("google");
            try {
              await signInWithGoogle();
            } catch (err) {
              setError(toLoggedUserErrorMessage(err, "Google sign-in failed"));
            } finally {
              setPending(null);
            }
          }}
        >
          {pending === "google" ? "Signing in…" : "Continue with Google"}
        </button>
        {useFirebaseEmulators ? (
          <div className="emulator-auth stack-sm">
            <div className="section-title">Emulator test access</div>
            <p className="muted">
              Use the seeded QA accounts from `npm run seed:qa` or create a fresh anonymous tester while running local emulators.
            </p>
            <div className="emulator-auth-actions">
              {EMULATOR_QA_USERS.map((qaUser) => (
                <button
                  key={qaUser.email}
                  type="button"
                  className="btn"
                  disabled={pending !== null}
                  onClick={async () => {
                    setError(null);
                    setMessage(null);
                    setPending(qaUser.email);
                    try {
                      await signInWithEmailPassword(qaUser.email, EMULATOR_QA_PASSWORD);
                    } catch (err) {
                      setError(toLoggedUserErrorMessage(err, `Failed to sign in as ${qaUser.label}`));
                    } finally {
                      setPending(null);
                    }
                  }}
                >
                  {pending === qaUser.email ? `Opening ${qaUser.label}…` : qaUser.label}
                </button>
              ))}
              <button
                type="button"
                className="btn"
                disabled={pending !== null}
                onClick={async () => {
                  setError(null);
                  setMessage(null);
                  setPending("anonymous");
                  try {
                    await signInAnonymouslyUser();
                  } catch (err) {
                    setError(toLoggedUserErrorMessage(err, "Failed to create a fresh emulator tester"));
                  } finally {
                    setPending(null);
                  }
                }}
              >
                {pending === "anonymous" ? "Starting fresh tester…" : "Fresh Tester"}
              </button>
            </div>
          </div>
        ) : null}
        <div className="divider">or</div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
              setError(null);
              setMessage(null);
              setPending("email");
              try {
                const continuePath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
                await sendEmailLink(email.trim(), continuePath);
                setMessage(`Sign-in link sent to ${email.trim()}`);
              } catch (err) {
                setError(toLoggedUserErrorMessage(err, "Failed to send email link"));
            } finally {
              setPending(null);
            }
          }}
          className="stack"
        >
          <label className="field">
            <span>Email address</span>
            <input
              className="input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <button className="btn" disabled={pending !== null || !email.trim()}>
            {pending === "email" ? "Sending…" : "Email Me a Sign-In Link"}
          </button>
        </form>
        {message ? (
          <div className="stack-sm">
            <div className="muted">Next steps: check your inbox and spam folder, then open the link on this device.</div>
            <button type="button" className="btn" onClick={() => setEmail("")}>
              Use Another Email
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
