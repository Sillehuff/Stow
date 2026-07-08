import type { Role } from "@/types/domain";

const COLOR: Record<Role, string> = {
  OWNER: "var(--stow-accent-text)",
  ADMIN: "var(--stow-success-text)",
  MEMBER: "var(--stow-warm)"
};

export function RoleBadge({ role }: { role: Role }) {
  const color = COLOR[role];

  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        padding: "3px 8px",
        borderRadius: 8
      }}
    >
      {role}
    </span>
  );
}
