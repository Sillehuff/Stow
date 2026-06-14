import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { QrCode, X } from "lucide-react";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";
import { parseScannedStowTarget } from "@/features/stow/ui/mobile/capture/qr";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { useCamera } from "@/features/stow/ui/mobile/hooks/useCamera";

export interface QrScanOverlayProps {
  onClose: () => void;
  onOpenPath: (path: string) => void;
  onFlash: (message: string) => void;
}

const DARK = "#0A0A12";
// Cap decode resolution: jsQR on a full 1080p frame is wasteful and drains battery.
const MAX_DECODE_WIDTH = 640;

interface FrameDecoder {
  decode(video: HTMLVideoElement): Promise<string | null>;
}

/** Native BarcodeDetector where available (Android/Chrome), jsQR everywhere else (iPhone/Safari). */
function createDecoder(): FrameDecoder {
  const BD = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  let native = BD ? new BD({ formats: ["qr_code"] }) : null;
  let canvas: HTMLCanvasElement | null = null;

  return {
    async decode(video) {
      if (native) {
        try {
          const codes = await native.detect(video);
          return codes[0]?.rawValue ?? null;
        } catch {
          // Some browsers expose the constructor but throw on detect — drop to jsQR for good.
          native = null;
        }
      }
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const scale = Math.min(1, MAX_DECODE_WIDTH / vw);
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      if (!canvas) canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      return jsQR(image.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
    }
  };
}

export function QrScanOverlay({ onClose, onOpenPath, onFlash }: QrScanOverlayProps) {
  const { error, start, status, stop, videoRef } = useCamera();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState("");

  // Keep the latest callbacks in refs so the rAF decode loop never restarts on re-render.
  const onCloseRef = useRef(onClose);
  const onOpenPathRef = useRef(onOpenPath);
  const onFlashRef = useRef(onFlash);
  useEffect(() => {
    onCloseRef.current = onClose;
    onOpenPathRef.current = onOpenPath;
    onFlashRef.current = onFlash;
  });

  useEffect(() => {
    void start();
    closeButtonRef.current?.focus();
    return () => stop();
  }, [start, stop]);

  // Live decode loop: runs only while the camera is live, navigates on the first Stow match.
  useEffect(() => {
    if (status !== "live") return;
    const decoder = createDecoder();
    let raf = 0;
    let busy = false;
    let handled = false;
    let lastFlash = 0;

    function navigate(raw: string) {
      const result = parseScannedStowTarget(raw, window.location.origin);
      if (!result.ok) {
        const now = performance.now();
        if (now - lastFlash > 2500) {
          lastFlash = now;
          onFlashRef.current("That's not a Stow QR label");
        }
        return;
      }
      handled = true;
      stop();
      onCloseRef.current();
      onOpenPathRef.current(result.path);
    }

    function tick() {
      raf = requestAnimationFrame(tick);
      if (handled || busy) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      busy = true;
      decoder
        .decode(video)
        .then((raw) => {
          if (raw && !handled) navigate(raw);
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, stop, videoRef]);

  function handleClose() {
    stop();
    onClose();
  }

  function openPastedTarget() {
    const result = parseScannedStowTarget(value, window.location.origin);
    if (!result.ok) {
      onFlash(result.reason === "empty" ? "Paste or scan a Stow QR link" : "Use a Stow QR link for this app");
      return;
    }
    setValue("");
    stop();
    onClose();
    onOpenPath(result.path);
  }

  const unavailable = status === "unsupported" || status === "error";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Scan QR label"
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
          <QrCode size={14} color="var(--stow-accent)" /> Scan QR
        </div>
        <div style={{ width: 40 }} />
      </div>

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
            objectFit: "cover",
            zIndex: 0
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 150,
          background: "linear-gradient(to bottom, rgba(10,10,18,0.6), transparent)",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 220,
          background: "linear-gradient(to top, rgba(10,10,18,0.85) 24%, rgba(10,10,18,0.4) 60%, transparent)",
          zIndex: 1,
          pointerEvents: "none"
        }}
      />

      {unavailable ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
            padding: "0 28px",
            zIndex: 2
          }}
        >
          <div style={{ textAlign: "center", color: "#fff", fontSize: 17, fontWeight: 800 }}>Camera unavailable</div>
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 4 }}>
            {error ?? "Paste a Stow QR link to open its space."}
          </div>
          <Field label="QR link or space id" value={value} onChange={setValue} placeholder="/spaces/..." />
          <Button variant="primary" onClick={openPastedTarget}>
            Open QR Link
          </Button>
        </div>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              pointerEvents: "none"
            }}
          >
            <div style={{ position: "relative", width: 260, height: 260 }}>
              <CornerBrackets color="var(--stow-accent)" />
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "0 24px max(40px, env(safe-area-inset-bottom))",
              textAlign: "center",
              zIndex: 3
            }}
          >
            <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>Scan a Stow QR label</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13 }}>
              Point your camera at the label to jump to its space
            </div>
          </div>
        </>
      )}
    </div>
  );
}
