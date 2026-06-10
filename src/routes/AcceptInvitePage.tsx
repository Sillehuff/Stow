import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthGate } from "@/features/auth/AuthGate";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { toLoggedUserErrorMessage } from "@/lib/firebase/errors";
import { acceptHouseholdInvite } from "@/lib/firebase/functions";

export default function AcceptInvitePage() {
  const { user } = useAuthContext();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const householdId = params.get("householdId") ?? "";
  const token = params.get("token") ?? "";
  const householdName = params.get("householdName") ?? "";
  const inviter = params.get("inviter") ?? "";
  const inviteRole = params.get("role") ?? "";
  const expiresAtRaw = params.get("expiresAt");
  const expiresAtLabel = (() => {
    if (!expiresAtRaw) return "";
    const parsed = new Date(expiresAtRaw);
    return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
  })();
  const missingParams = !householdId || !token;
  const [state, setState] = useState<{
    status: "idle" | "working" | "success" | "error";
    message: string;
  }>({
    status: missingParams ? "error" : "idle",
    message: missingParams ? "This invite link is missing information. Ask for a new invite link." : ""
  });

  return (
    <AuthGate
      unauthTitle="Accept Invite"
      unauthSubtitle="Sign in first, then accept the household invite."
      beforeAuthForm={
        <div className="stack-sm">
          {householdName ? <div className="banner">{householdName}</div> : null}
          <div className="muted">
            {inviteRole ? `Role: ${inviteRole}. ` : ""}
            {inviter ? `Invited by ${inviter}. ` : ""}
            {expiresAtLabel ? `Expires ${expiresAtLabel}.` : ""}
          </div>
        </div>
      }
    >
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Accept Invite</h1>
          <p className="muted">
            Join household {householdName ? <strong>{householdName}</strong> : <code>{householdId || "(missing)"}</code>}
          </p>
          <div className="stack-sm">
            {inviteRole ? <div className="muted">Role: {inviteRole}</div> : null}
            {inviter ? <div className="muted">Invited by: {inviter}</div> : null}
            {expiresAtLabel ? <div className="muted">Expires: {expiresAtLabel}</div> : null}
          </div>
          {state.message ? <div className={`banner ${state.status === "error" ? "error" : "ok"}`}>{state.message}</div> : null}
          <div className="stack">
            <button
              className="btn primary"
              disabled={!user || missingParams || state.status === "working"}
              onClick={async () => {
                setState({ status: "working", message: "" });
                try {
                  await acceptHouseholdInvite({ householdId, token });
                  setState({ status: "success", message: "Invite accepted. Redirecting…" });
                  setTimeout(() => navigate("/", { replace: true }), 1200);
                } catch (error) {
                  setState({
                    status: "error",
                    message: toLoggedUserErrorMessage(error, "Failed to accept invite")
                  });
                }
              }}
            >
              {state.status === "working" ? "Accepting…" : "Accept Invite"}
            </button>
            <button className="btn" onClick={() => navigate("/", { replace: true })}>
              Cancel
            </button>
            {state.status === "success" ? (
              <button className="btn primary" onClick={() => navigate("/", { replace: true })}>
                Go to Household
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
