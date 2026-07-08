import { X } from "@/features/stow/ui/mobile/theme/icons";

export function Chip({
  label,
  selected = false,
  onClick,
  color,
  onRemove
}: {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  color?: string;
  onRemove?: () => void;
}) {
  const accent = color ?? "var(--stow-accent-strong)";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "7px 12px",
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 700,
        cursor: onClick || onRemove ? "pointer" : "default",
        fontFamily: "inherit",
        border: selected ? "none" : "1px solid var(--stow-border-l)",
        background: selected ? accent : "var(--stow-canvas)",
        color: selected ? "#fff" : "var(--stow-ink-soft)"
      }}
    >
      {label}
      {onRemove ? (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{ display: "inline-flex" }}
        >
          <X size={11} color={selected ? "#fff" : "var(--stow-warm)"} style={{ opacity: 0.8 }} />
        </span>
      ) : null}
    </button>
  );
}
