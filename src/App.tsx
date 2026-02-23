import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { AuthGate } from "@/features/auth/AuthGate";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { completeEmailLinkSignIn, signOutUser } from "@/lib/firebase/auth";
import { acceptHouseholdInvite } from "@/lib/firebase/functions";
import { useHouseholdBootstrap } from "@/features/household/useHouseholdBootstrap";
import { useOnlineStatus } from "@/lib/network/useOnlineStatus";
import { usePwaInstall } from "@/lib/pwa/usePwaInstall";
import { StowApp } from "@/features/stow/ui/StowApp";

function ShellBanners({
  online,
  canInstall,
  onInstall,
  needRefresh,
  onRefresh
}: {
  online: boolean;
  canInstall: boolean;
  onInstall: () => Promise<boolean>;
  needRefresh: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="global-banners">
      {!online ? <div className="banner warning">Offline mode: core inventory edits will sync when reconnected.</div> : null}
      {canInstall ? (
        <button className="banner action" onClick={() => void onInstall()}>
          Install Stow
        </button>
      ) : null}
      {needRefresh ? (
        <button className="banner action" onClick={() => void onRefresh()}>
          Update available. Tap to refresh.
        </button>
      ) : null}
    </div>
  );
}

function AuthFinishPage() {
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
        setMessage(error instanceof Error ? error.message : "Unable to complete sign-in");
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

function AcceptInvitePage() {
  const { user } = useAuthContext();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<{ working: boolean; message: string }>({
    working: false,
    message: ""
  });
  const householdId = params.get("householdId") ?? "";
  const token = params.get("token") ?? "";

  return (
    <AuthGate>
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Accept Invite</h1>
          <p className="muted">
            Join household <code>{householdId || "(missing)"}</code>
          </p>
          {state.message ? <div className="banner ok">{state.message}</div> : null}
          <div className="stack">
            <button
              className="btn primary"
              disabled={!user || !householdId || !token || state.working}
              onClick={async () => {
                setState({ working: true, message: "" });
                try {
                  await acceptHouseholdInvite({ householdId, token });
                  setState({ working: false, message: "Invite accepted. Redirecting…" });
                  setTimeout(() => navigate("/", { replace: true }), 800);
                } catch (error) {
                  setState({
                    working: false,
                    message: error instanceof Error ? error.message : "Failed to accept invite"
                  });
                }
              }}
            >
              {state.working ? "Accepting…" : "Accept Invite"}
            </button>
            <button className="btn" onClick={() => navigate("/", { replace: true })}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function WorkspaceRoute() {
  const { user } = useAuthContext();
  const bootstrap = useHouseholdBootstrap(user);
  const online = useOnlineStatus();
  const { canInstall, promptInstall, needRefresh, updateServiceWorker } = usePwaInstall();

  if (!user) {
    return null;
  }

  if (bootstrap.loading) {
    return (
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Stow</h1>
          <p>Loading household…</p>
        </div>
      </div>
    );
  }

  if (bootstrap.error || !bootstrap.householdId) {
    return (
      <div className="center-shell">
        <div className="panel auth-panel">
          <h1>Stow</h1>
          <div className="banner error">{bootstrap.error ?? "No household available."}</div>
          <button className="btn" onClick={() => void signOutUser()}>
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <ShellBanners
        online={online}
        canInstall={canInstall}
        onInstall={promptInstall}
        needRefresh={needRefresh}
        onRefresh={() => updateServiceWorker(true)}
      />
      <StowApp householdId={bootstrap.householdId} user={user} onSignOut={() => void signOutUser()} online={online} />
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/auth/finish" element={<AuthFinishPage />} />
      <Route path="/invite" element={<AcceptInvitePage />} />
      <Route
        path="/spaces/:spaceId?"
        element={
          <AuthGate>
            <WorkspaceRoute />
          </AuthGate>
        }
      />
      <Route path="/" element={<Navigate to="/spaces" replace />} />
      <Route
        path="*"
        element={
          <Navigate to="/spaces" replace />
        }
      />
    </Routes>
  );
}
