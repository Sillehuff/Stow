import type { ReactNode } from "react";
import type { Item, SpaceWithAreas } from "@/types/domain";
import { Box, Camera, ChevronLeft, Plus, QrCode } from "@/features/stow/ui/mobile/theme/icons";
import { AreaCard } from "@/features/stow/ui/mobile/components/AreaCard";
import { ItemRow } from "@/features/stow/ui/mobile/components/ItemRow";

export interface RoomScreenProps {
  space: SpaceWithAreas;
  items: Item[];
  selectedAreaId: string | null;
  onBack: () => void;
  onClearArea: () => void;
  onOpenArea: (areaId: string) => void;
  onOpenItem: (itemId: string) => void;
  onAddArea: () => void;
  onAddItem: (areaId: string | null) => void;
  onOpenSpaceQr: () => void;
  onComingSoon: (label: string) => void;
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

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 34,
        height: 34,
        padding: 0,
        background: "transparent",
        border: "none",
        borderRadius: 99,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0
      }}
    >
      {children}
    </button>
  );
}

export function RoomScreen(props: RoomScreenProps) {
  const {
    space,
    items,
    selectedAreaId,
    onBack,
    onClearArea,
    onOpenArea,
    onOpenItem,
    onAddArea,
    onAddItem,
    onOpenSpaceQr,
    onComingSoon
  } = props;
  const selectedArea = selectedAreaId ? space.areas.find((area) => area.id === selectedAreaId) ?? null : null;
  const isInArea = selectedArea != null;
  const spaceItems = items.filter((item) => item.spaceId === space.id);
  const areaItems = (areaId: string) => spaceItems.filter((item) => item.areaId === areaId);
  const filtered = isInArea ? spaceItems.filter((item) => item.areaId === selectedArea.id) : spaceItems;
  const spaceColor = space.color;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--stow-canvas)" }}>
      <div
        style={{
          padding: "calc(env(safe-area-inset-top) + 24px) 14px 12px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
          alignItems: "center",
          gap: 8,
          background: "color-mix(in srgb, var(--stow-surface) 90%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid var(--stow-border-l)",
          position: "sticky",
          top: 0,
          zIndex: 20
        }}
      >
        <button
          type="button"
          onClick={isInArea ? onClearArea : onBack}
          style={{
            minWidth: 0,
            justifySelf: "start",
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--stow-accent)",
            fontWeight: 700,
            fontSize: 15,
            padding: "8px 4px",
            fontFamily: "inherit"
          }}
        >
          <ChevronLeft size={20} strokeWidth={2.5} color="var(--stow-accent)" />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{isInArea ? space.name : "Spaces"}</span>
        </button>

        <div
          style={{
            maxWidth: "42vw",
            fontSize: 17,
            fontWeight: 800,
            color: "var(--stow-ink)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center"
          }}
        >
          {isInArea ? selectedArea.name : space.name}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
          <IconButton label="Camera" onClick={() => onComingSoon("Camera arrives in P2")}>
            <Camera size={18} color="var(--stow-ink-muted)" />
          </IconButton>
          <IconButton label="Space QR" onClick={onOpenSpaceQr}>
            <QrCode size={18} color="var(--stow-ink-muted)" />
          </IconButton>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 150px" }}>
        {!isInArea ? (
          <div>
            <Label>
              {space.areas.length} Area{space.areas.length !== 1 ? "s" : ""}
            </Label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {space.areas.map((area) => (
                <AreaCard
                  key={area.id}
                  name={area.name}
                  count={areaItems(area.id).length}
                  color={spaceColor}
                  onClick={() => onOpenArea(area.id)}
                />
              ))}
              <button
                type="button"
                onClick={onAddArea}
                style={{
                  borderRadius: "var(--stow-radius-input)",
                  padding: 16,
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  minHeight: 104,
                  border: "2px dashed var(--stow-border)",
                  background: "transparent",
                  color: "var(--stow-accent)",
                  fontFamily: "inherit"
                }}
              >
                <Plus size={20} strokeWidth={2.5} color="var(--stow-accent)" />
                <span style={{ fontSize: 13, fontWeight: 700 }}>Add Area</span>
              </button>
            </div>

            {spaceItems.length > 0 ? (
              <div style={{ marginTop: 24 }}>
                <Label>
                  All Items ({spaceItems.length})
                </Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {spaceItems.map((item) => (
                    <ItemRow key={item.id} item={item} spaceName={space.name} onClick={() => onOpenItem(item.id)} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Box size={36} color="var(--stow-border)" style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--stow-ink)", marginBottom: 4 }}>
                  Nothing in {selectedArea.name}
                </div>
                <div style={{ fontSize: 13, color: "var(--stow-warm)", marginBottom: 20 }}>Add your first item to this area</div>
                <button
                  type="button"
                  onClick={() => onAddItem(selectedArea.id)}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "var(--stow-radius-button)",
                    fontWeight: 700,
                    fontSize: 14,
                    border: "none",
                    background: "var(--stow-accent)",
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  Add Item
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {filtered.map((item) => (
                  <ItemRow key={item.id} item={item} spaceName={space.name} onClick={() => onOpenItem(item.id)} />
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => onAddItem(selectedArea.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "20px 0",
                marginTop: 12,
                borderRadius: "var(--stow-radius-input)",
                border: "2px dashed var(--stow-border)",
                background: "transparent",
                color: "var(--stow-warm)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              <Plus size={16} strokeWidth={2.5} color="var(--stow-warm)" />
              Add Item to {selectedArea.name}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
