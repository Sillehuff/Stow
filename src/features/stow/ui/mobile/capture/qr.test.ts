import { describe, expect, it } from "vitest";
import { parseScannedStowTarget, spaceQrUrl } from "@/features/stow/ui/mobile/capture/qr";

describe("spaceQrUrl", () => {
  it("builds the canonical space deep link from an origin + space id", () => {
    expect(spaceQrUrl("https://stow.app", "s1")).toBe("https://stow.app/spaces/s1");
    expect(spaceQrUrl("https://stow.app/", "s1")).toBe("https://stow.app/spaces/s1");
  });
});

describe("parseScannedStowTarget", () => {
  const origin = "https://stow.app";

  it("returns the path+search for a same-origin absolute Stow link", () => {
    expect(parseScannedStowTarget("https://stow.app/spaces/s1", origin)).toEqual({
      ok: true,
      path: "/spaces/s1"
    });
    expect(parseScannedStowTarget("https://stow.app/items/i1?from=search", origin)).toEqual({
      ok: true,
      path: "/items/i1?from=search"
    });
  });

  it("resolves a relative path against the origin", () => {
    expect(parseScannedStowTarget("/spaces/s1", origin)).toEqual({ ok: true, path: "/spaces/s1" });
  });

  it("rejects a cross-origin link", () => {
    expect(parseScannedStowTarget("https://evil.example/spaces/s1", origin)).toEqual({
      ok: false,
      reason: "cross-origin"
    });
    expect(parseScannedStowTarget("//evil.example/spaces/s1", origin)).toEqual({
      ok: false,
      reason: "cross-origin"
    });
  });

  it("rejects empty input", () => {
    expect(parseScannedStowTarget("   ", origin)).toEqual({ ok: false, reason: "empty" });
  });

  it("falls back to a space deep link for a bare id that is not a URL", () => {
    expect(parseScannedStowTarget("s1", origin)).toEqual({ ok: true, path: "/spaces/s1" });
    expect(parseScannedStowTarget("a b", origin)).toEqual({ ok: true, path: "/spaces/a%20b" });
  });
});
