import type { LucideIcon } from "lucide-react";
import { useDismissable } from "@/features/stow/ui/mobile/shell/useDismissable";

export interface SheetAction {
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  onSelect: () => void;
}

export function ActionSheet({
  open,
  title,
  label,
  actions,
  onClose
}: {
  open: boolean;
  title?: string;
  label?: string;
  actions: SheetAction[];
  onClose: () => void;
}) {
  const surfaceRef = useDismissable(open, onClose);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 75,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end"
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.42)",
          animation: "stowPop .2s ease-out"
        }}
      />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? title ?? "Actions"}
        tabIndex={-1}
        style={{ position: "relative", padding: "0 10px calc(12px + env(safe-area-inset-bottom, 0px))", animation: "stowUp .26s ease-out" }}
      >
        <div
          style={{
            background: "color-mix(in srgb, var(--stow-surface) 93%, transparent)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 12px 36px rgba(0,0,0,0.18)"
          }}
        >
          {title ? (
            <div
              style={{
                textAlign: "center",
                padding: "15px 18px 12px",
                borderBottom: "1px solid var(--stow-border-l)",
                fontSize: 13.5,
                fontWeight: 800,
                color: "var(--stow-ink)"
              }}
            >
              {title}
            </div>
          ) : null}
          {actions.map((action, index) => {
            const Icon = action.icon;
            const actionColor = action.destructive ? "var(--stow-danger-text)" : "var(--stow-accent-text)";

            return (
              <button
                key={action.label}
                type="button"
                onClick={action.onSelect}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 9,
                  padding: "16px 18px",
                  fontSize: 17,
                  fontWeight: 600,
                  color: actionColor,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  borderTop: index === 0 && !title ? "none" : "1px solid var(--stow-border-l)"
                }}
              >
                {Icon ? <Icon size={19} color={actionColor} /> : null}
                {action.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 8,
            background: "color-mix(in srgb, var(--stow-surface) 95%, transparent)",
            backdropFilter: "blur(24px)",
            border: "none",
            borderRadius: 18,
            textAlign: "center",
            padding: "16px 18px",
            fontSize: 17,
            fontWeight: 800,
            color: "var(--stow-accent-text)",
            boxShadow: "0 12px 36px rgba(0,0,0,0.14)",
            cursor: "pointer",
            fontFamily: "inherit"
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
