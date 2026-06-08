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
  const nextReturn = returnTo.startsWith("/next");
  const [emailInput, setEmailInput] = useState(initialEmail);
  const [submittedEmail, setSubmittedEmail] = useState(initialEmail);
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
    const completionKey = `${currentUrl}::${submittedEmail}`;
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
        setStatus("error");
        setMessage(toLoggedUserErrorMessage(error, "Unable to complete sign-in"));
      });

    return () => {
      cancelled = true;
    };
  }, [currentUrl, navigate, returnTo, submittedEmail, validLink]);

  return (
    <div className={`center-shell ${nextReturn ? "next-auth-shell" : ""}`}>
      <div className={`panel auth-panel ${nextReturn ? "next-auth-panel" : ""}`}>
        <h1>{nextReturn ? "Stow Next" : "Stow"}</h1>
        {status === "working" || status === "done" ? <div className="next-auth-progress" aria-hidden="true"><span /></div> : null}
        <p>{message}</p>
        {nextReturn ? <p className="muted">After this finishes, you will return to the redesigned workspace.</p> : null}
        {status === "idle" ? (
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
        {status === "error" || status === "invalid" ? (
          <button className="btn" onClick={() => navigate(returnTo, { replace: true })}>
            Back to sign-in
          </button>
        ) : null}
      </div>
    </div>
  );
}
