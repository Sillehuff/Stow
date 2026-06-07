import type { CSSProperties, ElementType, ReactNode } from "react";

export const cardStyle: CSSProperties = {
  background: "var(--stow-surface)",
  borderRadius: "var(--stow-radius-card)",
  border: "1px solid var(--stow-border-l)",
  boxShadow: "var(--stow-shadow)"
};

export function Card({
  children,
  onClick,
  style,
  as: As = "div"
}: {
  children: ReactNode;
  onClick?: () => void;
  style?: CSSProperties;
  as?: ElementType;
}) {
  return (
    <As onClick={onClick} style={{ ...cardStyle, ...(onClick ? { cursor: "pointer" } : null), ...style }}>
      {children}
    </As>
  );
}
