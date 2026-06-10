import type { KeyboardEvent } from "react";
import type { SpaceWithAreas } from "@/types/domain";
import { cardStyle } from "@/features/stow/ui/mobile/components/Card";
import { useHoldToReorder } from "@/features/stow/ui/mobile/hooks/useHoldToReorder";
import { iconForKey, MoreHorizontal, Plus } from "@/features/stow/ui/mobile/theme/icons";

export interface SpacesListProps {
  spaces: SpaceWithAreas[];
  itemCountForSpace: (spaceId: string) => number;
  onOpenSpace: (spaceId: string) => void;
  onOpenMenu: (spaceId: string) => void;
  onReorder: (orderedIds: string[]) => void;
  onRename: (spaceId: string, nextName: string) => void;
  onAddSpace: () => void;
  renamingId: string | null;
  renameValue: string;
  onRenameValueChange: (value: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
}

function Grip({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
      {[6, 12, 18].map((y) => (
        <g key={y}>
          <circle cx="9" cy={y} r="1.4" fill={color} />
          <circle cx="15" cy={y} r="1.4" fill={color} />
        </g>
      ))}
    </svg>
  );
}

export function SpacesList({
  spaces,
  itemCountForSpace,
  onOpenSpace,
  onOpenMenu,
  onReorder,
  onAddSpace,
  renamingId,
  renameValue,
  onRenameValueChange,
  onRenameCommit,
  onRenameCancel
}: SpacesListProps) {
  const ids = spaces.map((space) => space.id);
  const { order, draggingId, bind, containerRef, suppressClick } = useHoldToReorder<string>({ ids, onReorder });
  const spacesById = new Map(spaces.map((space) => [space.id, space]));

  function onRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") onRenameCommit();
    if (event.key === "Escape") onRenameCancel();
  }

  return (
    <>
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
        Your Spaces
      </div>

      <div ref={containerRef} style={{ ...cardStyle, overflow: "hidden" }}>
        {order.map((id) => {
          const space = spacesById.get(id);
          if (!space) return null;

          const isRenaming = renamingId === id;
          const isDragging = draggingId === id;
          const itemCount = itemCountForSpace(id);
          const Icon = iconForKey(space.icon);

          return (
            <div
              key={id}
              data-reorder-row
              {...bind(id)}
              onClick={() => {
                if (suppressClick() || draggingId || isRenaming) return;
                onOpenSpace(id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px 14px 18px",
                cursor: isDragging ? "grabbing" : "pointer",
                borderBottom: "1px solid var(--stow-border-l)",
                background: isDragging ? "var(--stow-surface)" : "transparent",
                boxShadow: isDragging ? "0 18px 40px rgba(0,0,0,0.20)" : "none",
                borderRadius: isDragging ? 14 : 0,
                touchAction: isDragging ? "none" : "auto"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0, flex: 1 }}>
                {space.image?.downloadUrl ? (
                  <img
                    src={space.image.downloadUrl}
                    alt=""
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      objectFit: "cover",
                      border: "1px solid var(--stow-border-l)",
                      flexShrink: 0
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `color-mix(in srgb, ${space.color} 10%, transparent)`,
                      flexShrink: 0
                    }}
                  >
                    <Icon size={20} strokeWidth={1.9} color={space.color} />
                  </div>
                )}

                <div style={{ minWidth: 0, flex: 1 }}>
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => onRenameValueChange(event.target.value)}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={onRenameKeyDown}
                      onBlur={onRenameCommit}
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        border: "1.5px solid var(--stow-accent)",
                        borderRadius: 9,
                        padding: "7px 10px",
                        fontSize: 15.5,
                        fontWeight: 700,
                        color: "var(--stow-ink)",
                        outline: "none",
                        background: "var(--stow-canvas)",
                        fontFamily: "inherit"
                      }}
                    />
                  ) : (
                    <>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: "var(--stow-ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis"
                        }}
                      >
                        {space.name}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--stow-warm)",
                          marginTop: 2,
                          whiteSpace: "nowrap"
                        }}
                      >
                        {space.areas.length} areas {"\u00b7"} {itemCount} item{itemCount !== 1 ? "s" : ""}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {isRenaming ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRenameCommit();
                  }}
                  style={{
                    marginLeft: 10,
                    padding: "7px 14px",
                    borderRadius: 99,
                    border: "none",
                    background: "var(--stow-accent)",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap"
                  }}
                >
                  Done
                </button>
              ) : isDragging ? (
                <Grip color="var(--stow-accent)" />
              ) : (
                <button
                  type="button"
                  aria-label={`${space.name} space actions`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenMenu(id);
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 99,
                    border: "1px solid transparent",
                    background: "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0
                  }}
                >
                  <MoreHorizontal size={18} color="var(--stow-warm)" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onAddSpace}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: 16,
            cursor: "pointer",
            border: "none",
            borderTop: "1px solid var(--stow-border-l)",
            background: "transparent",
            color: "var(--stow-accent)",
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "inherit"
          }}
        >
          <Plus size={16} strokeWidth={2.5} color="var(--stow-accent)" />
          Add Space
        </button>
      </div>

      <div
        style={{
          marginTop: 13,
          display: "flex",
          flexDirection: "column",
          gap: 7,
          fontSize: 11.5,
          color: "var(--stow-warm)",
          fontWeight: 600
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <MoreHorizontal size={14} color="var(--stow-warm)" />
          Tap {"\u00b7\u00b7\u00b7"} to edit, rename, or delete a space.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Grip color="var(--stow-warm)" />
          Touch &amp; hold a row to drag it into order.
        </div>
      </div>
    </>
  );
}
