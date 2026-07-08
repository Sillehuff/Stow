import type { CSSProperties, ReactNode } from "react";

type Variant = "primary" | "neutral" | "danger" | "ghost";

const VARIANTS: Record<Variant, CSSProperties> = {
  primary: { background: "var(--stow-accent-strong)", color: "#fff", border: "none" },
  neutral: { background: "var(--stow-canvas)", color: "var(--stow-ink)", border: "1px solid var(--stow-border)" },
  danger: { background: "var(--stow-danger-text)", color: "#fff", border: "none" },
  ghost: { background: "transparent", color: "var(--stow-accent-text)", border: "none" }
};

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled = false,
  style,
  type = "button"
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: CSSProperties;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "14px 0",
        borderRadius: "var(--stow-radius-button)",
        fontWeight: 700,
        fontSize: 15,
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: disabled ? 0.55 : 1,
        fontFamily: "inherit",
        ...VARIANTS[variant],
        ...style
      }}
    >
      {children}
    </button>
  );
}
