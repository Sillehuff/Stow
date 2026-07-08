import type { LucideIcon } from "lucide-react";
import type { MobileTab } from "@/features/stow/ui/mobile/hooks/useMobileNavigation";
import { Home, Package, ScanLine, Search, Settings } from "@/features/stow/ui/mobile/theme/icons";

interface BottomNavProps {
  tab: MobileTab;
  onTab: (tab: MobileTab) => void;
  onScan: () => void;
  packedCount?: number;
}

const TABS: { key: MobileTab; label: string; Icon: LucideIcon }[] = [
  { key: "spaces", label: "Spaces", Icon: Home },
  { key: "search", label: "Search", Icon: Search },
  { key: "packing", label: "Packing", Icon: Package },
  { key: "settings", label: "Settings", Icon: Settings }
];

export function BottomNav({ tab, onTab, onScan, packedCount = 0 }: BottomNavProps) {
  return (
    <nav
      aria-label="Stow sections"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        bottom: "env(safe-area-inset-bottom, 0px)",
        height: 72,
        zIndex: 30,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 72px 1fr 1fr",
        alignItems: "center",
        padding: "8px 10px",
        borderRadius: 28,
        background: "color-mix(in srgb, var(--stow-surface) 92%, transparent)",
        border: "1px solid color-mix(in srgb, var(--stow-border) 70%, transparent)",
        boxShadow: "0 18px 45px rgba(20,20,28,0.16)",
        backdropFilter: "blur(20px)"
      }}
    >
      {TABS.map(({ key, label, Icon }, index) => {
        const active = tab === key;
        const cell = index < 2 ? index + 1 : index + 2;
        return (
          <button
            key={key}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onTab(key)}
            style={{
              gridColumn: cell,
              width: "100%",
              height: 54,
              border: 0,
              borderRadius: 18,
              background: active ? "var(--stow-accent-soft)" : "transparent",
              color: active ? "var(--stow-accent-text)" : "var(--stow-ink-muted)",
              display: "grid",
              placeItems: "center",
              gap: 2,
              font: "inherit",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              position: "relative"
            }}
          >
            <Icon size={21} strokeWidth={2.2} />
            <span>{label}</span>
            {key === "packing" && packedCount > 0 ? (
              <span
                aria-label={`${packedCount} unpacked`}
                style={{
                  position: "absolute",
                  top: 5,
                  right: 16,
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 99,
                  background: "var(--stow-accent-strong)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  lineHeight: 1
                }}
              >
                {packedCount > 99 ? "99+" : packedCount}
              </span>
            ) : null}
          </button>
        );
      })}
      <button
        type="button"
        aria-label="Scan"
        onClick={onScan}
        style={{
          gridColumn: 3,
          gridRow: 1,
          justifySelf: "center",
          alignSelf: "center",
          width: 58,
          height: 58,
          borderRadius: 22,
          border: "3px solid var(--stow-canvas)",
          background: "var(--stow-accent-strong)",
          color: "#fff",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 14px 32px color-mix(in srgb, var(--stow-accent) 42%, transparent)",
          cursor: "pointer"
        }}
      >
        <ScanLine size={25} strokeWidth={2.4} />
      </button>
    </nav>
  );
}
