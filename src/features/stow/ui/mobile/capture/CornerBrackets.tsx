import type { CSSProperties } from "react";

/**
 * Viewfinder corner brackets. Ported from prototype/photo.jsx `CornerBrackets`.
 * `color` is passed through (callers use var(--stow-accent) or a literal rgba).
 */
export function CornerBrackets({ color }: { color: string }) {
  const positions: CSSProperties[] = [
    { top: 0, left: 0 },
    { top: 0, right: 0 },
    { bottom: 0, left: 0 },
    { bottom: 0, right: 0 }
  ];
  const radii = ["18px 0 0 0", "0 18px 0 0", "0 0 0 18px", "0 0 18px 0"];
  return (
    <>
      {[0, 1, 2, 3].map((k) => (
        <div
          key={k}
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            border: `3px solid ${color}`,
            borderRadius: radii[k],
            ...positions[k],
            ...(k < 2 ? { borderBottom: "none" } : { borderTop: "none" }),
            ...(k % 2 === 0 ? { borderRight: "none" } : { borderLeft: "none" })
          }}
        />
      ))}
    </>
  );
}
