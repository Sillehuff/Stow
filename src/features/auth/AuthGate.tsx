import { useState } from "react";
import type { ReactNode } from "react";
import { isFirebaseConfigured } from "@/lib/firebase/client";
import { sendEmailLink, signInWithGoogle } from "@/lib/firebase/auth";
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
  const [pending, setPending] = useState<null | "google" | "email">(null);
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
        <div className="divider">or</div>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setMessage(null);
            setPending("email");
            try {
              await sendEmailLink(email.trim());
              setMessage(`Sign-in link sent to ${email.trim()}`);
            } catch (err) {
              setError(toLoggedUserErrorMessage(err, "Failed to send email link"));
            } finally {
              setPending(null);
            }
          }}
          className="stack"
        >
          <input
            className="input"
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
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
