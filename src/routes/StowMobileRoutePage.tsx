import { lazy, Suspense, useEffect, useState } from "react";
import { AuthGate } from "@/features/auth/AuthGate";
import { useAuthContext } from "@/features/auth/AuthProvider";
import { useHouseholdBootstrap } from "@/features/household/useHouseholdBootstrap";
import { useOnlineStatus } from "@/lib/network/useOnlineStatus";
import { usePwaInstall } from "@/lib/pwa/usePwaInstall";
import { signOutUser } from "@/lib/firebase/auth";
import { toUserErrorMessage } from "@/lib/firebase/errors";

const LazyStowMobileApp = lazy(async () => {
  const mod = await import("@/features/stow/ui/mobile/StowMobileApp");
  return { default: mod.StowMobileApp };
});

function MobileRouteLoading({ message }: { message: string }) {
  return (
    <div className="center-shell">
      <div className="panel auth-panel">
        <h1>Stow</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}

function MobileWorkspaceRoute() {
  const { user } = useAuthContext();
  const bootstrap = useHouseholdBootstrap(user);
  const online = useOnlineStatus();
  const { canInstall, showIosInstallHint, promptInstall, needRefresh, updateServiceWorker } = usePwaInstall();
  const [showLongStartupHelp, setShowLongStartupHelp] = useState(false);

  useEffect(() => {
    if (!bootstrap.loading) {
      setShowLongStartupHelp(false);
      return;
    }
    const timer = window.setTimeout(() => setShowLongStartupHelp(true), 6000);
    return () => window.clearTimeout(timer);
  }, [bootstrap.loading]);

  if (!user) return null;

  if (bootstrap.loading) {
    return (
      <MobileRouteLoading
        message={showLongStartupHelp ? "Still starting your household..." : "Loading your household..."}
      />
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
              Retry Startup
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
      <div className="global-banners" aria-live="polite">
        {!online ? <div className="banner warning passive">Offline mode: edits will sync when reconnected.</div> : null}
        {canInstall ? (
          <button className="banner action" onClick={() => void promptInstall()}>
            Install Stow
          </button>
        ) : null}
        {showIosInstallHint ? <div className="banner passive">Install from Safari Share, then Add to Home Screen.</div> : null}
        {needRefresh ? (
          <button className="banner action" onClick={() => void updateServiceWorker(true)}>
            Update available. Tap to refresh.
          </button>
        ) : null}
      </div>
      <Suspense fallback={<MobileRouteLoading message="Loading Stow..." />}>
        <LazyStowMobileApp
          householdId={bootstrap.householdId}
          user={user}
          onSignOut={() => void signOutUser()}
          online={online}
        />
      </Suspense>
    </>
  );
}

export default function StowMobileRoutePage() {
  return (
    <AuthGate unauthTitle="Stow" unauthSubtitle="Sign in to open your household inventory.">
      <MobileWorkspaceRoute />
    </AuthGate>
  );
}
