import { useMemo, useState } from "react";
import type { Item, SpaceWithAreas } from "@/types/domain";
import { Bell, Clock, Folder, Inbox, Search, X } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { ResultRow } from "@/features/stow/ui/mobile/components/ResultRow";
import { SpacesList } from "@/features/stow/ui/mobile/screens/SpacesList";
import type { SpacesListProps } from "@/features/stow/ui/mobile/screens/SpacesList";

export interface HomeScreenProps {
  spaces: SpaceWithAreas[];
  items: Item[];
  householdName: string;
  onOpenItem: (itemId: string) => void;
  onBell: () => void;
  spacesList: Omit<SpacesListProps, "spaces" | "itemCountForSpace">;
}

function timestampMillis(createdAt: Item["createdAt"] | null | undefined) {
  return createdAt?.toMillis?.() ?? 0;
}

export function HomeScreen({ spaces, items, householdName, onOpenItem, onBell, spacesList }: HomeScreenProps) {
  const [query, setQuery] = useState("");

  const spaceNameById = useMemo(() => new Map(spaces.map((space) => [space.id, space.name])), [spaces]);
  const itemCountBySpaceId = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(item.spaceId, (counts.get(item.spaceId) ?? 0) + 1);
    return counts;
  }, [items]);

  const ql = query.trim().toLowerCase();
  const searching = ql.length > 0;

  const results = useMemo(() => {
    if (!searching) return [];

    return items.filter((item) => {
      const spaceName = spaceNameById.get(item.spaceId) ?? "";
      return (
        item.name.toLowerCase().includes(ql) ||
        (item.tags || []).some((tag) => tag.toLowerCase().includes(ql)) ||
        spaceName.toLowerCase().includes(ql) ||
        (item.areaNameSnapshot || "").toLowerCase().includes(ql)
      );
    });
  }, [items, ql, searching, spaceNameById]);

  const recent = useMemo(
    () =>
      items
        .slice()
        .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt))
        .slice(0, 8),
    [items]
  );

  function spaceName(spaceId: string) {
    return spaceNameById.get(spaceId) ?? "";
  }

  function itemCountForSpace(spaceId: string) {
    return itemCountBySpaceId.get(spaceId) ?? 0;
  }

  return (
    <div
      aria-label={`${householdName} home`}
      style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--stow-canvas)" }}
    >
      <div
        style={{
          padding: "calc(env(safe-area-inset-top) + 24px) 24px 14px",
          background: "color-mix(in srgb, var(--stow-surface) 90%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--stow-border-l)",
          position: "sticky",
          top: 0,
          zIndex: 20
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 900,
                color: "var(--stow-ink)",
                letterSpacing: 0,
                fontFamily: "var(--stow-display)"
              }}
            >
              Stow<span style={{ color: "var(--stow-accent)" }}>.</span>
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 12.5, fontWeight: 600, color: "var(--stow-warm)" }}>
              {items.length} items {"\u00b7"} {spaces.length} spaces
            </p>
          </div>
          <button
            type="button"
            aria-label="Activity"
            onClick={onBell}
            style={{
              width: 40,
              height: 40,
              borderRadius: 99,
              background: "var(--stow-surface)",
              border: "1px solid var(--stow-border-l)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "var(--stow-shadow-soft)",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            <Bell size={18} color="var(--stow-ink-muted)" />
          </button>
        </div>

        <div style={{ position: "relative" }}>
          <Search
            size={18}
            color={searching ? "var(--stow-accent)" : "var(--stow-warm)"}
            style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={"Find anything\u2026"}
            style={{
              width: "100%",
              boxSizing: "border-box",
              borderRadius: "var(--stow-radius-button)",
              padding: "15px 44px 15px 46px",
              fontSize: 16,
              fontWeight: 600,
              outline: "none",
              border: `1.5px solid ${searching ? "var(--stow-accent)" : "var(--stow-border)"}`,
              background: "var(--stow-canvas)",
              color: "var(--stow-ink)",
              fontFamily: "inherit",
              boxShadow: searching ? "0 0 0 4px var(--stow-accent-soft)" : "var(--stow-shadow-soft)"
            }}
          />
          {searching ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                width: 26,
                height: 26,
                borderRadius: 99,
                background: "var(--stow-border)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <X size={13} color="var(--stow-ink-muted)" />
            </button>
          ) : null}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 150px" }}>
        {searching ? (
          results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "52px 20px", color: "var(--stow-warm)" }}>
              <Search size={30} color="var(--stow-border)" style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 15.5, fontWeight: 700, color: "var(--stow-ink)" }}>No matches</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Nothing matches "{query}"</div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "var(--stow-warm)",
                  marginBottom: 10,
                  marginLeft: 2
                }}
              >
                {results.length} result{results.length !== 1 ? "s" : ""}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {results.map((item) => (
                  <ResultRow key={item.id} item={item} spaceName={spaceName(item.spaceId)} onClick={() => onOpenItem(item.id)} />
                ))}
              </div>
            </div>
          )
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, marginLeft: 2 }}>
              <Clock size={13} color="var(--stow-warm)" strokeWidth={2.2} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  color: "var(--stow-warm)"
                }}
              >
                Recently added
              </span>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                overflowX: "auto",
                padding: "2px 24px 14px",
                margin: "0 -24px",
                marginBottom: 12
              }}
            >
              {recent.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenItem(item.id)}
                  style={{
                    ...cardStyle,
                    width: 132,
                    flexShrink: 0,
                    borderRadius: "var(--stow-radius-input)",
                    overflow: "hidden",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "left",
                    fontFamily: "inherit"
                  }}
                >
                  <div
                    style={{
                      height: 94,
                      background: "var(--stow-canvas)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {item.image?.downloadUrl ? (
                      <img src={item.image.downloadUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : item.kind === "folder" ? (
                      <Folder size={26} color="var(--stow-border)" />
                    ) : (
                      <Inbox size={26} color="var(--stow-border)" />
                    )}
                  </div>
                  <div style={{ padding: "9px 11px 11px" }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--stow-ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--stow-warm)",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {spaceName(item.spaceId)}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <SpacesList spaces={spaces} itemCountForSpace={itemCountForSpace} {...spacesList} />
          </>
        )}
      </div>
    </div>
  );
}
