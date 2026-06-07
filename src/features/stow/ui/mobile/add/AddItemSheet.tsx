import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { flushSync } from "react-dom";
import type { ImageRef, ItemEntryMode, SpaceWithAreas } from "@/types/domain";
import { inventoryRepository } from "@/features/stow/services/repository";
import { applyVisionSuggestion, type ItemDraftFields } from "@/features/stow/ui/mobile/capture/applyVisionSuggestion";
import { ChevronDown, Plus, Sparkles } from "@/features/stow/ui/mobile/theme/icons";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { PhotoField } from "@/features/stow/ui/mobile/components/PhotoField";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";
import { visionCategorizeItemImage } from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
import { bestEffortDeleteImage } from "@/lib/firebase/storage";

export interface AddItemSheetProps {
  open: boolean;
  householdId: string;
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
    image?: ImageRef;
    entryMode: ItemEntryMode;
  }) => Promise<void> | void;
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

function parseTags(tags: string) {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function isSameImage(left: ImageRef | null, right: ImageRef | null) {
  if (!left || !right) return left === right;
  if (left.storagePath || right.storagePath) return Boolean(left.storagePath && left.storagePath === right.storagePath);
  if (left.downloadUrl || right.downloadUrl) return Boolean(left.downloadUrl && left.downloadUrl === right.downloadUrl);
  return left === right;
}

export function AddItemSheet(props: AddItemSheetProps) {
  const { open, householdId, spaces, defaultSpaceId, defaultAreaId, onClose, onCreate } = props;
  const initialLocation = useMemo(() => resolveInitialLocation(spaces, defaultSpaceId, defaultAreaId), [spaces, defaultSpaceId, defaultAreaId]);

  const [draftImageId, setDraftImageId] = useState(() => inventoryRepository.createItemDraftId(householdId));
  const [name, setName] = useState("");
  const [spaceId, setSpaceId] = useState(initialLocation.spaceId);
  const [areaId, setAreaId] = useState(initialLocation.areaId);
  const [value, setValue] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [image, setImage] = useState<ImageRef | null>(null);
  const [photoFieldKey, setPhotoFieldKey] = useState(0);
  const [aiFilled, setAiFilled] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanRequestIdRef = useRef(0);
  const acceptingImageChangesRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setDraftImageId(inventoryRepository.createItemDraftId(householdId));
    acceptingImageChangesRef.current = true;
    setSpaceId(initialLocation.spaceId);
    setAreaId(initialLocation.areaId);
  }, [householdId, open, initialLocation.spaceId, initialLocation.areaId]);

  const selectedSpace = useMemo(() => spaces.find((space) => space.id === spaceId) ?? spaces[0] ?? null, [spaces, spaceId]);
  const selectedArea = selectedSpace?.areas.find((area) => area.id === areaId) ?? null;
  const hasAreas = Boolean(selectedSpace?.areas.length);
  const canSubmit = Boolean(name.trim() && selectedSpace && selectedArea);
  const busy = scanning || submitting;

  const uploadPath = useCallback(
    (fileName: string) => storagePaths.draftImage(householdId, draftImageId, fileName),
    [draftImageId, householdId]
  );

  const runAiScan = useCallback(async () => {
    if (!image?.storagePath) {
      setScanError("Add a photo first, then scan.");
      return;
    }
    if (submitting) return;

    const requestId = scanRequestIdRef.current + 1;
    scanRequestIdRef.current = requestId;
    setScanning(true);
    setScanError(null);
    try {
      const response = await visionCategorizeItemImage({
        householdId,
        imageRef: { storagePath: image.storagePath },
        context: {
          spaceId: selectedSpace?.id,
          areaId: selectedArea?.id,
          areaName: selectedArea?.name
        }
      });
      if (scanRequestIdRef.current !== requestId) return;
      const current: ItemDraftFields = {
        name,
        tags: parseTags(tags),
        notes,
        value
      };
      const next = applyVisionSuggestion(current, response.suggestion);
      setName(next.name);
      setTags(next.tags.join(", "));
      setNotes(next.notes);
      setAiFilled(true);
    } catch {
      if (scanRequestIdRef.current === requestId) setScanError("Couldn't read the photo. Try again or fill the details yourself.");
    } finally {
      if (scanRequestIdRef.current === requestId) setScanning(false);
    }
  }, [householdId, image?.storagePath, name, notes, selectedArea?.id, selectedArea?.name, selectedSpace?.id, submitting, tags, value]);

  function selectSpace(nextId: string) {
    const next = spaces.find((space) => space.id === nextId);
    setSpaceId(nextId);
    setAreaId(next?.areas[0]?.id ?? "");
  }

  function handleImageChange(next: ImageRef | null) {
    if (!acceptingImageChangesRef.current) {
      if (next) void bestEffortDeleteImage(next);
      return;
    }

    if (!isSameImage(image, next)) {
      scanRequestIdRef.current += 1;
      setAiFilled(false);
      setScanning(false);
    }
    setImage(next);
    setScanError(null);
  }

  function resetForm() {
    scanRequestIdRef.current += 1;
    setName("");
    setValue("");
    setTags("");
    setNotes("");
    setMoreOpen(false);
    setSpaceId(initialLocation.spaceId);
    setAreaId(initialLocation.areaId);
    setImage(null);
    setAiFilled(false);
    setScanning(false);
    setSubmitting(false);
    setScanError(null);
  }

  function handleCancel() {
    if (submitting) return;
    acceptingImageChangesRef.current = false;
    scanRequestIdRef.current += 1;
    if (image) void bestEffortDeleteImage(image);
    setImage(null);
    setAiFilled(false);
    setScanning(false);
    setSubmitting(false);
    setScanError(null);
    onClose();
  }

  async function submit() {
    if (!canSubmit || !selectedSpace || !selectedArea || busy) return;
    const imageToSave = image;
    const entryModeToSave: ItemEntryMode = aiFilled ? "ai_assisted" : "manual";
    acceptingImageChangesRef.current = false;
    flushSync(() => {
      setPhotoFieldKey((current) => current + 1);
      setImage(null);
    });
    setSubmitting(true);
    setScanError(null);
    try {
      await onCreate({
        name: name.trim(),
        spaceId: selectedSpace.id,
        areaId: selectedArea.id,
        areaNameSnapshot: selectedArea.name,
        value: value.trim() ? Number.parseFloat(value) : null,
        tags: parseTags(tags),
        notes,
        image: imageToSave ?? undefined,
        entryMode: entryModeToSave
      });
      resetForm();
    } catch {
      acceptingImageChangesRef.current = true;
      setImage(imageToSave);
      setAiFilled(entryModeToSave === "ai_assisted");
      setScanError("Couldn't save item. Try again.");
      setSubmitting(false);
    }
  }

  const tagCount = parseTags(tags).length;
  const filledHints = [value.trim() ? `$${value.trim()}` : null, tagCount > 0 ? `${tagCount} tag${tagCount === 1 ? "" : "s"}` : null].filter(
    Boolean
  );

  return (
    <Sheet open={open} onClose={handleCancel} title="Add Item">
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
          <div style={{ pointerEvents: submitting ? "none" : "auto", opacity: submitting ? 0.7 : 1 }}>
            <PhotoField key={photoFieldKey} value={image} onChange={handleImageChange} onScanAI={runAiScan} uploadPath={uploadPath} />
          </div>
          {image && !aiFilled ? (
            <Button variant="neutral" disabled={busy} onClick={runAiScan} style={{ marginTop: 10, padding: "12px 0" }}>
              <Sparkles size={15} color="var(--stow-accent)" /> {scanning ? "Reading photo..." : "Scan with AI"}
            </Button>
          ) : null}
          {scanning ? (
            <p style={{ margin: "8px 2px 0", fontSize: 12.5, fontWeight: 600, color: "var(--stow-ink-muted)" }}>
              Reading photo...
            </p>
          ) : null}
          {scanError ? (
            <p style={{ margin: "8px 2px 0", fontSize: 12.5, fontWeight: 600, color: "var(--stow-danger)" }}>{scanError}</p>
          ) : null}
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

        <Button variant="primary" disabled={!canSubmit || busy} onClick={submit}>
          <Plus size={16} color="#fff" /> {submitting ? "Saving..." : "Add Item"}
        </Button>
      </div>
    </Sheet>
  );
}
