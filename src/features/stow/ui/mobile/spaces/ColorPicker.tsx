import { useState } from "react";
import { Check } from "@/features/stow/ui/mobile/theme/icons";

export const SPACE_SWATCHES = ["#E8652B", "#2D9F6F", "#5B6ABF", "#C4883A", "#B0479A", "#2A6FDB", "#D6336C"];

export const SPACE_SWATCHES_EXPANDED = [
  "#E8652B",
  "#2D9F6F",
  "#5B6ABF",
  "#C4883A",
  "#B0479A",
  "#2A6FDB",
  "#D6336C",
  "#1F8A5B",
  "#7A5AE0",
  "#D98A1F",
  "#3FA7D6",
  "#C0392B",
  "#16A085",
  "#8E44AD"
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const swatches = expanded ? SPACE_SWATCHES_EXPANDED : SPACE_SWATCHES;

  return (
    <div>
      <div style={{ display: "flex", gap: 11, flexWrap: "wrap", marginBottom: 10 }}>
        {swatches.map((swatch) => {
          const selected = value.toLowerCase() === swatch.toLowerCase();

          return (
            <button
              key={swatch}
              type="button"
              aria-label={`Color ${swatch}`}
              onClick={() => onChange(swatch)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 99,
                background: swatch,
                border: "none",
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
                boxShadow: selected ? `0 0 0 2.5px var(--stow-surface), 0 0 0 4.5px ${swatch}` : "none"
              }}
            >
              {selected ? <Check size={15} color="#fff" /> : null}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        style={{
          background: "none",
          border: "none",
          color: "var(--stow-accent)",
          fontWeight: 700,
          fontSize: 12.5,
          cursor: "pointer",
          fontFamily: "inherit",
          padding: 0
        }}
      >
        {expanded ? "Fewer colors" : "More colors"}
      </button>
    </div>
  );
}
