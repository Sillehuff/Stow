import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { completeEmailLinkSignIn } from "@/lib/firebase/auth";
import { toLoggedUserErrorMessage } from "@/lib/firebase/errors";

export default function AuthFinishPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"working" | "done" | "error">("working");
  const [message, setMessage] = useState("Completing sign-in…");

  useEffect(() => {
    completeEmailLinkSignIn(window.location.href)
      .then(() => {
        setStatus("done");
        setMessage("Sign-in complete. Redirecting…");
        setTimeout(() => navigate("/", { replace: true }), 700);
      })
      .catch((error) => {
        setStatus("error");
        setMessage(toLoggedUserErrorMessage(error, "Unable to complete sign-in"));
      });
  }, [navigate]);

  return (
    <div className="center-shell">
      <div className="panel auth-panel">
        <h1>Stow</h1>
        <p>{message}</p>
        {status === "error" ? (
          <button className="btn" onClick={() => navigate("/", { replace: true })}>
            Back to sign-in
          </button>
        ) : null}
      </div>
    </div>
  );
}
