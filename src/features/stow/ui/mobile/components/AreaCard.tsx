import { Box } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";

export function AreaCard({
  name,
  count = 0,
  color,
  onClick
}: {
  name: string;
  count?: number;
  color?: string;
  onClick?: () => void;
}) {
  const accent = color ?? "var(--stow-accent)";

  return (
    <div
      onClick={onClick}
      style={{
        ...cardStyle,
        borderRadius: "var(--stow-radius-input)",
        padding: 16,
        cursor: onClick ? "pointer" : "default",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 104
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: `color-mix(in srgb, ${accent} 9%, transparent)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Box size={18} color={accent} strokeWidth={1.9} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--stow-ink)", lineHeight: 1.3 }}>{name}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--stow-warm)", marginTop: 2 }}>
          {count} item{count !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
