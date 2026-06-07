import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Camera, ChevronRight, ImageIcon, Sparkles, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ImageRef } from "@/types/domain";
import { bestEffortDeleteImage, uploadFileToStorage } from "@/lib/firebase/storage";
import { PhotoSource } from "@/features/stow/ui/mobile/capture/PhotoSource";
import { isCameraSupported } from "@/features/stow/ui/mobile/hooks/useCamera";

export interface PhotoFieldProps {
  value: ImageRef | null;
  onChange: (next: ImageRef | null) => void;
  onScanAI?: () => void;
  uploadPath: (fileName: string) => string;
}

function nextFileName() {
  return `photo-${Date.now()}.jpg`;
}

function sameImageRef(left: ImageRef | null, right: ImageRef | null) {
  if (!left || !right) return left === right;
  if (left.storagePath || right.storagePath) return Boolean(left.storagePath && left.storagePath === right.storagePath);
  if (left.downloadUrl || right.downloadUrl) return Boolean(left.downloadUrl && left.downloadUrl === right.downloadUrl);
  return left === right;
}

export function PhotoField({ value, onChange, onScanAI, uploadPath }: PhotoFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestValueRef = useRef<ImageRef | null>(value);
  const mountedRef = useRef(false);
  const uploadRequestIdRef = useRef(0);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isCameraSupported();

  latestValueRef.current = value;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      uploadRequestIdRef.current += 1;
    };
  }, []);

  async function uploadBlob(blob: Blob) {
    const requestId = uploadRequestIdRef.current + 1;
    uploadRequestIdRef.current = requestId;
    const name = nextFileName();
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    const previous = latestValueRef.current;
    setBusy(true);
    try {
      const ref = await uploadFileToStorage(uploadPath(name), file, { contentType: file.type });
      const stillCurrentRequest = mountedRef.current && uploadRequestIdRef.current === requestId;
      const valueStillMatchesRequest = sameImageRef(latestValueRef.current, previous);

      if (!stillCurrentRequest || !valueStillMatchesRequest) {
        void bestEffortDeleteImage(ref);
        return;
      }

      onChange(ref);
      if (previous) void bestEffortDeleteImage(previous);
    } finally {
      if (mountedRef.current && uploadRequestIdRef.current === requestId) setBusy(false);
    }
  }

  function onFilePicked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadBlob(file);
  }

  function openCamera() {
    if (busy) return;
    if (supported) {
      setCameraOpen(true);
      return;
    }
    fileInputRef.current?.click();
  }

  function openLibrary() {
    if (busy) return;
    fileInputRef.current?.click();
  }

  function removePhoto() {
    if (busy) return;
    const previous = value;
    onChange(null);
    if (previous) void bestEffortDeleteImage(previous);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        {...(!supported ? { capture: "environment" as const } : {})}
        onChange={onFilePicked}
        style={{ display: "none" }}
      />

      {value?.downloadUrl ? (
        <div
          style={{
            position: "relative",
            borderRadius: "var(--stow-radius-button)",
            overflow: "hidden",
            height: 170,
            border: "1px solid var(--stow-border-l)",
            background: "var(--stow-canvas)"
          }}
        >
          <img src={value.downloadUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 72,
              background: "linear-gradient(to top, rgba(0,0,0,0.62), transparent)"
            }}
          />
          {busy ? (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                padding: "7px 11px",
                borderRadius: 99,
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)"
              }}
            >
              Uploading...
            </div>
          ) : null}
          <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", gap: 8 }}>
            <FilledControl icon={Camera} label="Retake" onClick={openCamera} disabled={busy} />
            <FilledControl icon={ImageIcon} label="Replace" onClick={openLibrary} disabled={busy} />
            <div style={{ flex: 1 }} />
            <FilledControl icon={Trash2} label="" danger onClick={removePhoto} disabled={busy} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <SourceTile icon={Camera} label={busy ? "Uploading..." : "Take Photo"} sub="Use camera" onClick={openCamera} disabled={busy} />
            <SourceTile icon={ImageIcon} label="Library" sub="Choose photo" onClick={openLibrary} disabled={busy} />
          </div>
          {onScanAI ? (
            <button
              type="button"
              onClick={onScanAI}
              disabled={busy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderRadius: "var(--stow-radius-button)",
                border: "1.5px solid color-mix(in srgb, var(--stow-accent) 27%, transparent)",
                background: "color-mix(in srgb, var(--stow-accent) 10%, transparent)",
                cursor: busy ? "default" : "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                opacity: busy ? 0.6 : 1
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--stow-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <Sparkles size={17} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--stow-ink)" }}>Scan with AI</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--stow-warm)" }}>Auto-fill name, tags and notes from a photo</div>
              </div>
              <ChevronRight size={16} color="var(--stow-accent)" />
            </button>
          ) : null}
        </div>
      )}

      {cameraOpen ? (
        <PhotoSource
          onClose={() => setCameraOpen(false)}
          onPicked={(blob) => {
            setCameraOpen(false);
            void uploadBlob(blob);
          }}
        />
      ) : null}
    </>
  );
}

function SourceTile({
  icon: Icon,
  label,
  sub,
  onClick,
  disabled
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "20px 8px",
        borderRadius: "var(--stow-radius-button)",
        border: "1.5px solid var(--stow-border)",
        background: "var(--stow-canvas)",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.6 : 1
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: "color-mix(in srgb, var(--stow-accent) 9%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Icon size={22} color="var(--stow-accent)" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--stow-ink)" }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--stow-warm)" }}>{sub}</div>
    </button>
  );
}

function FilledControl({
  icon: Icon,
  label,
  danger,
  onClick,
  disabled
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label || "Remove photo"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: label ? "9px 14px" : "9px 11px",
        borderRadius: 99,
        border: "none",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.6 : 1
      }}
    >
      <Icon size={14} color={danger ? "#FF6B6B" : "#fff"} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
