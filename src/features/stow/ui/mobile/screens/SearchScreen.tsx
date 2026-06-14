import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Item, SpaceWithAreas } from "@/types/domain";
import { Folder, Inbox, LayoutGrid, List, Search, X } from "@/features/stow/ui/mobile/theme/icons";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { Chip } from "@/features/stow/ui/mobile/components/Chip";
import { ItemRow } from "@/features/stow/ui/mobile/components/ItemRow";
import { pushRecentSearch, readRecentSearches } from "@/features/stow/ui/mobile/screens/recentSearches";
import { matchesPackingItemPickerQuery } from "@/features/stow/ui/mobile/screens/pickerSearch";

const VIEW_KEY = "stow:mobile:search-view";

export interface SearchScreenProps {
  householdId: string;
  items: Item[];
  spaces: SpaceWithAreas[];
  onOpenItem: (itemId: string) => void;
}

export interface SearchResult {
  item: Item;
  spaceName: string;
}

export function getSearchScreenData({
  items,
  spaces,
  query
}: {
  items: Item[];
  spaces: SpaceWithAreas[];
  query: string;
}): {
  allTags: string[];
  matched: SearchResult[];
  listToShow: SearchResult[];
} {
  const spaceNameById = new Map(spaces.map((space) => [space.id, space.name]));
  const resultFor = (item: Item): SearchResult => ({ item, spaceName: spaceNameById.get(item.spaceId) ?? "" });
  const allTags = Array.from(new Set(items.flatMap((item) => item.tags || [])));
  const hasQuery = query.trim().length > 0;
  const matched = hasQuery
    ? items
        .filter((item) =>
          matchesPackingItemPickerQuery(query, [
            item.name,
            ...(item.tags || []),
            spaceNameById.get(item.spaceId) ?? "",
            item.areaNameSnapshot
          ])
        )
        .map(resultFor)
    : [];

  return {
    allTags,
    matched,
    listToShow: hasQuery ? matched : items.map(resultFor)
  };
}

function readSavedGridView() {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(VIEW_KEY) === "grid";
  } catch {
    return false;
  }
}

function Label({ children }: { children: ReactNode }) {
  return (
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
      {children}
    </div>
  );
}

export function SearchScreen(props: SearchScreenProps) {
  const { householdId, items, spaces, onOpenItem } = props;
  const [query, setQuery] = useState("");
  const [gridView, setGridView] = useState<boolean>(readSavedGridView);
  const trimmedQuery = query.trim();

  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, gridView ? "grid" : "list");
    } catch {
      // Storage can be unavailable in private mode; list view remains the non-persistent default.
    }
  }, [gridView]);

  const { allTags, matched, listToShow } = useMemo(() => getSearchScreenData({ items, spaces, query }), [items, spaces, query]);
  const recent = useMemo(() => readRecentSearches(householdId), [householdId, query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = window.setTimeout(() => pushRecentSearch(householdId, q), 450);
    return () => window.clearTimeout(timer);
  }, [householdId, query]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--stow-canvas)" }}>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top) + 24px) 24px 16px",
          background: "color-mix(in srgb, var(--stow-surface) 90%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--stow-border-l)",
          position: "sticky",
          top: 0,
          zIndex: 20
        }}
      >
        <h1
          style={{
            margin: "0 0 16px",
            fontSize: 28,
            fontWeight: 900,
            color: "var(--stow-ink)",
            fontFamily: "var(--stow-display)"
          }}
        >
          Search
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search
              size={16}
              color="var(--stow-warm)"
              style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Items, tags, or spaces..."
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: "var(--stow-radius-input)",
                padding: "12px 36px 12px 40px",
                fontSize: 15,
                fontWeight: 500,
                outline: "none",
                border: `1.5px solid ${trimmedQuery ? "var(--stow-accent)" : "var(--stow-border)"}`,
                background: "var(--stow-canvas)",
                color: "var(--stow-ink)",
                fontFamily: "inherit"
              }}
            />
            {trimmedQuery ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 28,
                  height: 28,
                  padding: 0,
                  background: "transparent",
                  border: "none",
                  borderRadius: 99,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <X size={15} color="var(--stow-warm)" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={gridView ? "Show list view" : "Show grid view"}
            onClick={() => setGridView((value) => !value)}
            style={{
              width: 44,
              height: 44,
              padding: 0,
              borderRadius: "var(--stow-radius-input)",
              background: "var(--stow-canvas)",
              border: "1px solid var(--stow-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0
            }}
          >
            {gridView ? <List size={17} color="var(--stow-ink-muted)" /> : <LayoutGrid size={17} color="var(--stow-ink-muted)" />}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px calc(env(safe-area-inset-bottom, 0px) + 88px)" }}>
        {!trimmedQuery ? (
          <>
            {recent.length > 0 ? (
              <div style={{ marginBottom: 22 }}>
                <Label>Recent</Label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {recent.map((term) => (
                    <Chip key={term} label={term} onClick={() => setQuery(term)} />
                  ))}
                </div>
              </div>
            ) : null}

            <div style={{ marginBottom: 22 }}>
              <Label>Popular Tags</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {allTags.map((tag) => (
                  <Chip key={tag} label={`#${tag}`} onClick={() => setQuery(tag)} />
                ))}
              </div>
            </div>
          </>
        ) : null}

        {trimmedQuery && matched.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--stow-warm)" }}>
            <Search size={32} color="var(--stow-border)" style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--stow-ink)" }}>No results</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Nothing matches "{query}"</div>
          </div>
        ) : (
          <div>
            <Label>
              {trimmedQuery
                ? `${matched.length} result${matched.length !== 1 ? "s" : ""}`
                : `All Items (${items.length})`}
            </Label>
            {gridView ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {listToShow.map(({ item, spaceName }) => (
                  <GridCard key={item.id} item={item} spaceName={spaceName} onClick={() => onOpenItem(item.id)} />
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {listToShow.map(({ item, spaceName }) => (
                  <ItemRow key={item.id} item={item} spaceName={spaceName} onClick={() => onOpenItem(item.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function GridCard({ item, spaceName, onClick }: { item: Item; spaceName: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...cardStyle,
        borderRadius: "var(--stow-radius-button)",
        overflow: "hidden",
        cursor: "pointer",
        padding: 0,
        textAlign: "left",
        fontFamily: "inherit"
      }}
    >
      <div
        style={{
          aspectRatio: "1",
          background: "var(--stow-canvas)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {item.image?.downloadUrl ? (
          <img src={item.image.downloadUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : item.kind === "folder" ? (
          <Folder size={28} color="var(--stow-border)" />
        ) : (
          <Inbox size={28} color="var(--stow-border)" />
        )}
      </div>
      <div style={{ padding: 10 }}>
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
            marginTop: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap"
          }}
        >
          {spaceName}
        </div>
      </div>
    </button>
  );
}
