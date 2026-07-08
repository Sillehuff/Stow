import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { useHoldToReorder } from "@/features/stow/ui/mobile/hooks/useHoldToReorder";
import { useDismissable } from "@/features/stow/ui/mobile/shell/useDismissable";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "@/features/stow/ui/mobile/theme/icons";
import { iconForKey } from "@/features/stow/ui/mobile/theme/icons";
import { ColorPicker } from "@/features/stow/ui/mobile/spaces/ColorPicker";
import { IconPicker } from "@/features/stow/ui/mobile/spaces/IconPicker";
import type { Item, SpaceWithAreas } from "@/types/domain";

interface DraftArea {
  key: string;
  id: string | null;
  name: string;
}

interface AreaDeleteState {
  key: string;
  id: string;
  name: string;
}

interface AreaReassignmentDraft {
  spaceId: string;
  areaId: string;
}

export interface EditSpaceSheetProps {
  space: SpaceWithAreas;
  itemCount: number;
  items: Item[];
  otherSpaces: SpaceWithAreas[];
  onClose: () => void;
  onSaved: (message: string) => void;
  onDeleted: (message: string) => void;
  onError: (message: string) => void;
  actions: {
    updateSpace: (input: { householdId: string; spaceId: string; patch: { name?: string; icon?: string; color?: string } }) => Promise<void>;
    createArea: (input: { householdId: string; spaceId: string; name: string; position?: number }) => Promise<string>;
    updateArea: (input: { householdId: string; spaceId: string; areaId: string; patch: { name?: string } }) => Promise<void>;
    deleteArea: (input: {
      householdId: string;
      spaceId: string;
      areaId: string;
      userId: string;
      reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string };
    }) => Promise<void>;
    reorderAreas: (input: { householdId: string; spaceId: string; orderedIds: string[] }) => Promise<void>;
    deleteSpace: (input: {
      householdId: string;
      spaceId: string;
      userId: string;
      reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string };
    }) => Promise<void>;
  };
  householdId: string;
  userId: string;
}

function draftAreasFor(space: SpaceWithAreas): DraftArea[] {
  return space.areas.map((area, index) => ({ key: `area-${space.id}-${area.id}-${index}`, id: area.id, name: area.name }));
}

function FieldLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "var(--stow-warm)",
        marginBottom: 10
      }}
    >
      {children}
    </div>
  );
}

function areaMoveButtonStyle(disabled: boolean) {
  return {
    width: 26,
    height: 26,
    borderRadius: 8,
    background: "transparent",
    border: "1px solid var(--stow-border-l)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.35 : 1,
    padding: 0,
    flexShrink: 0
  };
}

export function EditSpaceSheet(props: EditSpaceSheetProps) {
  const { space, itemCount, items, otherSpaces, onClose, onSaved, onDeleted, onError, actions, householdId, userId } = props;
  const surfaceRef = useDismissable(true, onClose);
  const newKeySeq = useRef(0);

  const [name, setName] = useState(space.name);
  const [color, setColor] = useState(space.color);
  const [icon, setIcon] = useState(space.icon);
  const [areas, setAreas] = useState<DraftArea[]>(() => draftAreasFor(space));
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [destSpaceId, setDestSpaceId] = useState(otherSpaces[0]?.id ?? "");
  const [destAreaId, setDestAreaId] = useState(otherSpaces[0]?.areas[0]?.id ?? "");
  const [areaDelete, setAreaDelete] = useState<AreaDeleteState | null>(null);
  const [areaDestSpaceId, setAreaDestSpaceId] = useState("");
  const [areaDestAreaId, setAreaDestAreaId] = useState("");
  const [areaReassignments, setAreaReassignments] = useState<Record<string, AreaReassignmentDraft>>({});

  useEffect(() => {
    newKeySeq.current = 0;
    setName(space.name);
    setColor(space.color);
    setIcon(space.icon);
    setAreas(draftAreasFor(space));
    setSaving(false);
    setConfirmingDelete(false);
    setAreaDelete(null);
    setAreaReassignments({});
  }, [space.id, space.name, space.color, space.icon]);

  useEffect(() => {
    const firstSpace = otherSpaces[0];
    setDestSpaceId((current) => (current && otherSpaces.some((candidate) => candidate.id === current) ? current : firstSpace?.id ?? ""));
  }, [otherSpaces]);

  const destSpace = useMemo(() => otherSpaces.find((candidate) => candidate.id === destSpaceId) ?? null, [destSpaceId, otherSpaces]);

  useEffect(() => {
    setDestAreaId((current) => {
      if (destSpace?.areas.some((area) => area.id === current)) return current;
      return destSpace?.areas[0]?.id ?? "";
    });
  }, [destSpace]);

  const areaKeys = areas.map((area) => area.key);
  function applyAreaOrder(orderedKeys: string[]) {
    setAreas((previous) => orderedKeys.map((key) => previous.find((area) => area.key === key)).filter((area): area is DraftArea => Boolean(area)));
  }

  const { order, draggingId, bind, containerRef, suppressClick } = useHoldToReorder<DraftArea>({
    ids: areaKeys,
    onReorder: applyAreaOrder,
    holdMs: 0
  });

  const orderedAreas = order.map((key) => areas.find((area) => area.key === key)).filter((area): area is DraftArea => Boolean(area));
  const HeadIcon = iconForKey(icon);
  const canSave = Boolean(name.trim()) && !saving;
  const canDeleteWithReassign = itemCount === 0 || (Boolean(destSpace) && Boolean(destAreaId) && otherSpaces.length > 0);

  function itemCountForArea(areaId: string) {
    return items.filter((item) => item.spaceId === space.id && item.areaId === areaId).length;
  }

  function activeExistingAreas(excludedIds = new Set<string>()) {
    return orderedAreas
      .filter((area) => Boolean(area.id) && !excludedIds.has(area.id as string))
      .map((area) => ({ id: area.id as string, name: area.name.trim() || "Area" }));
  }

  function areaDestinationSpaces(excludedAreaId: string) {
    const excludedIds = new Set([...Object.keys(areaReassignments), excludedAreaId]);
    const currentAreas = orderedAreas
      .filter((area) => Boolean(area.id) && !excludedIds.has(area.id as string))
      .map((area) => ({ id: area.id as string, name: area.name.trim() || "Area" }));

    return [
      ...(currentAreas.length > 0 ? [{ id: space.id, name: `${space.name} areas`, areas: currentAreas }] : []),
      ...otherSpaces.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        areas: candidate.areas.map((area) => ({ id: area.id, name: area.name }))
      }))
    ].filter((candidate) => candidate.areas.length > 0);
  }

  function areaDestinationFor(spaceId: string, areaId: string, spaces: ReturnType<typeof areaDestinationSpaces>) {
    const destinationSpace = spaces.find((candidate) => candidate.id === spaceId);
    const destinationArea = destinationSpace?.areas.find((area) => area.id === areaId);
    if (!destinationSpace || !destinationArea) return null;
    return { spaceId: destinationSpace.id, areaId: destinationArea.id, areaNameSnapshot: destinationArea.name };
  }

  function finalAreaDestinationSpaces() {
    const currentAreas = activeExistingAreas(new Set(Object.keys(areaReassignments)));
    return [
      ...(currentAreas.length > 0 ? [{ id: space.id, name: `${space.name} areas`, areas: currentAreas }] : []),
      ...otherSpaces.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        areas: candidate.areas.map((area) => ({ id: area.id, name: area.name }))
      }))
    ].filter((candidate) => candidate.areas.length > 0);
  }

  function firstAreaDestination(excludedAreaId: string) {
    const destinationSpace = areaDestinationSpaces(excludedAreaId)[0];
    const destinationArea = destinationSpace?.areas[0];
    if (!destinationSpace || !destinationArea) return null;
    return { spaceId: destinationSpace.id, areaId: destinationArea.id };
  }

  function addArea() {
    const key = `new-area-${space.id}-${newKeySeq.current++}`;
    setAreas((previous) => previous.concat([{ key, id: null, name: "New Area" }]));
  }

  function renameArea(key: string, value: string) {
    setAreas((previous) => previous.map((area) => (area.key === key ? { ...area, name: value } : area)));
  }

  function removeAreaFromDraft(key: string) {
    setAreas((previous) => previous.filter((area) => area.key !== key));
  }

  function moveArea(key: string, direction: -1 | 1) {
    setAreas((previous) => {
      const from = previous.findIndex((area) => area.key === key);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= previous.length) return previous;
      const next = previous.slice();
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function requestAreaDelete(area: DraftArea) {
    if (suppressClick()) return;
    if (!area.id) {
      removeAreaFromDraft(area.key);
      return;
    }
    const firstDestination = firstAreaDestination(area.id);
    setAreaDelete({ key: area.key, id: area.id, name: area.name.trim() || "Area" });
    setAreaDestSpaceId(firstDestination?.spaceId ?? "");
    setAreaDestAreaId(firstDestination?.areaId ?? "");
  }

  function confirmAreaDelete() {
    if (!areaDelete) return;
    const removedId = areaDelete.id;
    const affectedCount = itemCountForArea(removedId);
    let ownReassign: AreaReassignmentDraft | null = null;
    if (affectedCount > 0) {
      const reassignTo = areaDestinationFor(areaDestSpaceId, areaDestAreaId, areaDestinationSpaces(removedId));
      if (!reassignTo) return;
      ownReassign = { spaceId: reassignTo.spaceId, areaId: reassignTo.areaId };
    }
    // A fallback destination that excludes the area we're removing (and already-reassigned ones).
    const fallback = firstAreaDestination(removedId);
    setAreaReassignments((previous) => {
      const next = { ...previous };
      if (ownReassign) next[removedId] = ownReassign;
      else delete next[removedId];
      // Re-point any OTHER source whose chosen destination was this just-removed area; that
      // target won't exist at save time, so resolve it to a still-valid area (or drop it if
      // none remain). This prevents a mid-save throw that left a partially-applied edit.
      for (const [sourceId, dest] of Object.entries(next)) {
        if (sourceId === removedId) continue;
        if (dest.spaceId === space.id && dest.areaId === removedId) {
          if (fallback) next[sourceId] = { spaceId: fallback.spaceId, areaId: fallback.areaId };
          else delete next[sourceId];
        }
      }
      return next;
    });
    removeAreaFromDraft(areaDelete.key);
    setAreaDelete(null);
  }

  async function save() {
    if (!canSave) return;
    setSaving(true);

    try {
      const trimmedName = name.trim();
      if (trimmedName !== space.name || color !== space.color || icon !== space.icon) {
        await actions.updateSpace({ householdId, spaceId: space.id, patch: { name: trimmedName, color, icon } });
      }

      const draftIds = new Set(areas.filter((area) => area.id).map((area) => area.id));
      const finalDestinationSpaces = finalAreaDestinationSpaces();

      // Resolve + validate every deletion up front. If an area with items has no resolvable
      // destination (e.g. its chosen destination was also deleted this session), abort BEFORE
      // any write so we never delete some areas and then throw mid-loop (a partial edit).
      const deletions: Array<{ areaId: string; reassignTo?: { spaceId: string; areaId: string; areaNameSnapshot: string } }> = [];
      for (const original of space.areas) {
        if (draftIds.has(original.id)) continue;
        const reassignment = areaReassignments[original.id];
        const reassignTo = reassignment
          ? (areaDestinationFor(reassignment.spaceId, reassignment.areaId, finalDestinationSpaces) ?? undefined)
          : undefined;
        if (itemCountForArea(original.id) > 0 && !reassignTo) {
          onError("Choose a destination for items in a deleted area before saving.");
          setSaving(false);
          return;
        }
        deletions.push({ areaId: original.id, reassignTo });
      }

      for (const deletion of deletions) {
        await actions.deleteArea({
          householdId,
          spaceId: space.id,
          areaId: deletion.areaId,
          userId,
          reassignTo: deletion.reassignTo
        });
      }

      const resolvedIds: string[] = [];
      for (const draft of orderedAreas) {
        const trimmedAreaName = draft.name.trim() || "Area";
        if (!draft.id) {
          const newId = await actions.createArea({
            householdId,
            spaceId: space.id,
            name: trimmedAreaName,
            position: resolvedIds.length
          });
          resolvedIds.push(newId);
        } else {
          const original = space.areas.find((area) => area.id === draft.id);
          if (original && original.name !== trimmedAreaName) {
            await actions.updateArea({ householdId, spaceId: space.id, areaId: draft.id, patch: { name: trimmedAreaName } });
          }
          resolvedIds.push(draft.id);
        }
      }

      if (resolvedIds.length > 0) {
        await actions.reorderAreas({ householdId, spaceId: space.id, orderedIds: resolvedIds });
      }

      onSaved("Space updated");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to update space");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteSpace() {
    if (saving || !canDeleteWithReassign) return;
    setSaving(true);

    try {
      const reassignTo =
        itemCount > 0 && destSpace && destAreaId
          ? {
              spaceId: destSpace.id,
              areaId: destAreaId,
              areaNameSnapshot: destSpace.areas.find((area) => area.id === destAreaId)?.name ?? ""
            }
          : undefined;

      await actions.deleteSpace({ householdId, spaceId: space.id, userId, reassignTo });
      onDeleted("Space deleted");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to delete space");
    } finally {
      setSaving(false);
    }
  }

  function bindGrip(key: string) {
    const gripBind = bind(key);

    return {
      onPointerDown: (event: PointerEvent) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        gripBind.onPointerDown(event);
      },
      onPointerMove: gripBind.onPointerMove,
      onPointerUp: (event: PointerEvent) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        gripBind.onPointerUp(event);
      },
      onPointerCancel: (event: PointerEvent) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        gripBind.onPointerCancel(event);
      }
    };
  }

  const areaDeleteItemCount = areaDelete ? itemCountForArea(areaDelete.id) : 0;
  const areaDeleteDestinationSpaces = areaDelete ? areaDestinationSpaces(areaDelete.id) : [];
  const selectedAreaDestSpace = areaDeleteDestinationSpaces.find((candidate) => candidate.id === areaDestSpaceId) ?? null;
  const canConfirmAreaDelete =
    Boolean(areaDelete) &&
    !saving &&
    (areaDeleteItemCount === 0 || Boolean(areaDestinationFor(areaDestSpaceId, areaDestAreaId, areaDeleteDestinationSpaces)));

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 78,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end"
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(2px)"
        }}
      />
      <div
        ref={surfaceRef}
        role="dialog"
        aria-modal="true"
        aria-label="Edit Space"
        tabIndex={-1}
        style={{
          position: "relative",
          background: "var(--stow-surface)",
          borderRadius: "28px 28px 0 0",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.18)",
          maxHeight: "92%",
          display: "flex",
          flexDirection: "column",
          animation: "stowUp 0.3s ease-out"
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 2 }}>
          <div style={{ width: 36, height: 5, borderRadius: 99, background: "var(--stow-border)" }} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 22px 12px",
            borderBottom: "1px solid var(--stow-border-l)"
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--stow-warm)",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: 0
            }}
          >
            Cancel
          </button>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--stow-ink)", margin: 0 }}>Edit Space</h2>
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            style={{
              background: "none",
              border: "none",
              fontSize: 15,
              fontWeight: 800,
              color: canSave ? "var(--stow-accent-text)" : "var(--stow-border)",
              cursor: canSave ? "pointer" : "default",
              fontFamily: "inherit",
              padding: 0
            }}
          >
            {saving ? "Saving" : "Save"}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px calc(28px + env(safe-area-inset-bottom, 0px))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 22 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: `color-mix(in srgb, ${color} 10%, transparent)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}
            >
              <HeadIcon size={26} strokeWidth={1.9} color={color} />
            </div>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Space name"
              style={{
                flex: 1,
                minWidth: 0,
                boxSizing: "border-box",
                border: "1.5px solid var(--stow-border)",
                borderRadius: "var(--stow-radius-input)",
                padding: "12px 14px",
                fontSize: 16,
                fontWeight: 700,
                color: "var(--stow-ink)",
                outline: "none",
                background: "var(--stow-canvas)",
                fontFamily: "inherit"
              }}
            />
          </div>

          <FieldLabel>Color</FieldLabel>
          <div style={{ marginBottom: 22 }}>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <FieldLabel>Icon</FieldLabel>
          <div style={{ marginBottom: 24 }}>
            <IconPicker value={icon} color={color} onChange={setIcon} />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: 1.2,
                color: "var(--stow-warm)"
              }}
            >
              Areas {"\u00b7"} drag to reorder
            </span>
            <button
              type="button"
              onClick={addArea}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12.5,
                fontWeight: 800,
                color: "var(--stow-accent-text)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              <Plus size={13} strokeWidth={2.5} color="var(--stow-accent-text)" />
              Add
            </button>
          </div>
          <div
            ref={containerRef}
            style={{
              background: "var(--stow-canvas)",
              borderRadius: 14,
              border: "1px solid var(--stow-border-l)",
              overflow: "hidden",
              marginBottom: 22
            }}
          >
            {areas.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", fontSize: 13, fontWeight: 600, color: "var(--stow-warm)" }}>
                No areas yet {"\u2014"} tap Add.
              </div>
            ) : (
              orderedAreas.map((area, index) => {
                const dragging = draggingId === area.key;
                const gripProps = bindGrip(area.key);
                const areaName = area.name.trim() || "Area";
                const first = index === 0;
                const last = index === orderedAreas.length - 1;

                return (
                  <div
                    key={area.key}
                    data-reorder-row
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 14px",
                      borderBottom: "1px solid var(--stow-border-l)",
                      background: dragging ? "var(--stow-surface)" : "var(--stow-canvas)",
                      boxShadow: dragging ? "0 8px 20px rgba(0,0,0,0.08)" : "none"
                    }}
                  >
                    <span
                      {...gripProps}
                      style={{
                        cursor: "grab",
                        display: "flex",
                        touchAction: "none",
                        padding: "2px 0",
                        color: "var(--stow-border)"
                      }}
                    >
                      <GripVertical size={16} color="var(--stow-border)" />
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <button
                        type="button"
                        aria-label={`Move area ${areaName} up`}
                        disabled={first}
                        onClick={() => moveArea(area.key, -1)}
                        style={areaMoveButtonStyle(first)}
                      >
                        <ChevronUp size={14} color="var(--stow-warm)" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move area ${areaName} down`}
                        disabled={last}
                        onClick={() => moveArea(area.key, 1)}
                        style={areaMoveButtonStyle(last)}
                      >
                        <ChevronDown size={14} color="var(--stow-warm)" />
                      </button>
                    </div>
                    <input
                      value={area.name}
                      onChange={(event) => renameArea(area.key, event.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        border: "none",
                        background: "transparent",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--stow-ink)",
                        outline: "none",
                        fontFamily: "inherit"
                      }}
                    />
                    <button
                      type="button"
                      aria-label={`Delete area ${areaName}`}
                      onClick={() => requestAreaDelete(area)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: "var(--stow-danger-soft)",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        flexShrink: 0
                      }}
                    >
                      <Trash2 size={13} color="var(--stow-danger-text)" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {areaDelete ? (
            <div
              style={{
                marginTop: -10,
                marginBottom: 22,
                padding: 14,
                borderRadius: "var(--stow-radius-card)",
                background: "var(--stow-canvas)",
                border: "1px solid var(--stow-border-l)"
              }}
            >
              {areaDeleteItemCount > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stow-ink)", marginBottom: 10 }}>
                    {areaDelete.name} has {areaDeleteItemCount} item{areaDeleteItemCount !== 1 ? "s" : ""} {"\u2014"} choose where they go:
                  </div>
                  <select
                    aria-label={`Destination space for items in ${areaDelete.name}`}
                    value={areaDestSpaceId}
                    onChange={(event) => {
                      const nextSpaceId = event.target.value;
                      const nextSpace = areaDeleteDestinationSpaces.find((candidate) => candidate.id === nextSpaceId);
                      setAreaDestSpaceId(nextSpaceId);
                      setAreaDestAreaId(nextSpace?.areas[0]?.id ?? "");
                    }}
                    style={{
                      width: "100%",
                      borderRadius: "var(--stow-radius-input)",
                      border: "1.5px solid var(--stow-border)",
                      background: "var(--stow-surface)",
                      color: "var(--stow-ink)",
                      padding: "10px 12px",
                      fontSize: 16,
                      fontFamily: "inherit",
                      fontWeight: 700,
                      marginBottom: 8
                    }}
                  >
                    {areaDeleteDestinationSpaces.length === 0 ? <option value="">No destination spaces</option> : null}
                    {areaDeleteDestinationSpaces.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Destination area for items in ${areaDelete.name}`}
                    value={areaDestAreaId}
                    onChange={(event) => setAreaDestAreaId(event.target.value)}
                    disabled={!selectedAreaDestSpace}
                    style={{
                      width: "100%",
                      borderRadius: "var(--stow-radius-input)",
                      border: "1.5px solid var(--stow-border)",
                      background: "var(--stow-surface)",
                      color: "var(--stow-ink)",
                      padding: "10px 12px",
                      fontSize: 16,
                      fontFamily: "inherit",
                      fontWeight: 700,
                      marginBottom: 10
                    }}
                  >
                    {!selectedAreaDestSpace ? <option value="">No destination areas</option> : null}
                    {selectedAreaDestSpace?.areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stow-ink)", marginBottom: 10 }}>
                  Delete {areaDelete.name}? This can&apos;t be undone after you save.
                </div>
              )}
              <button
                type="button"
                onClick={confirmAreaDelete}
                disabled={!canConfirmAreaDelete}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "var(--stow-radius-input)",
                  background: canConfirmAreaDelete ? "var(--stow-danger-text)" : "var(--stow-border-l)",
                  color: "#fff",
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: canConfirmAreaDelete ? "pointer" : "default",
                  fontFamily: "inherit",
                  marginBottom: 8
                }}
              >
                {areaDeleteItemCount > 0 ? "Delete & move items" : "Delete Area"}
              </button>
              <button
                type="button"
                onClick={() => setAreaDelete(null)}
                style={{
                  width: "100%",
                  border: "1px solid var(--stow-border)",
                  borderRadius: "var(--stow-radius-input)",
                  background: "var(--stow-surface)",
                  color: "var(--stow-ink-muted)",
                  padding: "11px 0",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                Cancel
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "13px 0",
              borderRadius: "var(--stow-radius-input)",
              border: "1.5px solid color-mix(in srgb, var(--stow-danger-text) 28%, transparent)",
              background: "var(--stow-danger-soft)",
              color: "var(--stow-danger-text)",
              fontSize: 14.5,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            <Trash2 size={15} color="var(--stow-danger-text)" />
            Delete Space
          </button>

          {confirmingDelete ? (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: "var(--stow-radius-card)",
                background: "var(--stow-canvas)",
                border: "1px solid var(--stow-border-l)"
              }}
            >
              {itemCount > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stow-ink)", marginBottom: 10 }}>
                    This space has {itemCount} items {"\u2014"} choose where they go:
                  </div>
                  <select
                    value={destSpaceId}
                    aria-label={`Destination space for items in ${space.name}`}
                    onChange={(event) => setDestSpaceId(event.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: "var(--stow-radius-input)",
                      border: "1.5px solid var(--stow-border)",
                      background: "var(--stow-surface)",
                      color: "var(--stow-ink)",
                      padding: "10px 12px",
                      fontSize: 16,
                      fontFamily: "inherit",
                      fontWeight: 700,
                      marginBottom: 8
                    }}
                  >
                    {otherSpaces.length === 0 ? <option value="">No destination spaces</option> : null}
                    {otherSpaces.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={destAreaId}
                    aria-label={`Destination area for items in ${space.name}`}
                    onChange={(event) => setDestAreaId(event.target.value)}
                    disabled={!destSpace}
                    style={{
                      width: "100%",
                      borderRadius: "var(--stow-radius-input)",
                      border: "1.5px solid var(--stow-border)",
                      background: "var(--stow-surface)",
                      color: "var(--stow-ink)",
                      padding: "10px 12px",
                      fontSize: 16,
                      fontFamily: "inherit",
                      fontWeight: 700,
                      marginBottom: 10
                    }}
                  >
                    {!destSpace || destSpace.areas.length === 0 ? <option value="">No destination areas</option> : null}
                    {destSpace?.areas.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--stow-ink)", marginBottom: 10 }}>
                  Delete this space? This can&apos;t be undone.
                </div>
              )}
              <button
                type="button"
                onClick={confirmDeleteSpace}
                disabled={saving || !canDeleteWithReassign}
                style={{
                  width: "100%",
                  border: "none",
                  borderRadius: "var(--stow-radius-input)",
                  background: saving || !canDeleteWithReassign ? "var(--stow-border-l)" : "var(--stow-danger-text)",
                  color: "#fff",
                  padding: "12px 0",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: saving || !canDeleteWithReassign ? "default" : "pointer",
                  fontFamily: "inherit",
                  marginBottom: 8
                }}
              >
                {itemCount > 0 ? "Delete & move items" : "Delete Space"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                style={{
                  width: "100%",
                  border: "1px solid var(--stow-border)",
                  borderRadius: "var(--stow-radius-input)",
                  background: "var(--stow-surface)",
                  color: "var(--stow-ink-muted)",
                  padding: "11px 0",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
