import { useEffect, useRef } from "react";
import { Check } from "@/features/stow/ui/mobile/theme/icons";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  // Keep onDone in a ref so the auto-dismiss window starts once per message and is not
  // restarted every time the parent re-renders (which it does on every live-data tick).
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => onDoneRef.current(), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message) return null;
  return (
    <div
      role="status"
      style={{
        position: "absolute",
        bottom: 110,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#1A1A2E",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: 99,
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
        animation: "stowToast .2s ease-out"
      }}
    >
      <Check size={16} color="var(--stow-accent)" />
      {message}
    </div>
  );
}
