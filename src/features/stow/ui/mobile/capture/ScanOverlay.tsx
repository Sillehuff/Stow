import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Grid, ImageIcon, ScanLine, Sparkles, X } from "lucide-react";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";
import { useCamera } from "@/features/stow/ui/mobile/hooks/useCamera";

export interface ScanOverlayProps {
  onClose: () => void;
  onCaptureSingle: (blob: Blob) => void;
  onCaptureShelf?: (blob: Blob) => void;
  onScanQr?: () => void;
}

const DARK = "#0A0A12";

export function ScanOverlay({ onClose, onCaptureSingle, onCaptureShelf, onScanQr }: ScanOverlayProps) {
  const { capture, error, start, status, stop, videoRef } = useCamera();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"single" | "shelf">("single");

  useEffect(() => {
    void start();
    closeButtonRef.current?.focus();
    return () => stop();
  }, [start, stop]);

  async function onShutter() {
    if (status !== "live" || busy) return;
    setBusy(true);
    try {
      const blob = await capture();
      if (mode === "shelf" && onCaptureShelf) onCaptureShelf(blob);
      else onCaptureSingle(blob);
    } catch {
      // Leave the overlay open so the user can retry or choose a file.
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    stop();
    onClose();
  }

  function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (mode === "shelf" && onCaptureShelf) onCaptureShelf(file);
    else onCaptureSingle(file);
  }

  const unavailable = status === "unsupported" || status === "error";
  const live = status === "live" && !busy;
  const shelfEnabled = Boolean(onCaptureShelf);
  const shelfMode = mode === "shelf" && shelfEnabled;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Scan"
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
          padding: "0 20px",
          zIndex: 3
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            background: "rgba(255,255,255,0.12)",
            padding: "8px 14px",
            borderRadius: 99
          }}
        >
          <Sparkles size={14} color="var(--stow-accent)" /> AI Scan
        </div>
        <div style={{ width: 40 }} />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {!unavailable ? (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover"
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 45%, rgba(40,40,60,0.6), #0A0A12 70%)"
          }}
        />
        <div style={{ position: "relative", width: 250, height: 250, borderRadius: 28 }}>
          <CornerBrackets color="var(--stow-accent)" />
          {live ? (
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
          ) : null}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <ScanLine size={40} color="rgba(255,255,255,0.25)" />
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 60px", textAlign: "center", position: "relative", zIndex: 3 }}>
        <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
          {unavailable ? "Camera unavailable" : busy ? "Scanning photo" : shelfMode ? "Point at a shelf" : "Point at an item"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 22 }}>
          {unavailable
            ? error ?? "Pick a photo from your library to scan."
            : shelfMode
              ? "Stow will find everything in the frame"
              : "Stow will name and tag it for you"}
        </div>

        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 99,
            padding: 4,
            width: "fit-content",
            margin: onScanQr ? "0 auto 10px" : "0 auto 22px"
          }}
        >
          <button
            type="button"
            aria-pressed={mode === "single"}
            onClick={() => setMode("single")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 800,
              color: mode === "single" ? "#fff" : "rgba(255,255,255,0.72)",
              background: mode === "single" ? "var(--stow-accent)" : "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            <ScanLine size={14} color={mode === "single" ? "#fff" : "rgba(255,255,255,0.72)"} /> One item
          </button>
          <button
            type="button"
            aria-pressed={shelfMode}
            disabled={!shelfEnabled}
            title={shelfEnabled ? undefined : "Coming in P3"}
            onClick={() => {
              if (shelfEnabled) setMode("shelf");
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 800,
              color: shelfMode ? "#fff" : shelfEnabled ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.4)",
              background: shelfMode ? "var(--stow-accent)" : "transparent",
              border: "none",
              cursor: shelfEnabled ? "pointer" : "not-allowed",
              fontFamily: "inherit"
            }}
          >
            <Grid size={14} color={shelfMode ? "#fff" : shelfEnabled ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.4)"} />
            Whole shelf
          </button>
        </div>

        {onScanQr ? (
          <button
            type="button"
            onClick={onScanQr}
            style={{
              margin: "0 auto 22px",
              background: "none",
              border: "none",
              color: "#fff",
              opacity: 0.85,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            Scan a Stow QR label
          </button>
        ) : null}

        {unavailable ? (
          <button
            type="button"
            aria-label="Choose from library"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "14px 22px",
              borderRadius: 99,
              border: "none",
              background: "#fff",
              color: DARK,
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <ImageIcon size={16} color={DARK} /> Choose from library
          </button>
        ) : (
          <button
            type="button"
            aria-label="Scan"
            onClick={onShutter}
            disabled={!live}
            style={{
              width: 76,
              height: 76,
              borderRadius: 99,
              margin: "0 auto",
              border: "5px solid rgba(255,255,255,0.3)",
              background: live ? "#fff" : "var(--stow-warm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: live ? "pointer" : "default",
              opacity: live ? 1 : 0.65
            }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                borderRadius: 99,
                background: live ? "var(--stow-accent)" : "var(--stow-warm)"
              }}
            />
          </button>
        )}
      </div>
    </div>
  );
}
