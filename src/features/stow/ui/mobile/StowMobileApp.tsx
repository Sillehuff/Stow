import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { useWorkspaceData } from "@/features/stow/hooks/useWorkspaceData";
import { useMobileNavigation } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import type { MobileTab } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { applyPalette, makePalette } from "@/features/stow/ui/mobile/theme/palette";
import { BottomNav } from "@/features/stow/ui/mobile/shell/BottomNav";
import { Toast } from "@/features/stow/ui/mobile/shell/Toast";
import "@/features/stow/ui/mobile/theme/tokens.css";

interface StowMobileAppProps {
  householdId: string;
  user: User;
  onSignOut: () => void;
  online: boolean;
}

export function StowMobileApp({ householdId, user, onSignOut, online }: StowMobileAppProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nav = useMobileNavigation(householdId);
  const data = useWorkspaceData(householdId, user);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (rootRef.current) applyPalette(rootRef.current, makePalette());
  }, []);

  const packedCount = data.packingLists.reduce(
    (sum, list) => sum + Math.max(0, list.itemIds.length - list.packedItemIds.length),
    0
  );

  return (
    <div className="stow-mobile" ref={rootRef}>
      <div className="stow-mobile__viewport">
        <div className="stow-mobile__screen">
          <PlaceholderScreen
            tab={nav.tab}
            householdName={data.household?.name ?? "Your household"}
            online={online}
            counts={{ items: data.items.length, spaces: data.spaces.length }}
            onSignOut={onSignOut}
          />
        </div>
        <BottomNav
          tab={nav.tab}
          onTab={(t: MobileTab) => nav.navigateToTab(t)}
          onScan={() => setToast("Capture arrives in P2")}
          packedCount={packedCount}
        />
        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    </div>
  );
}

function PlaceholderScreen({
  tab,
  householdName,
  online,
  counts,
  onSignOut
}: {
  tab: MobileTab;
  householdName: string;
  online: boolean;
  counts: { items: number; spaces: number };
  onSignOut: () => void;
}) {
  return (
    <div style={{ padding: "calc(env(safe-area-inset-top) + 24px) 24px 24px" }}>
      <p style={{ fontFamily: "var(--stow-display)", fontSize: 30, fontWeight: 900, margin: 0 }}>
        Stow<span style={{ color: "var(--stow-accent)" }}>.</span>
      </p>
      <p style={{ color: "var(--stow-ink-muted)", marginTop: 4, fontSize: 14 }}>
        {householdName}
        {" \u00b7 "}
        {counts.items} items
        {" \u00b7 "}
        {counts.spaces} spaces{online ? "" : " \u00b7 offline"}
      </p>
      <div
        style={{
          marginTop: 32,
          padding: 20,
          borderRadius: "var(--stow-radius-card)",
          background: "var(--stow-surface)",
          border: "1px solid var(--stow-border-l)",
          boxShadow: "var(--stow-shadow)"
        }}
      >
        <p style={{ margin: 0, fontWeight: 700, textTransform: "capitalize" }}>{tab}</p>
        <p style={{ margin: "6px 0 0", color: "var(--stow-ink-muted)", fontSize: 14 }}>
          This screen is implemented in P1.
        </p>
      </div>
      {tab === "settings" ? (
        <button
          onClick={onSignOut}
          style={{
            marginTop: 16,
            background: "none",
            border: "none",
            color: "var(--stow-danger)",
            fontWeight: 600,
            cursor: "pointer"
          }}
        >
          Sign out
        </button>
      ) : null}
    </div>
  );
}
