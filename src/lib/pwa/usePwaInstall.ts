import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { needRefresh, updateServiceWorker } = useRegisterSW();
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as { standalone?: boolean }).standalone === true);
  const isIos =
    typeof window !== "undefined" &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function promptInstall() {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return true;
  }

  return {
    canInstall: Boolean(deferredPrompt),
    showIosInstallHint: isIos && !isStandalone && !deferredPrompt,
    promptInstall,
    needRefresh: needRefresh[0],
    updateServiceWorker
  };
}
