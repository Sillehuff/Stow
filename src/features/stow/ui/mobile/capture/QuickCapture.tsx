import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ActivityEntry, ImageRef, SpaceWithAreas } from "@/types/domain";
import type { ShelfDetection, VisionDetectShelfResponse } from "@/types/llm";
import { buildActivityEntry, type NewBatchItem } from "@/features/stow/services/repository";
import {
  captureReducer,
  initialCaptureState,
  selectCommitItems,
  type CaptureDestination
} from "@/features/stow/ui/mobile/capture/captureReducer";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  DollarSign,
  HelpCircle,
  MapPin,
  Pencil,
  RotateCcw,
  ScanLine,
  Tag,
  X
} from "@/features/stow/ui/mobile/theme/icons";
import { completeWrite } from "@/lib/firebase/completeWrite";
import { visionDetectShelfItems } from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
import { uploadFileToStorage } from "@/lib/firebase/storage";

export interface QuickCaptureProps {
  householdId: string;
  spaceId?: string;
  areaId?: string;
  onClose: () => void;
  onCommitted: (count: number, committed: boolean) => void;
}

export interface QuickCaptureData {
  spaces: SpaceWithAreas[];
  userId: string;
  actorName: string;
  createItemsBatch: (input: { householdId: string; userId: string; items: NewBatchItem[] }) => Promise<string[]>;
  logActivity: (input: {
    householdId: string;
    entry: Omit<ActivityEntry, "id" | "householdId" | "createdAt">;
  }) => Promise<void>;
  detectShelfItems?: typeof visionDetectShelfItems;
  uploadFrame?: (blob: Blob) => Promise<ImageRef>;
  capturedBlob: Blob;
  capturedPreviewUrl: string;
}

type QuickCaptureAllProps = QuickCaptureProps & QuickCaptureData;

const DARK = "#0A0A12";
const AMBER = "#C9821F";
const LOW_CONFIDENCE = 0.6;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function pct(value: number): string {
  return `${clamp(value) * 100}%`;
}

function detectionBoxStyle(detection: ShelfDetection): CSSProperties {
  const [x, y, w, h] = detection.bbox;
  const left = clamp(x);
  const top = clamp(y);
  return {
    position: "absolute",
    left: pct(left),
    top: pct(top),
    width: pct(Math.min(clamp(w), 1 - left)),
    height: pct(Math.min(clamp(h), 1 - top))
  };
}

function confidencePct(detection: ShelfDetection): number {
  return Math.round(clamp(detection.confidence) * 100);
}

function lowConfidence(detection: ShelfDetection): boolean {
  return detection.confidence < LOW_CONFIDENCE;
}

function resolveInitialDest(spaces: SpaceWithAreas[], spaceId?: string, areaId?: string): CaptureDestination {
  const spaceFromArea = areaId ? spaces.find((space) => space.areas.some((area) => area.id === areaId)) : undefined;
  const explicitSpace = spaceId ? spaces.find((space) => space.id === spaceId) : undefined;
  const space = explicitSpace ?? spaceFromArea ?? spaces.find((candidate) => candidate.areas.length > 0) ?? spaces[0] ?? null;
  const area = space
    ? (areaId ? space.areas.find((candidate) => candidate.id === areaId) : undefined) ?? space.areas[0] ?? null
    : null;

  return {
    spaceId: space?.id ?? null,
    areaId: area?.id ?? null,
    areaNameSnapshot: area?.name ?? ""
  };
}

function shelfFileName(): string {
  return `shelf-${Date.now()}.jpg`;
}

async function defaultUploadFrame(householdId: string, blob: Blob): Promise<ImageRef> {
  const name = shelfFileName();
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  return uploadFileToStorage(storagePaths.itemImage(householdId, "_shelf", name), file, {
    contentType: file.type
  });
}

function destinationLabel(spaces: SpaceWithAreas[], destination: CaptureDestination): {
  color: string;
  label: string;
  space: SpaceWithAreas | null;
} {
  const space = destination.spaceId ? spaces.find((candidate) => candidate.id === destination.spaceId) ?? null : null;
  return {
    color: space?.color ?? "var(--stow-accent)",
    label: space ? `${space.name} · ${destination.areaNameSnapshot || "Choose area"}` : "Choose destination",
    space
  };
}

function QuickCaptureAttempt(props: QuickCaptureAllProps & { onRescan: () => void }) {
  const {
    householdId,
    spaceId,
    areaId,
    onClose,
    onCommitted,
    spaces,
    userId,
    actorName,
    createItemsBatch,
    logActivity,
    detectShelfItems = visionDetectShelfItems,
    uploadFrame,
    capturedBlob,
    capturedPreviewUrl,
    onRescan
  } = props;
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const analyzedAttemptRef = useRef<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [state, dispatch] = useReducer(
    captureReducer,
    undefined,
    () => initialCaptureState(resolveInitialDest(spaces, spaceId, areaId))
  );

  const upload = useCallback(
    (blob: Blob) => (uploadFrame ? uploadFrame(blob) : defaultUploadFrame(householdId, blob)),
    [householdId, uploadFrame]
  );

  const destination = useMemo(() => destinationLabel(spaces, state.destination), [spaces, state.destination]);
  const currentIndex = state.order[state.cursor];
  const currentDetection = currentIndex != null ? state.detections[currentIndex] : undefined;
  const currentDraft = currentIndex != null ? state.drafts[currentIndex] : undefined;
  const commitItems = useMemo(() => selectCommitItems(state), [state]);
  const namedKeptCount = state.detections.filter((_, index) => {
    const draft = state.drafts[index];
    return Boolean(draft?.keep && draft.name.trim());
  }).length;
  const skippedCount = state.detections.filter((_, index) => state.drafts[index]?.keep === false).length;
  const lowCount = state.detections.filter(lowConfidence).length;
  const hasDestination = Boolean(state.destination.spaceId && state.destination.areaId);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (state.destination.spaceId && state.destination.areaId) return;
    const next = resolveInitialDest(spaces, spaceId, areaId);
    if (!next.spaceId || !next.areaId) return;
    dispatch({ type: "setDestination", destination: next });
  }, [areaId, spaceId, spaces, state.destination.areaId, state.destination.spaceId]);

  useEffect(() => {
    if (state.phase !== "analyzing" || analyzedAttemptRef.current === retryKey) return;
    analyzedAttemptRef.current = retryKey;
    let cancelled = false;

    async function analyze() {
      setAnalyzeError(null);
      try {
        const image = await upload(capturedBlob);
        if (!image.storagePath) throw new Error("Uploaded frame has no storage path");
        const response: VisionDetectShelfResponse = await detectShelfItems({
          householdId,
          imageRef: { storagePath: image.storagePath },
          spaceId: state.destination.spaceId ?? undefined,
          areaId: state.destination.areaId ?? undefined,
          areaName: state.destination.areaNameSnapshot || undefined
        });
        if (!cancelled) dispatch({ type: "detected", detections: response.detections });
      } catch {
        if (!cancelled) setAnalyzeError("Shelf detection failed. Try again or close this capture.");
      }
    }

    void analyze();
    return () => {
      cancelled = true;
      if (analyzedAttemptRef.current === retryKey) analyzedAttemptRef.current = null;
    };
  }, [capturedBlob, detectShelfItems, householdId, retryKey, state.destination, state.phase, upload]);

  useEffect(() => {
    if (state.phase === "review" && state.cursor >= state.order.length) {
      dispatch({ type: "commitReady" });
    }
  }, [state.cursor, state.order.length, state.phase]);

  function retryAnalyze() {
    analyzedAttemptRef.current = null;
    setRetryKey((key) => key + 1);
  }

  function startReview() {
    setRenaming(currentIndex != null && (state.drafts[currentIndex]?.name.trim() ?? "") === "");
    dispatch({ type: "startReview" });
  }

  function selectDestination(destination: CaptureDestination) {
    dispatch({ type: "setDestination", destination });
    setPickerOpen(false);
  }

  function confirmCurrent() {
    if (currentIndex == null || !currentDraft) return;
    if (!currentDraft.name.trim()) {
      setRenaming(true);
      return;
    }
    setRenaming(false);
    dispatch({ type: "confirm", index: currentIndex });
  }

  function skipCurrent() {
    if (currentIndex == null) return;
    setRenaming(false);
    dispatch({ type: "skip", index: currentIndex });
  }

  async function commit() {
    if (committing) return;
    if (!hasDestination && namedKeptCount > 0) {
      setCommitError("Choose a destination before filing these items.");
      return;
    }
    setCommitting(true);
    setCommitError(null);
    try {
      if (commitItems.length === 0) {
        onCommitted(0, true);
        return;
      }
      const write = createItemsBatch({ householdId, userId, items: commitItems }).then((itemIds) => {
        // Best-effort: an activity-log failure must not look like a failed save (it caused duplicate items on retry).
        logActivity({
          householdId,
          entry: buildActivityEntry({
            type: "items_added_batch",
            actorUid: userId,
            actorName,
            count: itemIds.length,
            spaceName: destination.space?.name,
            areaName: state.destination.areaNameSnapshot,
            spaceId: state.destination.spaceId ?? undefined,
            areaId: state.destination.areaId ?? undefined
          })
        }).catch((error) => console.error("Activity log failed", error));
        return itemIds;
      });
      const committed = await completeWrite(write);
      onCommitted(commitItems.length, committed);
    } catch {
      setCommitError("Couldn't file these items. Try again.");
      setCommitting(false);
    }
  }

  function renderDestinationPicker() {
    if (!pickerOpen) return null;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose destination"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 92,
          background: "var(--stow-canvas)",
          display: "flex",
          flexDirection: "column",
          animation: "stowUp 0.26s ease-out"
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "54px 20px 14px",
            borderBottom: "1px solid var(--stow-border-l)"
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--stow-ink)" }}>File these in</div>
          <button
            type="button"
            onClick={() => setPickerOpen(false)}
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--stow-accent)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            Done
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 28px" }}>
          {spaces.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "var(--stow-warm)", fontSize: 13, fontWeight: 700 }}>
              Create a space and area before filing a shelf.
            </div>
          ) : null}
          {spaces.map((space) => (
            <div key={space.id} style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: space.color }} />
                <span style={{ fontSize: 14.5, fontWeight: 800, color: "var(--stow-ink)" }}>{space.name}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {space.areas.length === 0 ? (
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--stow-warm)" }}>No areas yet</span>
                ) : null}
                {space.areas.map((area) => {
                  const active = state.destination.spaceId === space.id && state.destination.areaId === area.id;
                  return (
                    <button
                      key={area.id}
                      type="button"
                      onClick={() =>
                        selectDestination({ spaceId: space.id, areaId: area.id, areaNameSnapshot: area.name })
                      }
                      style={{
                        padding: "9px 14px",
                        borderRadius: "var(--stow-radius-input)",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        border: `1.5px solid ${active ? space.color : "var(--stow-border)"}`,
                        background: active
                          ? `color-mix(in srgb, ${space.color} 14%, var(--stow-surface))`
                          : "var(--stow-surface)",
                        color: active ? "var(--stow-ink)" : "var(--stow-ink-soft)"
                      }}
                    >
                      {area.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderDestPill(light = false) {
    return (
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "7px 12px",
          borderRadius: 99,
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 12.5,
          fontWeight: 800,
          border: `1.5px solid ${light ? "rgba(255,255,255,0.28)" : "var(--stow-border)"}`,
          background: light ? "rgba(255,255,255,0.14)" : "var(--stow-surface)",
          color: light ? "#fff" : "var(--stow-ink)",
          backdropFilter: light ? "blur(10px)" : "none",
          WebkitBackdropFilter: light ? "blur(10px)" : "none"
        }}
      >
        <span style={{ width: 9, height: 9, borderRadius: 99, background: destination.color, flexShrink: 0 }} />
        {destination.label}
        <ChevronDown size={13} color={light ? "rgba(255,255,255,0.8)" : "var(--stow-ink-muted)"} />
      </button>
    );
  }

  function renderFrozenFrame() {
    const analyzing = state.phase === "analyzing";
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick Capture"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 90,
          background: DARK,
          overflow: "hidden",
          animation: "stowUp 0.3s ease-out"
        }}
      >
        <img
          src={capturedPreviewUrl}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: analyzing ? 0.74 : 0.82,
            filter: "saturate(0.92)"
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to bottom, rgba(10,10,18,0.6), rgba(10,10,18,0.05) 30%, rgba(10,10,18,0.2) 64%, rgba(10,10,18,0.92))"
          }}
        />

        <div style={{ position: "absolute", top: 104, left: 22, right: 22, bottom: 116, minHeight: 260 }}>
          <CornerBrackets color="rgba(255,255,255,0.7)" />
        </div>

        {analyzing ? (
          <div style={{ position: "absolute", inset: 0, zIndex: 3, overflow: "hidden", pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 64,
                background:
                  "linear-gradient(to bottom, rgba(232,101,43,0), color-mix(in srgb, var(--stow-accent) 32%, transparent) 70%, rgba(255,255,255,0.55))",
                borderBottom: "2px solid var(--stow-accent)",
                animation: "capSweep 2.8s ease-in-out infinite"
              }}
            />
          </div>
        ) : null}

        <div
          style={{
            position: "absolute",
            top: 54,
            left: 0,
            right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            zIndex: 5
          }}
        >
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 38,
              height: 38,
              borderRadius: 99,
              background: "rgba(255,255,255,0.16)",
              border: "none",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer"
            }}
          >
            <X size={17} color="#fff" />
          </button>
          {analyzing ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                color: "#fff",
                fontSize: 12.5,
                fontWeight: 800,
                background: "rgba(255,255,255,0.16)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                padding: "8px 14px",
                borderRadius: 99
              }}
            >
              <ScanLine size={13} color="var(--stow-accent)" /> Analyzing frame
              <span style={{ display: "inline-flex", gap: 2 }}>
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 99,
                      background: "#fff",
                      animation: "capDots 1.1s ease-in-out infinite",
                      animationDelay: `${dot * 0.16}s`
                    }}
                  />
                ))}
              </span>
            </div>
          ) : (
            renderDestPill(true)
          )}
          <div style={{ width: 38 }} />
        </div>

        {state.phase === "detected" ? (
          <div style={{ position: "absolute", inset: 0, zIndex: 4 }}>
            {state.detections.map((detection, index) => {
              const low = lowConfidence(detection);
              const color = low ? AMBER : "var(--stow-accent)";
              const [x, , w] = detection.bbox;
              const rightAligned = clamp(x) + clamp(w) > 0.74;
              return (
                <div
                  key={`${detection.label}-${index}`}
                  style={{
                    ...detectionBoxStyle(detection),
                    border: `2.5px ${low ? "dashed" : "solid"} ${color}`,
                    borderRadius: 12,
                    boxShadow: low
                      ? "inset 0 0 26px rgba(201,130,31,0.14)"
                      : "0 0 0 2px color-mix(in srgb, var(--stow-accent) 22%, transparent), inset 0 0 28px color-mix(in srgb, var(--stow-accent) 10%, transparent)",
                    animation: "capPop 0.28s ease-out both",
                    animationDelay: `${index * 0.08}s`
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: -11,
                      [rightAligned ? "right" : "left"]: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      background: color,
                      color: "#fff",
                      fontSize: 10.5,
                      fontWeight: 800,
                      padding: "3px 9px",
                      borderRadius: 7,
                      whiteSpace: "nowrap",
                      maxWidth: 150,
                      overflow: "hidden"
                    }}
                  >
                    {low ? <HelpCircle size={11} color="#fff" /> : null}
                    {low ? "?" : detection.label || "?"} <span style={{ opacity: 0.82 }}>{confidencePct(detection)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 22px 38px", zIndex: 5 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 15px",
                borderRadius: 99,
                background: "rgba(255,255,255,0.16)",
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 800
              }}
            >
              {analyzing ? (
                <>
                  <ScanLine size={14} color="var(--stow-accent)" /> Reading the shelf
                </>
              ) : (
                <>
                  <Check size={14} color="var(--stow-success)" strokeWidth={3} /> {state.detections.length} found
                  <span style={{ width: 3, height: 3, borderRadius: 99, background: "rgba(255,255,255,0.5)" }} />
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FFD9A6" }}>
                    <AlertTriangle size={12} color="#FFD9A6" /> {lowCount} need a look
                  </span>
                </>
              )}
            </div>
          </div>

          {analyzeError ? (
            <div
              style={{
                background: "rgba(0,0,0,0.38)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: 16,
                padding: 14,
                marginBottom: 12,
                fontSize: 13,
                fontWeight: 700
              }}
            >
              <div style={{ marginBottom: 10 }}>{analyzeError}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" onClick={retryAnalyze} style={ghostDarkButtonStyle}>
                  Retry
                </button>
                <button type="button" onClick={onClose} style={ghostDarkButtonStyle}>
                  Close
                </button>
              </div>
            </div>
          ) : null}

          {state.phase === "detected" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <button type="button" onClick={onRescan} style={darkSecondaryButtonStyle}>
                <RotateCcw size={16} color="#fff" /> Rescan
              </button>
              <button
                type="button"
                onClick={startReview}
                disabled={state.detections.length === 0}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 15,
                  background: state.detections.length === 0 ? "rgba(255,255,255,0.28)" : "var(--stow-accent)",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontSize: 15,
                  fontWeight: 800,
                  border: "none",
                  cursor: state.detections.length === 0 ? "default" : "pointer",
                  fontFamily: "inherit",
                  boxShadow: "0 10px 24px color-mix(in srgb, var(--stow-accent) 33%, transparent)"
                }}
              >
                Review {state.detections.length} items <ArrowRight size={17} color="#fff" />
              </button>
            </div>
          ) : null}

          <div
            style={{
              textAlign: "center",
              marginTop: 12,
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(255,255,255,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6
            }}
          >
            <Camera size={12} color="rgba(255,255,255,0.6)" /> One still frame, not live video
          </div>
        </div>
        {renderDestinationPicker()}
      </div>
    );
  }

  function renderReview() {
    if (!currentDetection || currentIndex == null || !currentDraft) {
      return (
        <div role="dialog" aria-modal="true" aria-label="Review shelf items" style={lightOverlayStyle}>
          <button ref={closeButtonRef} type="button" aria-label="Close" onClick={onClose} style={roundHeaderButtonStyle}>
            <X size={16} color="var(--stow-ink-muted)" />
          </button>
          <div style={{ margin: "auto", padding: 24, textAlign: "center", color: "var(--stow-warm)", fontWeight: 700 }}>
            No detections to review.
          </div>
          {renderDestinationPicker()}
        </div>
      );
    }

    const low = lowConfidence(currentDetection);
    const unknown = currentDetection.label.trim() === "";
    const color = low ? AMBER : "var(--stow-success)";
    const name = currentDraft.name;

    return (
      <div role="dialog" aria-modal="true" aria-label="Review shelf items" style={lightOverlayStyle}>
        <div style={{ padding: "58px 22px 4px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <button ref={closeButtonRef} type="button" aria-label="Close" onClick={onClose} style={roundHeaderButtonStyle}>
            <X size={16} color="var(--stow-ink-muted)" />
          </button>
          <span
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 16,
              fontWeight: 800,
              color: "var(--stow-ink)",
              whiteSpace: "nowrap"
            }}
          >
            Review {state.order.length} items
          </span>
          <div style={{ width: 34, flexShrink: 0 }} />
        </div>
        <div style={{ padding: "6px 22px 8px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <AlertTriangle size={12} color={AMBER} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--stow-ink-muted)" }}>
            Least sure first — confirm these, then breeze through the rest
          </span>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 13, flexShrink: 0 }}>
          {state.order.map((index, position) => {
            const detection = state.detections[index];
            const done = position < state.cursor;
            const active = position === state.cursor;
            const dotColor = detection && lowConfidence(detection) ? AMBER : "var(--stow-success)";
            return (
              <div
                key={index}
                style={{
                  width: active ? 22 : 7,
                  height: 7,
                  borderRadius: 99,
                  background: done || active ? dotColor : "var(--stow-border)",
                  opacity: done ? 0.4 : 1,
                  transition: "all .2s"
                }}
              />
            );
          })}
        </div>

        <div style={{ flex: 1, position: "relative", padding: "0 22px", minHeight: 0 }}>
          <div
            style={{
              position: "relative",
              background: "var(--stow-surface)",
              borderRadius: 22,
              border: "1px solid var(--stow-border-l)",
              boxShadow: "0 16px 40px rgba(0,0,0,0.13)",
              overflow: "hidden"
            }}
          >
            <div style={{ height: 4, background: color }} />
            <div style={{ position: "relative", height: 150, overflow: "hidden" }}>
              <img
                src={capturedPreviewUrl}
                alt=""
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  filter: unknown ? "blur(1.5px) brightness(0.8)" : "none"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  ...detectionBoxStyle(currentDetection),
                  border: `2px ${low ? "dashed" : "solid"} ${color}`,
                  borderRadius: 10,
                  background: low ? "rgba(201,130,31,0.1)" : "color-mix(in srgb, var(--stow-success) 12%, transparent)"
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  left: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 11px",
                  borderRadius: 99,
                  background: color,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                {low ? (
                  <>
                    <AlertTriangle size={11} color="#fff" /> Low confidence
                  </>
                ) : (
                  <>
                    <Check size={11} color="#fff" strokeWidth={3} /> Confident
                  </>
                )}
              </div>
              <div
                style={{
                  position: "absolute",
                  top: 12,
                  right: 12,
                  padding: "5px 11px",
                  borderRadius: 99,
                  background: "rgba(0,0,0,0.5)",
                  backdropFilter: "blur(8px)",
                  WebkitBackdropFilter: "blur(8px)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800
                }}
              >
                {state.cursor + 1} of {state.order.length}
              </div>
              <div style={{ position: "absolute", left: 12, right: 12, bottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 5, borderRadius: 99, background: "rgba(255,255,255,0.35)", overflow: "hidden" }}>
                  <div style={{ width: `${confidencePct(currentDetection)}%`, height: "100%", background: color, borderRadius: 99 }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>
                  {confidencePct(currentDetection)}% match
                </span>
              </div>
            </div>

            <div style={{ padding: "14px 18px 18px" }}>
              {unknown || renaming ? (
                <>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: unknown ? AMBER : "var(--stow-accent)",
                      marginBottom: 8
                    }}
                  >
                    {unknown ? "Couldn't identify — name it or skip" : "Rename item"}
                  </div>
                  <input
                    autoFocus
                    value={name}
                    onChange={(event) => dispatch({ type: "rename", index: currentIndex, name: event.target.value })}
                    placeholder="e.g. Wireless Earbuds"
                    style={nameInputStyle}
                  />
                </>
              ) : low ? (
                <>
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      color: AMBER,
                      marginBottom: 8
                    }}
                  >
                    Best guess — confirm which
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "rename", index: currentIndex, name: currentDetection.label })}
                      style={guessChipStyle(true)}
                    >
                      <Check size={13} color="#fff" strokeWidth={3} />
                      {currentDetection.label}
                    </button>
                    <button type="button" onClick={() => setRenaming(true)} style={guessChipStyle(false)}>
                      Something else
                    </button>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 19, fontWeight: 800, color: "var(--stow-ink)", marginBottom: 14 }}>{name}</div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button type="button" onClick={() => setPickerOpen(true)} style={metadataButtonStyle}>
                  <MapPin size={12} color="var(--stow-accent)" /> {destination.label}
                  <ChevronDown size={12} color="var(--stow-accent)" />
                </button>
                {typeof currentDraft.value === "number" ? (
                  <span style={metadataChipStyle}>
                    <DollarSign size={12} color="var(--stow-ink-muted)" /> {currentDraft.value}
                  </span>
                ) : null}
                {currentDraft.tags.slice(0, 2).map((tag) => (
                  <span key={tag} style={metadataChipStyle}>
                    <Tag size={12} color="var(--stow-ink-muted)" /> {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 18, marginTop: 22 }}>
            <button type="button" onClick={skipCurrent} aria-label="Skip" title="Skip" style={roundActionButtonStyle}>
              <X size={22} color="var(--stow-warm)" strokeWidth={2.4} />
            </button>
            <button type="button" onClick={confirmCurrent} style={confirmButtonStyle}>
              <Check size={19} color="#fff" strokeWidth={2.6} /> Confirm &amp; add
            </button>
            <button
              type="button"
              onClick={() => setRenaming((value) => !value)}
              aria-label="Rename"
              title="Rename"
              style={{
                ...roundActionButtonStyle,
                background: renaming ? "var(--stow-accent-soft)" : "var(--stow-surface)",
                border: `1.5px solid ${renaming ? "var(--stow-accent)" : "var(--stow-border)"}`
              }}
            >
              <Pencil size={20} color={renaming ? "var(--stow-accent)" : "var(--stow-ink-soft)"} />
            </button>
          </div>
          <div style={{ textAlign: "center", marginTop: 13, fontSize: 11.5, fontWeight: 600, color: "var(--stow-warm)" }}>
            Confirm to add · skip to discard
          </div>
        </div>
        {renderDestinationPicker()}
      </div>
    );
  }

  function renderDone() {
    const destinationUnavailable = !hasDestination && namedKeptCount > 0;
    return (
      <div role="dialog" aria-modal="true" aria-label="Shelf capture complete" style={lightOverlayStyle}>
        <div style={{ flex: 1, overflowY: "auto", padding: "62px 24px 0" }}>
          <div style={{ textAlign: "center", marginTop: 14, marginBottom: 22 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 99,
                background: "var(--stow-success-soft)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px"
              }}
            >
              <Check size={32} color="var(--stow-success)" strokeWidth={2.6} />
            </div>
            <h1
              style={{
                margin: "0 0 8px",
                fontSize: 24,
                fontWeight: 900,
                color: "var(--stow-ink)",
                fontFamily: "var(--stow-display)"
              }}
            >
              {commitItems.length} item{commitItems.length !== 1 ? "s" : ""} filed
            </h1>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 13.5,
                fontWeight: 700,
                color: "var(--stow-ink-soft)",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: 99, background: destination.color }} />
              {destination.space?.name ?? "Choose destination"} <ChevronRight size={13} color="var(--stow-warm)" />
              {state.destination.areaNameSnapshot || "Area"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {commitItems.map((item) => (
              <div
                key={`${item.spaceId}-${item.areaId}-${item.name}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "var(--stow-surface)",
                  border: "1px solid var(--stow-border-l)",
                  boxShadow: "var(--stow-shadow-soft)"
                }}
              >
                <img
                  src={capturedPreviewUrl}
                  alt=""
                  style={{ width: 44, height: 44, borderRadius: 11, objectFit: "cover", flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 700,
                      color: "var(--stow-ink)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis"
                    }}
                  >
                    {item.name}
                  </div>
                  {typeof item.value === "number" ? (
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--stow-warm)", marginTop: 1 }}>${item.value}</div>
                  ) : null}
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 99,
                    background: "var(--stow-success-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Check size={13} color="var(--stow-success)" strokeWidth={3} />
                </div>
              </div>
            ))}
            {commitItems.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", fontSize: 13, fontWeight: 600, color: "var(--stow-warm)" }}>
                Nothing added — everything was skipped.
              </div>
            ) : null}
            {skippedCount > 0 ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", fontSize: 12.5, fontWeight: 600, color: "var(--stow-warm)" }}>
                <X size={14} color="var(--stow-warm)" /> {skippedCount} skipped · not added
              </div>
            ) : null}
            {destinationUnavailable ? (
              <button type="button" onClick={() => setPickerOpen(true)} style={chooseDestinationStyle}>
                <MapPin size={15} color="#fff" /> Choose destination
              </button>
            ) : null}
            {commitError ? (
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--stow-danger)", textAlign: "center" }}>{commitError}</div>
            ) : null}
          </div>
        </div>

        <div style={{ padding: "12px 24px 28px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={committing || destinationUnavailable}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "16px 0",
              borderRadius: 15,
              background: committing || destinationUnavailable ? "var(--stow-warm)" : "var(--stow-ink)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              border: "none",
              cursor: committing || destinationUnavailable ? "default" : "pointer",
              fontFamily: "inherit"
            }}
          >
            {committing ? "Filing" : "Done"}
          </button>
        </div>
        {renderDestinationPicker()}
      </div>
    );
  }

  // Live port of prototype/quick-capture.jsx; all imagery comes from the frozen captured frame.
  if (state.phase === "analyzing" || state.phase === "detected") return renderFrozenFrame();
  if (state.phase === "review") return renderReview();
  return renderDone();
}

export function QuickCapture(props: QuickCaptureAllProps) {
  const [attempt, setAttempt] = useState(0);
  return <QuickCaptureAttempt key={attempt} {...props} onRescan={() => setAttempt((value) => value + 1)} />;
}

const ghostDarkButtonStyle: CSSProperties = {
  flex: 1,
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: 12,
  background: "rgba(255,255,255,0.14)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 13,
  fontWeight: 800,
  padding: "10px 12px"
};

const darkSecondaryButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  padding: "0 18px",
  height: 52,
  borderRadius: 15,
  background: "rgba(255,255,255,0.14)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1.5px solid rgba(255,255,255,0.28)",
  color: "#fff",
  fontSize: 13.5,
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: "inherit"
};

const lightOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 90,
  background: "var(--stow-canvas)",
  display: "flex",
  flexDirection: "column",
  animation: "stowUp 0.3s ease-out"
};

const roundHeaderButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 99,
  background: "var(--stow-surface)",
  border: "1px solid var(--stow-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0
};

const nameInputStyle: CSSProperties = {
  width: "100%",
  borderRadius: "var(--stow-radius-input)",
  padding: "12px 15px",
  fontSize: 15,
  fontWeight: 600,
  outline: "none",
  border: "1.5px solid var(--stow-border)",
  background: "var(--stow-canvas)",
  color: "var(--stow-ink)",
  fontFamily: "inherit",
  marginBottom: 14
};

function guessChipStyle(active: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 13px",
    borderRadius: 11,
    fontSize: 13.5,
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
    background: active ? "var(--stow-ink)" : "var(--stow-canvas)",
    color: active ? "#fff" : "var(--stow-ink-soft)",
    border: `1.5px solid ${active ? "var(--stow-ink)" : "var(--stow-border)"}`
  };
}

const metadataButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 11px",
  borderRadius: 99,
  background: "var(--stow-accent-soft)",
  border: "1px solid color-mix(in srgb, var(--stow-accent) 20%, transparent)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--stow-accent)",
  cursor: "pointer",
  fontFamily: "inherit"
};

const metadataChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 11px",
  borderRadius: 99,
  background: "var(--stow-canvas)",
  border: "1px solid var(--stow-border)",
  fontSize: 12,
  fontWeight: 700,
  color: "var(--stow-ink-soft)"
};

const roundActionButtonStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 99,
  background: "var(--stow-surface)",
  border: "1.5px solid var(--stow-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "var(--stow-shadow-soft)",
  cursor: "pointer"
};

const confirmButtonStyle: CSSProperties = {
  flex: 1,
  maxWidth: 168,
  height: 56,
  borderRadius: 99,
  background: "var(--stow-accent)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontSize: 15,
  fontWeight: 800,
  boxShadow: "0 10px 22px color-mix(in srgb, var(--stow-accent) 33%, transparent)",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  whiteSpace: "nowrap"
};

const chooseDestinationStyle: CSSProperties = {
  marginTop: 4,
  width: "100%",
  border: "none",
  borderRadius: 14,
  background: "var(--stow-accent)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "12px 14px",
  fontSize: 13.5,
  fontWeight: 800,
  fontFamily: "inherit",
  cursor: "pointer"
};
