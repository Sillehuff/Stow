import { useMemo, useState } from "react";
import { ICON_CATEGORIES, iconForKey } from "@/features/stow/ui/mobile/theme/icons";

const INLINE_KEYS = ["home", "bed", "sofa", "bath", "tv", "door", "box", "package", "folder", "archive", "briefcase", "coffee"];

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (iconKey: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const libraryKeys = useMemo(() => {
    const allKeys = ICON_CATEGORIES.flatMap((category) => category.icons);
    const categoryKeys =
      activeCategory === "all" ? allKeys : ICON_CATEGORIES.find((category) => category.key === activeCategory)?.icons ?? [];
    const normalizedQuery = query.trim().toLowerCase();

    return normalizedQuery ? categoryKeys.filter((key) => key.includes(normalizedQuery)) : categoryKeys;
  }, [activeCategory, query]);

  const keys = expanded ? libraryKeys : INLINE_KEYS;

  function renderTile(key: string) {
    const Icon = iconForKey(key);
    const selected = value === key;

    return (
      <button
        key={key}
        type="button"
        aria-label={`Icon ${key}`}
        onClick={() => onChange(key)}
        style={{
          aspectRatio: "1",
          borderRadius: 10,
          display: "grid",
          placeItems: "center",
          cursor: "pointer",
          background: selected ? color : "var(--stow-canvas)",
          border: `1px solid ${selected ? color : "var(--stow-border)"}`
        }}
      >
        <Icon size={17} strokeWidth={1.9} color={selected ? "#fff" : "var(--stow-ink-muted)"} />
      </button>
    );
  }

  return (
    <div>
      {expanded ? (
        <div style={{ marginBottom: 10 }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={"Search icons…"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: "var(--stow-radius-input)",
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 500,
              outline: "none",
              border: "1.5px solid var(--stow-border)",
              background: "var(--stow-canvas)",
              color: "var(--stow-ink)",
              fontFamily: "inherit",
              marginBottom: 10
            }}
          />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[{ key: "all", label: "All" }, ...ICON_CATEGORIES].map((category) => {
              const selected = activeCategory === category.key;

              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => setActiveCategory(category.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 99,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: selected ? "none" : "1px solid var(--stow-border)",
                    background: selected ? "var(--stow-accent)" : "var(--stow-canvas)",
                    color: selected ? "#fff" : "var(--stow-ink-muted)"
                  }}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 10 }}>
        {keys.map(renderTile)}
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
        {expanded ? "Show defaults" : "All icons"}
      </button>
    </div>
  );
}
