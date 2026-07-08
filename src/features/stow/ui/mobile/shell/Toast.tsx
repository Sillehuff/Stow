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

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "absolute",
        bottom: message ? 110 : "auto",
        left: message ? "50%" : 0,
        top: message ? "auto" : 0,
        transform: message ? "translateX(-50%)" : "none",
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: message ? "auto" : 1,
        height: message ? "auto" : 1,
        overflow: message ? "visible" : "hidden",
        clipPath: message ? "none" : "inset(50%)",
        background: message ? "#1A1A2E" : "transparent",
        color: message ? "#fff" : "transparent",
        padding: message ? "10px 16px" : 0,
        borderRadius: message ? 99 : 0,
        maxWidth: message ? "calc(100vw - 48px)" : 1,
        fontSize: 14,
        fontWeight: 600,
        textAlign: "center",
        lineHeight: 1.3,
        boxShadow: message ? "0 8px 24px rgba(0,0,0,0.3)" : "none",
        animation: message ? "stowToast .2s ease-out" : "none"
      }}
    >
      {message ? <Check size={16} color="var(--stow-accent)" style={{ flexShrink: 0 }} /> : null}
      {message}
    </div>
  );
}
