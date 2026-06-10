export function ProgressBar({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const full = pct >= 100;

  return (
    <div style={{ height: 8, borderRadius: 99, background: "var(--stow-border-l)", overflow: "hidden" }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          borderRadius: 99,
          background: full ? "var(--stow-success)" : "var(--stow-accent)",
          transition: "width 0.3s"
        }}
      />
    </div>
  );
}
