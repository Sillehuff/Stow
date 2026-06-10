import { useState } from "react";
import { parseScannedStowTarget } from "@/features/stow/ui/mobile/capture/qr";
import { Button } from "@/features/stow/ui/mobile/components/Button";
import { Field } from "@/features/stow/ui/mobile/components/Field";
import { Sheet } from "@/features/stow/ui/mobile/shell/Sheet";

interface ScanQrSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenPath: (path: string) => void;
  onFlash: (message: string) => void;
}

export function ScanQrSheet({ open, onClose, onOpenPath, onFlash }: ScanQrSheetProps) {
  const [value, setValue] = useState("");

  function openTarget() {
    const origin = typeof window === "undefined" ? "" : window.location.origin;
    const result = parseScannedStowTarget(value, origin);
    if (!result.ok) {
      onFlash(result.reason === "empty" ? "Paste or scan a Stow QR link" : "Use a Stow QR link for this app");
      return;
    }
    setValue("");
    onClose();
    onOpenPath(result.path);
  }

  return (
    <Sheet open={open} onClose={onClose} title="Scan QR label">
      <div style={{ display: "grid", gap: 14 }}>
        <Field label="QR link or space id" value={value} onChange={setValue} placeholder="/spaces/..." />
        <Button variant="primary" onClick={openTarget}>
          Open QR Link
        </Button>
      </div>
    </Sheet>
  );
}
