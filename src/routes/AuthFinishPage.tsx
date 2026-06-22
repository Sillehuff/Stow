import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeEmailLinkSignIn, getPendingEmailLinkEmail, getPendingEmailLinkReturnTo, isEmailLinkSignInUrl } from "@/lib/firebase/auth";
import { toLoggedUserErrorMessage } from "@/lib/firebase/errors";

export default function AuthFinishPage() {
  const navigate = useNavigate();
  const currentUrl = window.location.href;
  const validLink = isEmailLinkSignInUrl(currentUrl);
  const initialEmail = getPendingEmailLinkEmail();
  const [returnTo] = useState(() => getPendingEmailLinkReturnTo(currentUrl));
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [submittedEmail, setSubmittedEmail] = useState(initialEmail);
  // Bumped on every manual submit so re-attempting with the SAME email still re-runs the effect
  // (a plain setSubmittedEmail to an identical value is a no-op and would otherwise hang on "working").
  const [retryNonce, setRetryNonce] = useState(0);
  const completionKeyRef = useRef<string | null>(null);
  const completionPromiseRef = useRef<Promise<void> | null>(null);
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error" | "invalid">(
    validLink ? (initialEmail ? "working" : "idle") : "invalid"
  );
  const [message, setMessage] = useState(
    validLink
      ? initialEmail
        ? "Completing sign-in…"
        : "Confirm your email to finish signing in."
      : "This sign-in link is invalid or has already expired. Request a fresh link and try again."
  );

  useEffect(() => {
    if (!validLink || !submittedEmail) return;
    const completionKey = `${currentUrl}::${submittedEmail}::${retryNonce}`;
    if (completionKeyRef.current !== completionKey) {
      completionKeyRef.current = completionKey;
      completionPromiseRef.current = completeEmailLinkSignIn(currentUrl, submittedEmail).then(() => undefined);
    }
    const completionPromise = completionPromiseRef.current;
    if (!completionPromise) return;

    let cancelled = false;
    setStatus("working");
    setMessage("Completing sign-in…");
    void completionPromise
      .then(() => {
        if (cancelled) return;
        setStatus("done");
        setMessage("Sign-in complete. Redirecting…");
        setTimeout(() => navigate(returnTo, { replace: true }), 700);
      })
      .catch((error) => {
        if (cancelled) return;
        // Firebase returns auth/invalid-action-code for BOTH a used/expired link AND a wrong
        // email (there is no distinct mismatch code), so we can't tell them apart by code. Show
        // the mapped error AND keep the email form open so the user can either correct the email
        // and retry in place, or take the "Back to sign-in" escape for a genuinely dead link.
        setStatus("error");
        setMessage(toLoggedUserErrorMessage(error, "Couldn't finish sign-in. Re-enter your email and try again, or request a fresh link."));
      });

    return () => {
      cancelled = true;
    };
  }, [currentUrl, navigate, retryNonce, returnTo, submittedEmail, validLink]);

  const showForm = validLink && (status === "idle" || status === "error");
  const showBackToSignIn = status === "error" || status === "invalid";

  return (
    <div className="center-shell">
      <div className="panel auth-panel">
        <h1>Stow</h1>
        {status === "working" || status === "done" ? <div className="auth-progress" aria-hidden="true"><span /></div> : null}
        <p>{message}</p>
        {showForm ? (
          <form
            className="stack"
            onSubmit={(event) => {
              event.preventDefault();
              if (!emailInput.trim()) {
                setStatus("error");
                setMessage("Enter the same email address used for the sign-in link.");
                return;
              }
              setSubmittedEmail(emailInput.trim());
              setRetryNonce((nonce) => nonce + 1);
              setStatus("working");
            }}
          >
            <input
              className="input"
              type="email"
              required
              autoFocus
              value={emailInput}
              placeholder="you@example.com"
              onChange={(event) => setEmailInput(event.target.value)}
            />
            <button className="btn primary" type="submit">
              Finish Sign-In
            </button>
          </form>
        ) : null}
        {showBackToSignIn ? (
          <button className="btn" onClick={() => navigate(returnTo, { replace: true })}>
            Back to sign-in
          </button>
        ) : null}
      </div>
    </div>
  );
}
