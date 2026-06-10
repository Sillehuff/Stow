import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

// One app-lifetime poller: the hook remounts on every route change, and each
// remount re-fires onRegisteredSW, so guard at module scope to avoid stacking intervals.
let updatePollStarted = false;

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration || updatePollStarted) return;
      updatePollStarted = true;
      // Long-lived installed PWAs never re-navigate; poll hourly so deploys actually reach users.
      setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    }
  });
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
