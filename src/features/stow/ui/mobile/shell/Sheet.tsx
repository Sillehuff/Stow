import type { ReactNode } from "react";
import { X } from "@/features/stow/ui/mobile/theme/icons";
import { useDismissable } from "@/features/stow/ui/mobile/shell/useDismissable";

export function Sheet({
  open,
  onClose,
  title,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const surfaceRef = useDismissable(open, onClose);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 70,
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
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(2px)"
        }}
      />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: "relative",
          background: "var(--stow-surface)",
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.18)",
          maxHeight: "86%",
          display: "flex",
          flexDirection: "column",
          animation: "stowUp 0.3s ease-out"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: "var(--stow-border)" }} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "4px 24px 12px"
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "var(--stow-ink)", margin: 0 }}>{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 99,
              background: "var(--stow-canvas)",
              border: "none",
              display: "grid",
              placeItems: "center",
              cursor: "pointer"
            }}
          >
            <X size={14} color="var(--stow-ink-muted)" />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px calc(32px + env(safe-area-inset-bottom, 0px))" }}>{children}</div>
      </div>
    </div>
  );
}
