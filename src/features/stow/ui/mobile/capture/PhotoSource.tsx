import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, Check, ImageIcon, X } from "lucide-react";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";
import { useCamera } from "@/features/stow/ui/mobile/hooks/useCamera";

export interface PhotoSourceProps {
  onClose: () => void;
  onPicked: (blob: Blob) => void;
}

const DARK = "#0A0A12";

export function PhotoSource({ onClose, onPicked }: PhotoSourceProps) {
  const { capture, error, reset, start, status, stop, videoRef } = useCamera();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frozenBlobRef = useRef<Blob | null>(null);
  const frozenUrlRef = useRef<string | null>(null);
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);

  const clearFrozenPhoto = useCallback((options: { updateState?: boolean } = {}) => {
    const { updateState = true } = options;
    if (frozenUrlRef.current) {
      URL.revokeObjectURL(frozenUrlRef.current);
      frozenUrlRef.current = null;
    }
    frozenBlobRef.current = null;
    if (updateState) setFrozenUrl(null);
  }, []);

  const storeFrozenPhoto = useCallback(
    (blob: Blob) => {
      clearFrozenPhoto();
      const url = URL.createObjectURL(blob);
      frozenBlobRef.current = blob;
      frozenUrlRef.current = url;
      setFrozenUrl(url);
    },
    [clearFrozenPhoto]
  );

  useEffect(() => {
    void start();
    closeButtonRef.current?.focus();
    return () => {
      stop();
      clearFrozenPhoto({ updateState: false });
    };
  }, [clearFrozenPhoto, start, stop]);

  async function onShutter() {
    try {
      const blob = await capture();
      storeFrozenPhoto(blob);
    } catch {
      // Leave the live camera open so the user can try again or choose a file.
    }
  }

  function retake() {
    clearFrozenPhoto();
    reset();
  }

  function usePhoto() {
    if (frozenBlobRef.current) onPicked(frozenBlobRef.current);
  }

  function handleClose() {
    stop();
    clearFrozenPhoto();
    onClose();
  }

  function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPicked(file);
  }

  const frozen = status === "frozen" && Boolean(frozenUrl);
  const unavailable = status === "unsupported" || status === "error";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="New Photo"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 85,
        background: DARK,
        display: "flex",
        flexDirection: "column",
        animation: "stowUp 0.28s ease-out"
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFilePicked}
        style={{ display: "none" }}
      />

      <div
        style={{
          position: "absolute",
          top: "max(16px, env(safe-area-inset-top))",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 20px",
          zIndex: 5
        }}
      >
        <button
          ref={closeButtonRef}
          type="button"
          aria-label="Close"
          onClick={handleClose}
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
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>New Photo</div>
        <div style={{ width: 40 }} />
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
              {error ?? "Camera unavailable on this device."}
            </div>
          </div>
        ) : frozen ? (
          <img src={frozenUrl ?? undefined} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
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
                background: "radial-gradient(circle at 50% 42%, transparent 38%, rgba(0,0,0,0.5) 100%)"
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
              <CornerBrackets color="rgba(255,255,255,0.85)" />
            </div>
          </>
        )}
      </div>

      <div style={{ position: "relative", padding: "18px 24px 54px", zIndex: 5 }}>
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
              onClick={usePhoto}
              style={{
                flex: 1,
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
              <Check size={16} color="#fff" /> Use Photo
            </button>
          </div>
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
              disabled={status !== "live"}
              style={{
                width: 74,
                height: 74,
                borderRadius: 99,
                border: "5px solid rgba(255,255,255,0.35)",
                background: "#fff",
                cursor: status === "live" ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: status === "live" ? 1 : 0.6
              }}
            >
              <div style={{ width: 54, height: 54, borderRadius: 99, background: "#fff", border: `2px solid ${DARK}` }} />
            </button>
            <div style={{ width: 46, height: 46 }} />
          </div>
        )}
      </div>
    </div>
  );
}
