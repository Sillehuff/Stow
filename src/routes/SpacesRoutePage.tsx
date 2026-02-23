import { lazy, Suspense } from "react";
import { AuthGate } from "@/features/auth/AuthGate";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { useHouseholdBootstrap } from "@/features/household/useHouseholdBootstrap";
import { useOnlineStatus } from "@/lib/network/useOnlineStatus";
import { usePwaInstall } from "@/lib/pwa/usePwaInstall";
import { signOutUser } from "@/lib/firebase/auth";
import { toUserErrorMessage } from "@/lib/firebase/errors";

const LazyStowApp = lazy(async () => {
  const mod = await import("@/features/stow/ui/StowApp");
  return { default: mod.StowApp };
});

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
    <div className="global-banners" aria-live="polite">
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
          <div className="banner error">{toUserErrorMessage(bootstrap.error, "No household available.")}</div>
          <div className="stack">
            <button className="btn" onClick={() => window.location.reload()}>
              Retry
            </button>
            <button className="btn" onClick={() => void signOutUser()}>
              Sign Out
            </button>
          </div>
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
      <Suspense
        fallback={
          <div className="center-shell">
            <div className="panel auth-panel">
              <h1>Stow</h1>
              <p>Loading app…</p>
            </div>
          </div>
        }
      >
        <LazyStowApp householdId={bootstrap.householdId} user={user} onSignOut={() => void signOutUser()} online={online} />
      </Suspense>
    </>
  );
}

export default function SpacesRoutePage() {
  return (
    <AuthGate>
      <WorkspaceRoute />
    </AuthGate>
  );
}
