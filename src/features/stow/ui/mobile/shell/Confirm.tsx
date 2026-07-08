import { useDismissable } from "@/features/stow/ui/mobile/shell/useDismissable";

export function Confirm({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) {
  const surfaceRef = useDismissable(open, onCancel);

  if (!open) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28
      }}
    >
      <div
        onClick={onCancel}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(2px)"
        }}
      />
      <div
        ref={surfaceRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{
          position: "relative",
          background: "var(--stow-surface)",
          borderRadius: 24,
          padding: 24,
          width: "100%",
          maxWidth: 300,
          boxShadow: "0 20px 50px rgba(0,0,0,0.3)",
          animation: "stowPop 0.2s ease-out"
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800, color: "var(--stow-ink)" }}>{title}</h3>
        <p style={{ margin: "0 0 20px", fontSize: 14, lineHeight: 1.5, color: "var(--stow-ink-muted)" }}>
          {body}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: "var(--stow-radius-button)",
              fontWeight: 700,
              fontSize: 15,
              border: "none",
              background: danger ? "var(--stow-danger-text)" : "var(--stow-accent-strong)",
              color: "#fff",
              cursor: "pointer"
            }}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: "100%",
              padding: "14px 0",
              borderRadius: "var(--stow-radius-button)",
              fontWeight: 700,
              fontSize: 15,
              border: "1px solid var(--stow-border)",
              background: "var(--stow-canvas)",
              color: "var(--stow-ink)",
              cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
