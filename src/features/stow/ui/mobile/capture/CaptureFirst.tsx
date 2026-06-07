import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ArrowRight, Camera, ImageIcon, Sparkles, X } from "lucide-react";
import type { ImageRef } from "@/types/domain";
import type { VisionSuggestion } from "@/types/llm";
import { inventoryRepository } from "@/features/stow/services/repository";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";
import { useCamera } from "@/features/stow/ui/mobile/hooks/useCamera";
import { visionCategorizeItemImage } from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
import { bestEffortDeleteImage, uploadFileToStorage } from "@/lib/firebase/storage";

export interface CaptureFirstProps {
  householdId: string;
  spaceId?: string | null;
  areaId?: string | null;
  onClose: () => void;
  onCreated: (itemId: string) => void;
  onOpenDetails: (payload: {
    image?: ImageRef;
    aiFilled: boolean;
    suggestion?: VisionSuggestion;
    spaceId?: string | null;
    areaId?: string | null;
  }) => void;
}

type Phase = "live" | "frozen" | "uploading" | "identifying";

const DARK = "#0A0A12";

function nextFileName() {
  return `photo-${Date.now()}.jpg`;
}

export function CaptureFirst({
  householdId,
  spaceId = null,
  areaId = null,
  onClose,
  onOpenDetails
}: CaptureFirstProps) {
  const { capture, error: cameraError, reset, start, status, stop, videoRef } = useCamera();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frozenBlobRef = useRef<Blob | null>(null);
  const frozenUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const cancelledRef = useRef(false);
  const [mode, setMode] = useState<"photo" | "ai">("photo");
  const [phase, setPhase] = useState<Phase>("live");
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draftId = useMemo(() => inventoryRepository.createItemDraftId(householdId), [householdId]);

  const clearFrozenPhoto = useCallback((options: { updateState?: boolean } = {}) => {
    const { updateState = true } = options;
    if (frozenUrlRef.current) {
      URL.revokeObjectURL(frozenUrlRef.current);
      frozenUrlRef.current = null;
    }
    frozenBlobRef.current = null;
    if (updateState) setFrozenUrl(null);
  }, []);

  const close = useCallback(() => {
    cancelledRef.current = true;
    stop();
    clearFrozenPhoto();
    onClose();
  }, [clearFrozenPhoto, onClose, stop]);

  const skipToDetails = useCallback(() => {
    cancelledRef.current = true;
    stop();
    clearFrozenPhoto();
    onOpenDetails({ aiFilled: false, spaceId, areaId });
  }, [areaId, clearFrozenPhoto, onOpenDetails, spaceId, stop]);

  useEffect(() => {
    mountedRef.current = true;
    cancelledRef.current = false;
    void start();
    closeButtonRef.current?.focus();
    return () => {
      mountedRef.current = false;
      cancelledRef.current = true;
      stop();
      clearFrozenPhoto({ updateState: false });
    };
  }, [clearFrozenPhoto, start, stop]);

  async function onShutter() {
    if (status !== "live") return;
    setError(null);
    try {
      const blob = await capture();
      clearFrozenPhoto();
      const url = URL.createObjectURL(blob);
      frozenBlobRef.current = blob;
      frozenUrlRef.current = url;
      setFrozenUrl(url);
      setPhase("frozen");
    } catch {
      setError("Couldn't capture. Try again or choose from your library.");
    }
  }

  function retake() {
    clearFrozenPhoto();
    setError(null);
    setPhase("live");
    reset();
  }

  async function handOff(image: ImageRef, suggestion?: VisionSuggestion) {
    if (!mountedRef.current || cancelledRef.current) {
      await bestEffortDeleteImage(image);
      return;
    }
    stop();
    clearFrozenPhoto();
    onOpenDetails({ image, aiFilled: Boolean(suggestion), suggestion, spaceId, areaId });
  }

  async function handleBlob(blob: Blob) {
    setError(null);
    setPhase("uploading");
    const name = nextFileName();
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    let image: ImageRef;

    try {
      image = await uploadFileToStorage(storagePaths.draftImage(householdId, draftId, name), file, {
        contentType: file.type
      });
    } catch {
      if (!mountedRef.current || cancelledRef.current) return;
      setError("Upload failed. Check your connection and try again.");
      setPhase(frozenBlobRef.current ? "frozen" : "live");
      return;
    }

    if (mode === "photo") {
      await handOff(image);
      return;
    }

    if (!image.storagePath) {
      await handOff(image);
      return;
    }

    setPhase("identifying");
    try {
      const response = await visionCategorizeItemImage({
        householdId,
        imageRef: { storagePath: image.storagePath },
        context: {
          spaceId: spaceId ?? undefined,
          areaId: areaId ?? undefined
        }
      });
      await handOff(image, response.suggestion);
    } catch {
      await handOff(image);
    }
  }

  function useFrozen() {
    if (frozenBlobRef.current) void handleBlob(frozenBlobRef.current);
  }

  function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleBlob(file);
  }

  const ai = mode === "ai";
  const busy = phase === "uploading" || phase === "identifying";
  const frozen = phase === "frozen" && Boolean(frozenUrl);
  const unavailable = status === "unsupported" || status === "error";
  const live = status === "live" && !busy;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New Item"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 85,
        background: DARK,
        display: "flex",
        flexDirection: "column",
        animation: "stowUp 0.3s ease-out"
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFilePicked}
        style={{ display: "none" }}
      />

      <div
        style={{
          position: "absolute",
          top: 52,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 18px",
          zIndex: 6
        }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close"
          onClick={close}
          style={{
            width: 40,
            height: 40,
            borderRadius: 99,
            background: "rgba(255,255,255,0.15)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)"
          }}
        >
          <X size={18} color="#fff" />
        </button>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 800 }}>New Item</div>
        {!frozen && !busy ? (
          <button
            type="button"
            onClick={skipToDetails}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "8px 4px"
            }}
          >
            Skip
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {unavailable ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: 32,
              textAlign: "center"
            }}
          >
            <Camera size={40} color="rgba(255,255,255,0.5)" />
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, maxWidth: 280 }}>
              {cameraError ?? "Camera unavailable on this device."}
            </div>
          </div>
        ) : frozen ? (
          <img
            src={frozenUrl ?? undefined}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at 50% 44%, transparent 36%, rgba(0,0,0,0.55) 100%)"
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: 244,
                height: 244
              }}
            >
              <CornerBrackets color={ai ? "var(--stow-accent)" : "rgba(255,255,255,0.85)"} />
            </div>
            <div
              style={{
                position: "absolute",
                top: "calc(50% + 142px)",
                left: 0,
                right: 0,
                padding: "0 24px",
                textAlign: "center",
                color: "rgba(255,255,255,0.78)",
                fontSize: 13,
                fontWeight: 600
              }}
            >
              {ai ? "Frame the item — Stow will name and tag it" : "Center your item in the frame"}
            </div>
          </>
        )}

        {phase === "identifying" ? (
          <>
            <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,18,0.4)" }} />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: 244,
                height: 244,
                borderRadius: 20
              }}
            >
              <CornerBrackets color="var(--stow-accent)" />
              <div
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  height: 3,
                  borderRadius: 99,
                  background: "var(--stow-accent)",
                  boxShadow: "0 0 16px var(--stow-accent)",
                  animation: "stowScan 1.4s ease-in-out infinite"
                }}
              />
            </div>
          </>
        ) : null}
      </div>

      <div style={{ position: "relative", padding: "16px 24px 50px", zIndex: 5 }}>
        {error ? (
          <p style={{ textAlign: "center", color: "#FF6B6B", fontSize: 13, fontWeight: 600, margin: "0 0 12px" }}>
            {error}
          </p>
        ) : null}

        {busy ? (
          <div style={{ textAlign: "center", color: "#fff", minHeight: 80 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              {phase === "identifying" ? "Reading photo..." : "Saving photo..."}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              {phase === "identifying" ? "Naming and tagging" : "Uploading"}
            </div>
          </div>
        ) : frozen ? (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={retake}
              style={{
                flex: 1,
                padding: "15px 0",
                borderRadius: 16,
                border: "1.5px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              Retake
            </button>
            <button
              type="button"
              onClick={useFrozen}
              style={{
                flex: 1.4,
                padding: "15px 0",
                borderRadius: 16,
                border: "none",
                background: "var(--stow-accent)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              {ai ? (
                <>
                  <Sparkles size={16} color="#fff" /> Use and Identify
                </>
              ) : (
                <>
                  <ArrowRight size={16} color="#fff" /> Use Photo
                </>
              )}
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 4,
                background: "rgba(255,255,255,0.12)",
                borderRadius: 99,
                padding: 4,
                width: "fit-content",
                margin: "0 auto 20px"
              }}
            >
              {[
                { key: "photo" as const, label: "Photo", Icon: Camera },
                { key: "ai" as const, label: "AI Scan", Icon: Sparkles }
              ].map(({ key, label, Icon }) => {
                const selected = mode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 18px",
                      borderRadius: 99,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 800,
                      color: selected ? "#fff" : "rgba(255,255,255,0.6)",
                      background: selected
                        ? key === "ai"
                          ? "var(--stow-accent)"
                          : "rgba(255,255,255,0.22)"
                        : "transparent"
                    }}
                  >
                    <Icon size={14} color={selected ? "#fff" : "rgba(255,255,255,0.6)"} /> {label}
                  </button>
                );
              })}
            </div>

            {unavailable ? (
              <button
                type="button"
                aria-label="Choose from library"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: "100%",
                  padding: "15px 0",
                  borderRadius: 16,
                  border: "none",
                  background: "var(--stow-accent)",
                  color: "#fff",
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8
                }}
              >
                <ImageIcon size={16} color="#fff" /> Choose from library
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <button
                  type="button"
                  aria-label="Choose from library"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    border: "2px solid rgba(255,255,255,0.5)",
                    padding: 0,
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <ImageIcon size={20} color="rgba(255,255,255,0.85)" />
                </button>
                <button
                  type="button"
                  aria-label="Capture"
                  onClick={onShutter}
                  disabled={!live}
                  style={{
                    width: 74,
                    height: 74,
                    borderRadius: 99,
                    border: "5px solid rgba(255,255,255,0.35)",
                    background: "#fff",
                    cursor: live ? "pointer" : "default",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: live ? 1 : 0.6
                  }}
                >
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 99,
                      background: ai ? "var(--stow-accent)" : "#fff",
                      border: ai ? "none" : `2px solid ${DARK}`
                    }}
                  />
                </button>
                <div style={{ width: 46, height: 46 }} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
