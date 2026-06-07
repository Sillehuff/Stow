import { useEffect, useState } from "react";
import type { SpaceWithAreas } from "@/types/domain";
import { generateSpaceQrDataUrl, spaceQrUrl } from "@/features/stow/ui/mobile/capture/qr";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

interface SpaceQrSheetProps {
  open: boolean;
  space: SpaceWithAreas | null;
  onClose: () => void;
  onFlash: (message: string) => void;
}

export function SpaceQrSheet({ open, space, onClose, onFlash }: SpaceQrSheetProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = space ? spaceQrUrl(origin, space.id) : "";

  useEffect(() => {
    if (!open || !space || !url) {
      setDataUrl(null);
      return;
    }

    let cancelled = false;
    setDataUrl(null);
    void generateSpaceQrDataUrl(url)
      .then((value) => {
        if (!cancelled) setDataUrl(value);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [open, space, url]);

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      onFlash("Space link copied");
    } catch {
      onFlash("Couldn't copy link");
    }
  }

  async function shareLink() {
    if (!url) return;
    try {
      if (!navigator.share) {
        await copyLink();
        return;
      }
      await navigator.share({ title: "Stow space link", url });
    } catch {
      // User cancellation is fine.
    }
  }

  function downloadPng() {
    if (!dataUrl || !space) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = `stow-space-${space.id}.png`;
    anchor.click();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`${space?.name ?? "Space"} - QR label`}>
      <div style={{ display: "grid", gap: 16, placeItems: "center", paddingBottom: 8 }}>
        <div
          style={{
            width: 240,
            height: 240,
            display: "grid",
            placeItems: "center",
            background: "var(--stow-surface)",
            borderRadius: "var(--stow-radius-card)",
            border: "1px solid var(--stow-border-l)"
          }}
        >
          {dataUrl && space ? (
            <img src={dataUrl} alt={`QR code for ${space.name}`} width={220} height={220} />
          ) : (
            <span style={{ color: "var(--stow-ink-muted)", fontSize: 14 }}>Generating QR...</span>
          )}
        </div>
        <p
          style={{
            margin: 0,
            color: "var(--stow-ink-muted)",
            fontSize: 13,
            wordBreak: "break-all",
            textAlign: "center"
          }}
        >
          {url}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, width: "100%" }}>
          <Button variant="neutral" onClick={() => void copyLink()}>
            Copy
          </Button>
          <Button variant="neutral" onClick={() => void shareLink()}>
            Share
          </Button>
          <Button variant="neutral" disabled={!dataUrl} onClick={downloadPng}>
            PNG
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
