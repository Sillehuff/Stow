import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { HouseholdMember, ImageRef, Item, ItemStatus, SpaceWithAreas } from "@/types/domain";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Folder,
  Inbox,
  MapPin,
  Package,
  Pencil,
  Plus,
  Save,
  Star,
  Tag,
  Trash2,
  X
} from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { PhotoField } from "@/features/stow/ui/mobile/components/PhotoField";
import { LendingSheet } from "@/features/stow/ui/mobile/screens/LendingSheet";
import { STATUS_META, STATUS_ORDER } from "@/features/stow/ui/mobile/screens/StatusVocab";
import { formatRelativeTime } from "@/features/stow/ui/mobile/screens/activitySelectors";
import { storagePaths } from "@/lib/firebase/paths";
import { bestEffortDeleteImage } from "@/lib/firebase/storage";

type Mode = "view" | "edit" | "tag" | "move";

export interface ItemDetailProps {
  householdId: string;
  item: Item;
  space: SpaceWithAreas | null;
  spaces: SpaceWithAreas[];
  allTags: string[];
  members: HouseholdMember[];
  onBack: () => void;
  /** Resolves true when the server committed, false when queued offline. */
  onSaveEdit: (patch: { name: string; value: number | null; notes: string; image?: ImageRef | null }) => Promise<boolean>;
  onToggleTag: (tag: string) => void;
  onMove: (dest: { spaceId: string; areaId: string; areaNameSnapshot: string }) => Promise<void> | void;
  onChangeStatus: (next: ItemStatus) => Promise<void> | void;
  onConfirmLoan: (loan: { to: string; toUid?: string; dueMs?: number; note?: string }) => Promise<void> | void;
  onDelete: () => void;
  onFlash: (msg: string) => void;
}

function FieldLabel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        color: "var(--stow-warm)",
        marginBottom: 6,
        ...style
      }}
    >
      {children}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  hasImage,
  children
}: {
  label: string;
  onClick: () => void;
  hasImage: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 99,
        background: hasImage ? "rgba(255,255,255,0.22)" : "var(--stow-canvas)",
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        boxShadow: hasImage ? "none" : "var(--stow-shadow-soft)"
      }}
    >
      {children}
    </button>
  );
}

const chipBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "7px 12px",
  borderRadius: 12,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit"
};

function parseValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateInputValue(value: unknown): string | undefined {
  if (!value || typeof (value as { toMillis?: unknown }).toMillis !== "function") return undefined;
  const ms = (value as { toMillis: () => number }).toMillis();
  if (!Number.isFinite(ms)) return undefined;
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function ItemDetail(props: ItemDetailProps) {
  const {
    householdId,
    item,
    space,
    spaces,
    allTags,
    members,
    onBack,
    onSaveEdit,
    onToggleTag,
    onMove,
    onChangeStatus,
    onConfirmLoan,
    onDelete,
    onFlash
  } = props;
  const [mode, setMode] = useState<Mode>("view");
  const [lendingOpen, setLendingOpen] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [moveSaving, setMoveSaving] = useState(false);

  const [draftName, setDraftName] = useState(item.name);
  const [editOriginalImage, setEditOriginalImage] = useState<ImageRef | null>(item.image ?? null);
  const [draftImage, setDraftImage] = useState<ImageRef | null>(item.image ?? null);
  const [draftValue, setDraftValue] = useState(item.value != null ? String(item.value) : "");
  const [draftNotes, setDraftNotes] = useState(item.notes ?? "");
  const [photoDirty, setPhotoDirty] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [newTag, setNewTag] = useState("");
  const availableTags = useMemo(() => allTags.filter((tag) => !(item.tags || []).includes(tag)), [allTags, item.tags]);

  const [moveSpaceId, setMoveSpaceId] = useState(space?.id ?? spaces[0]?.id ?? "");
  const moveSpace = useMemo(() => spaces.find((candidate) => candidate.id === moveSpaceId) ?? null, [spaces, moveSpaceId]);
  const [moveAreaId, setMoveAreaId] = useState(space?.areas.find((area) => area.id === item.areaId)?.id ?? space?.areas[0]?.id ?? "");

  const spaceName = space?.name ?? "";
  const locationArea = item.areaNameSnapshot;
  const hasImage = Boolean(item.image?.downloadUrl);
  const imageUrl = item.image?.downloadUrl;
  const currentStatus = item.status ?? "home";
  const loanSince = item.loan?.since ? formatRelativeTime(item.loan.since) : "";
  const loanDue = toDateInputValue(item.loan?.due);
  const loanInitial = {
    ...(item.loan?.to ? { to: item.loan.to } : {}),
    ...(loanDue ? { due: loanDue } : {}),
    ...(item.loan?.note ? { note: item.loan.note } : {})
  };
  const originalEditPath = editOriginalImage?.storagePath;
  const draftPhotoFieldValue =
    draftImage && originalEditPath && draftImage.storagePath === originalEditPath
      ? { ...draftImage, storagePath: undefined }
      : draftImage;

  useEffect(() => {
    if (mode !== "edit" || photoDirty || savingEdit) return;
    const latestImage = item.image ?? null;
    setEditOriginalImage(latestImage);
    setDraftImage(latestImage);
  }, [item.image, mode, photoDirty, savingEdit]);

  function startEdit() {
    const startingImage = item.image ?? null;
    setDraftName(item.name);
    setEditOriginalImage(startingImage);
    setDraftImage(startingImage);
    setDraftValue(item.value != null ? String(item.value) : "");
    setDraftNotes(item.notes ?? "");
    setPhotoDirty(false);
    setPhotoUploading(false);
    setSavingEdit(false);
    setMode("edit");
  }

  function changeDraftImage(next: ImageRef | null) {
    setPhotoDirty(true);
    setDraftImage(next);
  }

  function cleanupUnsavedDraftImage() {
    const draftPath = draftImage?.storagePath;
    if (draftPath && draftPath !== originalEditPath) void bestEffortDeleteImage(draftImage);
  }

  // Leaving mid-edit via Back — or being unmounted by a remote deletion — must clean
  // up a freshly uploaded replacement photo just like Cancel does, or the upload is
  // orphaned in Storage. State is mirrored into a ref so the unmount closure sees
  // current values.
  const unsavedDraftRef = useRef<{ image: ImageRef | null; originalPath?: string; armed: boolean }>({
    image: null,
    armed: false
  });
  unsavedDraftRef.current = {
    image: draftImage,
    originalPath: originalEditPath,
    armed: mode === "edit" && photoDirty && !savingEdit
  };

  useEffect(
    () => () => {
      const { image, originalPath, armed } = unsavedDraftRef.current;
      if (armed && image?.storagePath && image.storagePath !== originalPath) void bestEffortDeleteImage(image);
    },
    []
  );

  function leaveViaBack() {
    if (mode === "edit") {
      cleanupUnsavedDraftImage();
      unsavedDraftRef.current.armed = false;
    }
    onBack();
  }

  function cancelEdit() {
    cleanupUnsavedDraftImage();
    setPhotoDirty(false);
    setPhotoUploading(false);
    setSavingEdit(false);
    setMode("view");
  }

  async function saveEdit() {
    if (!draftName.trim() || savingEdit || photoUploading) return;
    const imageToSave = draftImage;
    const previousImage = item.image ?? null;
    const previousPath = previousImage?.storagePath;
    const nextPath = imageToSave?.storagePath;
    setSavingEdit(true);
    try {
      const committed = await onSaveEdit({
        name: draftName.trim(),
        value: parseValue(draftValue),
        notes: draftNotes,
        ...(photoDirty ? { image: imageToSave ?? null } : {})
      });
      if (photoDirty) {
        // Destroy the replaced photo only after server commit: a queued offline
        // write can still be rejected and roll the doc back to referencing it.
        // Skipping cleanup on a queued write risks an orphaned object instead —
        // the cheaper failure.
        if (committed && previousPath && previousPath !== nextPath) void bestEffortDeleteImage(previousImage);
        setEditOriginalImage(imageToSave ?? null);
        setDraftImage(imageToSave ?? null);
        setPhotoDirty(false);
      }
      setMode("view");
      onFlash("Item updated");
    } catch {
      onFlash("Couldn't update item");
    } finally {
      setSavingEdit(false);
    }
  }

  function openMove() {
    const nextSpace = space ?? spaces[0] ?? null;
    setMoveSpaceId(nextSpace?.id ?? "");
    setMoveAreaId(nextSpace?.areas.find((area) => area.id === item.areaId)?.id ?? nextSpace?.areas[0]?.id ?? "");
    setMode("move");
  }

  function selectMoveSpace(nextSpace: SpaceWithAreas) {
    setMoveSpaceId(nextSpace.id);
    setMoveAreaId(nextSpace.areas[0]?.id ?? "");
  }

  async function commitMove() {
    if (!moveSpace || !moveAreaId || moveSaving) return;
    setMoveSaving(true);
    try {
      await onMove({
        spaceId: moveSpace.id,
        areaId: moveAreaId,
        areaNameSnapshot: moveSpace.areas.find((area) => area.id === moveAreaId)?.name ?? ""
      });
      setMode("view");
      onFlash("Item moved");
    } catch {
      onFlash("Couldn't move item");
    } finally {
      setMoveSaving(false);
    }
  }

  function createTag() {
    const tag = newTag.trim();
    if (!tag) return;
    onToggleTag(tag);
    setNewTag("");
  }

  async function selectStatus(next: ItemStatus) {
    if (next === "lent") {
      setLendingOpen(true);
      return;
    }
    if (next === currentStatus || statusSaving) return;
    setStatusSaving(true);
    try {
      await onChangeStatus(next);
      onFlash(`Marked ${STATUS_META[next].label.toLowerCase()}`);
    } catch {
      onFlash("Couldn't update status");
    } finally {
      setStatusSaving(false);
    }
  }

  async function confirmLoan(loan: { to: string; toUid?: string; dueMs?: number; note?: string }) {
    setStatusSaving(true);
    try {
      await onConfirmLoan(loan);
      setLendingOpen(false);
      onFlash(`Lent to ${loan.to}`);
    } catch (error) {
      onFlash("Couldn't save loan");
      throw error;
    } finally {
      setStatusSaving(false);
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 60,
        background: "var(--stow-surface)",
        display: "flex",
        flexDirection: "column",
        animation: "stowUp 0.32s ease-out"
      }}
    >
      <div style={{ position: "relative", height: hasImage ? "38%" : "18%", background: "var(--stow-canvas)", flexShrink: 0 }}>
        {hasImage && imageUrl ? (
          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {item.kind === "folder" ? (
              <Folder size={48} color="var(--stow-border)" strokeWidth={1} />
            ) : (
              <Inbox size={48} color="var(--stow-border)" strokeWidth={1} />
            )}
          </div>
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            padding: "calc(env(safe-area-inset-top) + 8px) 16px 0",
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "space-between",
            zIndex: 10,
            background: hasImage ? "linear-gradient(to bottom, rgba(0,0,0,0.45), transparent)" : "transparent"
          }}
        >
          <IconButton label="Back" onClick={leaveViaBack} hasImage={hasImage}>
            <ChevronLeft size={18} strokeWidth={2.5} color={hasImage ? "#fff" : "var(--stow-ink)"} />
          </IconButton>
          {mode === "view" ? (
            <div style={{ display: "flex", gap: 8 }}>
              <IconButton label="Edit item" onClick={startEdit} hasImage={hasImage}>
                <Pencil size={16} color={hasImage ? "#fff" : "var(--stow-accent)"} />
              </IconButton>
              <IconButton label="Delete item" onClick={onDelete} hasImage={hasImage}>
                <Trash2 size={16} color={hasImage ? "#fff" : "var(--stow-danger)"} />
              </IconButton>
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          marginTop: -24,
          borderRadius: "28px 28px 0 0",
          position: "relative",
          zIndex: 10,
          padding: 24,
          paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
          background: "var(--stow-surface)",
          boxShadow: "0 -8px 30px rgba(0,0,0,0.1)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column"
        }}
      >
        {mode === "tag" ? (
          <div>
            <h2 style={{ margin: "0 0 16px", fontSize: 20, fontWeight: 800, color: "var(--stow-ink)" }}>Manage Tags</h2>
            <FieldLabel>Assigned</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {(item.tags || []).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onToggleTag(tag)}
                  style={{ ...chipBase, background: "var(--stow-accent)", color: "#fff", border: "none" }}
                >
                  <Tag size={11} color="#fff" />
                  {tag}
                  <X size={11} color="#fff" style={{ opacity: 0.8 }} />
                </button>
              ))}
              {(item.tags || []).length === 0 ? <span style={{ fontSize: 13, color: "var(--stow-warm)" }}>None yet</span> : null}
            </div>

            <FieldLabel>Available</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  aria-label={`Add tag ${tag}`}
                  onClick={() => onToggleTag(tag)}
                  style={{
                    ...chipBase,
                    background: "var(--stow-canvas)",
                    color: "var(--stow-ink-soft)",
                    border: "1px solid var(--stow-border-l)"
                  }}
                >
                  <Tag size={11} color="var(--stow-ink-muted)" />
                  {tag}
                  <Plus size={11} color="var(--stow-warm)" />
                </button>
              ))}
            </div>

            <FieldLabel>Create New</FieldLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") createTag();
                }}
                placeholder="New tag..."
                aria-label="New tag name"
                style={{
                  flex: 1,
                  minWidth: 0,
                  boxSizing: "border-box",
                  borderRadius: "var(--stow-radius-input)",
                  padding: "10px 16px",
                  // ≥16px: anything smaller triggers iOS Safari's focus auto-zoom,
                  // which crops the fixed app shell.
                  fontSize: 16,
                  fontWeight: 500,
                  outline: "none",
                  border: "1.5px solid var(--stow-border)",
                  background: "var(--stow-canvas)",
                  color: "var(--stow-ink)",
                  fontFamily: "inherit"
                }}
              />
              <button
                type="button"
                onClick={createTag}
                disabled={!newTag.trim()}
                style={{
                  padding: "10px 18px",
                  borderRadius: "var(--stow-radius-input)",
                  fontSize: 13,
                  fontWeight: 700,
                  border: "none",
                  background: newTag.trim() ? "var(--stow-accent)" : "var(--stow-border)",
                  color: newTag.trim() ? "#fff" : "var(--stow-warm)",
                  cursor: newTag.trim() ? "pointer" : "default",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap"
                }}
              >
                + Create
              </button>
            </div>
            <Button variant="primary" style={{ background: "var(--stow-ink)", color: "var(--stow-surface)" }} onClick={() => setMode("view")}>
              Done
            </Button>
          </div>
        ) : null}

        {mode === "edit" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--stow-ink)" }}>Edit Item</h2>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={savingEdit}
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "var(--stow-warm)",
                  background: "none",
                  border: "none",
                  cursor: savingEdit ? "default" : "pointer",
                  fontFamily: "inherit"
                }}
              >
                Cancel
              </button>
            </div>
            <Field label="Name" value={draftName} onChange={setDraftName} placeholder="Item name" />
            <div>
              <FieldLabel>Photo</FieldLabel>
              <div style={{ pointerEvents: savingEdit ? "none" : "auto", opacity: savingEdit ? 0.7 : 1 }}>
                <PhotoField
                  value={draftPhotoFieldValue}
                  onChange={changeDraftImage}
                  uploadPath={(fileName) => storagePaths.itemImage(householdId, item.id, fileName)}
                  disabled={savingEdit}
                  onBusyChange={setPhotoUploading}
                />
              </div>
            </div>
            <Field label="Value ($)" type="number" value={draftValue} onChange={setDraftValue} placeholder="0" />
            <Field label="Notes" multiline value={draftNotes} onChange={setDraftNotes} placeholder="Serial number, purchase info..." />
            <Button disabled={!draftName.trim() || savingEdit || photoUploading} onClick={saveEdit}>
              <Save size={16} color="#fff" />
              {savingEdit ? "Saving..." : photoUploading ? "Uploading..." : "Save Changes"}
            </Button>
          </div>
        ) : null}

        {mode === "move" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--stow-ink)" }}>Move Item</h2>
            <div>
              <FieldLabel>Space</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {spaces.map((candidate) => {
                  const selected = candidate.id === moveSpaceId;
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => selectMoveSpace(candidate)}
                      style={{
                        padding: "9px 13px",
                        borderRadius: 99,
                        border: selected ? "none" : "1px solid var(--stow-border-l)",
                        background: selected ? candidate.color : "var(--stow-canvas)",
                        color: selected ? "#fff" : "var(--stow-ink-soft)",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        fontFamily: "inherit"
                      }}
                    >
                      {candidate.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel>Area in {moveSpace?.name ?? "space"}</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(moveSpace?.areas ?? []).map((area) => {
                  const selected = area.id === moveAreaId;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() => setMoveAreaId(area.id)}
                      style={{
                        padding: "9px 13px",
                        borderRadius: 99,
                        border: selected ? "none" : "1px solid var(--stow-border-l)",
                        background: selected ? "var(--stow-accent)" : "var(--stow-canvas)",
                        color: selected ? "#fff" : "var(--stow-ink-soft)",
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: "pointer",
                        fontFamily: "inherit"
                      }}
                    >
                      {area.name}
                    </button>
                  );
                })}
                {moveSpace && moveSpace.areas.length === 0 ? (
                  <span style={{ fontSize: 13, color: "var(--stow-warm)" }}>No areas in this space</span>
                ) : null}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
              <Button disabled={!moveSpace || !moveAreaId || moveSaving} onClick={() => void commitMove()}>
                <ArrowRight size={16} color="#fff" />
                {moveSaving ? "Moving..." : "Move here"}
              </Button>
              <Button variant="neutral" onClick={() => setMode("view")}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "view" ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ flex: 1, marginRight: 12, minWidth: 0 }}>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 900,
                    color: "var(--stow-ink)",
                    letterSpacing: 0,
                    fontFamily: "var(--stow-display)",
                    overflowWrap: "anywhere"
                  }}
                >
                  {item.name}
                </h1>
              </div>
              <button
                type="button"
                aria-pressed={currentStatus === "packed"}
                aria-label={currentStatus === "packed" ? "Mark item at home" : "Mark item packed"}
                disabled={statusSaving}
                onClick={() => void selectStatus(currentStatus === "packed" ? "home" : "packed")}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  border: currentStatus === "packed" ? "none" : "1.5px solid var(--stow-border)",
                  background: currentStatus === "packed" ? STATUS_META.packed.color : "var(--stow-canvas)",
                  color: currentStatus === "packed" ? "#fff" : "var(--stow-warm)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: statusSaving ? "default" : "pointer",
                  flexShrink: 0
                }}
              >
                <Package size={20} strokeWidth={2} color={currentStatus === "packed" ? "#fff" : "var(--stow-warm)"} />
              </button>
            </div>

            <button
              type="button"
              onClick={openMove}
              style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 13,
                borderRadius: 18,
                padding: "14px 16px",
                marginBottom: 12,
                cursor: "pointer",
                background: "var(--stow-accent-soft)",
                border: "1px solid color-mix(in srgb, var(--stow-accent) 15%, transparent)",
                fontFamily: "inherit"
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 13,
                  background: "var(--stow-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <MapPin size={21} color="#fff" strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    color: "var(--stow-accent)",
                    marginBottom: 3
                  }}
                >
                  Location
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 17, fontWeight: 800, color: "var(--stow-ink)" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{spaceName}</span>
                  <ChevronRight size={14} color="var(--stow-warm)" strokeWidth={2.4} style={{ flexShrink: 0 }} />
                  <span style={{ color: "var(--stow-ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {locationArea}
                  </span>
                </div>
              </div>
              <ArrowRight size={16} color="var(--stow-accent)" style={{ flexShrink: 0, opacity: 0.6 }} />
            </button>

            {item.value != null || item.isPriceless ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  marginBottom: 18,
                  marginLeft: 2,
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--stow-warm)"
                }}
              >
                {item.isPriceless ? (
                  <>
                    <Star size={12} color="var(--stow-warm)" />
                    Priceless
                  </>
                ) : (
                  <>
                    <span style={{ textTransform: "uppercase", letterSpacing: 0.8, fontSize: 10.5, fontWeight: 800 }}>Value</span> $
                    {item.value}
                  </>
                )}
              </div>
            ) : null}

            <div style={{ marginBottom: 18 }}>
              <FieldLabel>Status</FieldLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
                {STATUS_ORDER.map((status) => {
                  const meta = STATUS_META[status];
                  const selected = currentStatus === status;
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={status}
                      type="button"
                      data-testid={`status-${status}`}
                      aria-pressed={selected}
                      disabled={statusSaving}
                      onClick={() => void selectStatus(status)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        minWidth: 0,
                        borderRadius: 15,
                        padding: "10px 11px",
                        border: selected ? `1.5px solid ${meta.color}` : "1px solid var(--stow-border-l)",
                        background: selected ? meta.soft : "var(--stow-canvas)",
                        color: "var(--stow-ink)",
                        cursor: statusSaving ? "default" : "pointer",
                        fontFamily: "inherit",
                        textAlign: "left"
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 10,
                          display: "grid",
                          placeItems: "center",
                          background: selected ? meta.color : "var(--stow-surface)",
                          border: selected ? "none" : "1px solid var(--stow-border-l)",
                          flexShrink: 0
                        }}
                      >
                        {selected ? <Check size={14} color="#fff" strokeWidth={3} /> : <Icon size={14} color={meta.color} />}
                      </span>
                      <span
                        style={{
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontSize: 13,
                          fontWeight: 800,
                          color: selected ? meta.color : "var(--stow-ink-soft)"
                        }}
                      >
                        {meta.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {currentStatus === "lent" && item.loan ? (
                <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: "var(--stow-warm)" }}>
                  Lent to <span style={{ color: "var(--stow-ink-soft)" }}>{item.loan.to}</span>
                  {loanSince ? ` · ${loanSince}` : ""}
                </div>
              ) : null}
            </div>

            {item.notes ? (
              <div
                style={{
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 14,
                  background: "var(--stow-canvas)",
                  border: "1px solid var(--stow-border-l)"
                }}
              >
                <FieldLabel>Notes</FieldLabel>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: "var(--stow-ink-soft)", overflowWrap: "anywhere" }}>{item.notes}</p>
              </div>
            ) : null}

            <div style={{ marginBottom: 20 }}>
              <FieldLabel>Tags</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {(item.tags || []).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 14px",
                      borderRadius: 14,
                      fontSize: 13,
                      fontWeight: 700,
                      background: "var(--stow-canvas)",
                      color: "var(--stow-ink-soft)",
                      border: "1px solid var(--stow-border-l)"
                    }}
                  >
                    <Tag size={11} color="var(--stow-ink-muted)" />
                    {tag}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setMode("tag")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    color: "var(--stow-accent-text)",
                    border: "1.5px dashed color-mix(in srgb, var(--stow-accent) 33%, transparent)",
                    background: "var(--stow-accent-soft)",
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  + Add
                </button>
              </div>
            </div>

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              <Button
                variant="ghost"
                onClick={startEdit}
                style={{
                  background: "var(--stow-accent-soft)",
                  color: "var(--stow-accent-text)",
                  border: "1px solid color-mix(in srgb, var(--stow-accent) 15%, transparent)"
                }}
              >
                <Pencil size={15} color="var(--stow-accent-text)" />
                Edit Item
              </Button>
              <Button variant="neutral" onClick={openMove}>
                <ArrowRight size={15} color="var(--stow-ink)" />
                Move to another space
              </Button>
            </div>
          </>
        ) : null}
      </div>
      <LendingSheet
        open={lendingOpen}
        members={members}
        initial={loanInitial}
        onCancel={() => setLendingOpen(false)}
        onConfirm={confirmLoan}
      />
    </div>
  );
}
