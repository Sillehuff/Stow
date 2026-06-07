import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { SpaceWithAreas } from "@/types/domain";
import { ChevronDown, Plus, Sparkles } from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

export interface AddItemSheetProps {
  open: boolean;
  spaces: SpaceWithAreas[];
  defaultSpaceId: string | null;
  defaultAreaId: string | null;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    spaceId: string;
    areaId: string;
    areaNameSnapshot: string;
    value: number | null;
    tags: string[];
    notes: string;
  }) => void;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "var(--stow-warm)",
        marginBottom: 6
      }}
    >
      {children}
    </div>
  );
}

function resolveInitialLocation(spaces: SpaceWithAreas[], defaultSpaceId: string | null, defaultAreaId: string | null) {
  const defaultSpace = spaces.find((space) => space.id === defaultSpaceId);
  const fallbackSpace = defaultSpace ?? spaces[0] ?? null;
  const defaultArea = fallbackSpace?.areas.find((area) => area.id === defaultAreaId);

  return {
    spaceId: fallbackSpace?.id ?? "",
    areaId: defaultArea?.id ?? fallbackSpace?.areas[0]?.id ?? ""
  };
}

export function AddItemSheet(props: AddItemSheetProps) {
  const { open, spaces, defaultSpaceId, defaultAreaId, onClose, onCreate } = props;
  const initialLocation = useMemo(() => resolveInitialLocation(spaces, defaultSpaceId, defaultAreaId), [spaces, defaultSpaceId, defaultAreaId]);

  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState(initialLocation.spaceId);
  const [areaId, setAreaId] = useState(initialLocation.areaId);
  const [value, setValue] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const aiFilled = false;

  useEffect(() => {
    if (!open) return;
    setSpaceId(initialLocation.spaceId);
    setAreaId(initialLocation.areaId);
  }, [open, initialLocation.spaceId, initialLocation.areaId]);

  const selectedSpace = useMemo(() => spaces.find((space) => space.id === spaceId) ?? spaces[0] ?? null, [spaces, spaceId]);
  const selectedArea = selectedSpace?.areas.find((area) => area.id === areaId) ?? null;
  const hasAreas = Boolean(selectedSpace?.areas.length);
  const canSubmit = Boolean(name.trim() && selectedSpace && selectedArea);

  function selectSpace(nextId: string) {
    const next = spaces.find((space) => space.id === nextId);
    setSpaceId(nextId);
    setAreaId(next?.areas[0]?.id ?? "");
  }

  function submit() {
    if (!canSubmit || !selectedSpace || !selectedArea) return;
    onCreate({
      name: name.trim(),
      spaceId: selectedSpace.id,
      areaId: selectedArea.id,
      areaNameSnapshot: selectedArea.name,
      value: value.trim() ? Number.parseFloat(value) : null,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      notes
    });
    setName("");
    setValue("");
    setTags("");
    setNotes("");
    setMoreOpen(false);
    setSpaceId(initialLocation.spaceId);
    setAreaId(initialLocation.areaId);
  }

  const tagCount = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean).length;
  const filledHints = [value.trim() ? `$${value.trim()}` : null, tagCount > 0 ? `${tagCount} tag${tagCount === 1 ? "" : "s"}` : null].filter(
    Boolean
  );

  return (
    <Sheet open={open} onClose={onClose} title="Add Item">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <FieldLabel>Photo</FieldLabel>
            {aiFilled ? (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  color: "var(--stow-accent)",
                  background: "var(--stow-accent-soft)",
                  padding: "3px 8px",
                  borderRadius: 99,
                  marginBottom: 6
                }}
              >
                <Sparkles size={10} color="var(--stow-accent)" /> AI filled
              </span>
            ) : null}
          </div>
          <div
            style={{
              minHeight: 96,
              borderRadius: "var(--stow-radius-input)",
              border: "1.5px dashed var(--stow-border)",
              background: "var(--stow-canvas)",
              color: "var(--stow-ink-muted)",
              display: "grid",
              placeItems: "center",
              fontSize: 14,
              fontWeight: 700
            }}
          >
            Add a photo in P2
          </div>
        </div>

        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Wireless Charger" />

        <div>
          <FieldLabel>Space</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            {spaces.map((space) => {
              const selected = spaceId === space.id;
              return (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => selectSpace(space.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 13px",
                    borderRadius: "var(--stow-radius)",
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                    border: `1.5px solid ${selected ? space.color : "var(--stow-border)"}`,
                    background: selected ? `color-mix(in srgb, ${space.color} 12%, var(--stow-surface))` : "var(--stow-canvas)",
                    color: selected ? "var(--stow-ink)" : "var(--stow-ink-muted)"
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: space.color, flexShrink: 0 }} />
                  {space.name}
                </button>
              );
            })}
          </div>

          <FieldLabel>Area in {selectedSpace?.name ?? ""}</FieldLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {selectedSpace?.areas.map((area) => {
              const selected = areaId === area.id;
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => setAreaId(area.id)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--stow-radius)",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                    border: `1.5px solid ${selected ? "var(--stow-accent)" : "var(--stow-border)"}`,
                    background: selected ? "var(--stow-accent)" : "var(--stow-canvas)",
                    color: selected ? "#fff" : "var(--stow-ink-muted)"
                  }}
                >
                  {area.name}
                </button>
              );
            })}
          </div>
          {!hasAreas ? (
            <div style={{ color: "var(--stow-warm)", fontSize: 12, fontWeight: 700, marginTop: 8 }}>Add an area to this space first.</div>
          ) : null}
        </div>

        <div style={{ borderTop: "1px solid var(--stow-border-l)" }}>
          <button
            type="button"
            onClick={() => setMoreOpen((current) => !current)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 0 12px",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--stow-ink-soft)" }}>More details</span>
              {!moreOpen && filledHints.length > 0 ? (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--stow-warm)" }}>{filledHints.join(" \u00b7 ")}</span>
              ) : null}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {!moreOpen && filledHints.length === 0 ? (
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--stow-warm)" }}>Value, tags, notes</span>
              ) : null}
              <ChevronDown
                size={17}
                color="var(--stow-ink-muted)"
                style={{ transform: moreOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
              />
            </span>
          </button>
          {moreOpen ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Value ($)" value={value} onChange={setValue} placeholder="0" type="number" />
              <Field label="Tags (comma separated)" value={tags} onChange={setTags} placeholder="Tech, Travel" />
              <Field label="Notes" value={notes} onChange={setNotes} placeholder="Serial, purchase info..." multiline />
            </div>
          ) : null}
        </div>

        <Button variant="primary" disabled={!canSubmit} onClick={submit}>
          <Plus size={16} color="#fff" /> Add Item
        </Button>
      </div>
    </Sheet>
  );
}
