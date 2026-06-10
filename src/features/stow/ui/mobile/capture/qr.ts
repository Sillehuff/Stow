type QrCodeModule = typeof import("qrcode");

let qrCodeModulePromise: Promise<QrCodeModule> | null = null;

function loadQrCodeModule(): Promise<QrCodeModule> {
  if (!qrCodeModulePromise) qrCodeModulePromise = import("qrcode");
  return qrCodeModulePromise;
}

export function spaceQrUrl(origin: string, spaceId: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/spaces/${spaceId}`;
}

export type ScannedTarget =
  | { ok: true; path: string }
  | { ok: false; reason: "empty" | "cross-origin" };

export function parseScannedStowTarget(raw: string, origin: string): ScannedTarget {
  const value = raw.trim();
  if (!value) return { ok: false, reason: "empty" };

  try {
    const appOrigin = new URL(origin).origin;

    if (value.startsWith("/")) {
      const url = new URL(value, appOrigin);
      if (url.origin !== appOrigin) return { ok: false, reason: "cross-origin" };
      return { ok: true, path: `${url.pathname}${url.search}` };
    }

    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      if (url.origin !== appOrigin) return { ok: false, reason: "cross-origin" };
      return { ok: true, path: `${url.pathname}${url.search}` };
    }
  } catch {
    return { ok: true, path: `/spaces/${encodeURIComponent(value)}` };
  }

  return { ok: true, path: `/spaces/${encodeURIComponent(value)}` };
}

export function generateSpaceQrDataUrl(url: string): Promise<string> {
  return loadQrCodeModule().then((module) =>
    module.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: "#1A1A2E", light: "#FFFFFF" }
    })
  );
}
