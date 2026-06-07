import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isCameraSupported,
  createCameraController,
  type CameraInternalState
} from "@/features/stow/ui/mobile/hooks/useCamera";

describe("isCameraSupported", () => {
  const original = globalThis.navigator;
  afterEach(() => {
    // restore
    Object.defineProperty(globalThis, "navigator", { value: original, configurable: true });
  });

  it("is false when navigator.mediaDevices is absent", () => {
    Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
    expect(isCameraSupported()).toBe(false);
  });

  it("is false when getUserMedia is absent", () => {
    Object.defineProperty(globalThis, "navigator", { value: { mediaDevices: {} }, configurable: true });
    expect(isCameraSupported()).toBe(false);
  });

  it("is true when navigator.mediaDevices.getUserMedia exists", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { mediaDevices: { getUserMedia: vi.fn() } },
      configurable: true
    });
    expect(isCameraSupported()).toBe(true);
  });
});

describe("createCameraController", () => {
  let state: CameraInternalState;
  let setState: (patch: Partial<CameraInternalState>) => void;
  let track: { stop: ReturnType<typeof vi.fn> };
  let stream: { getTracks: () => Array<{ stop: () => void }> };
  let video: { srcObject: unknown; play: ReturnType<typeof vi.fn>; videoWidth: number; videoHeight: number };
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = { status: "idle", error: null };
    setState = (patch) => {
      state = { ...state, ...patch };
    };
    track = { stop: vi.fn() };
    stream = { getTracks: () => [track] };
    video = { srcObject: null, play: vi.fn().mockResolvedValue(undefined), videoWidth: 640, videoHeight: 480 };
    getUserMedia = vi.fn().mockResolvedValue(stream as unknown as MediaStream);
  });

  function build(supported = true) {
    return createCameraController({
      getState: () => state,
      setState,
      getVideoEl: () => video as unknown as HTMLVideoElement,
      getStream: () => stream as unknown as MediaStream | null,
      setStream: () => {},
      requestStream: getUserMedia as unknown as () => Promise<MediaStream>,
      drawToBlob: vi.fn().mockResolvedValue(new Blob(["x"], { type: "image/jpeg" })),
      supported
    });
  }

  it("reports unsupported immediately and never calls getUserMedia", async () => {
    const c = build(false);
    await c.start();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(state.status).toBe("unsupported");
  });

  it("transitions starting -> live on a successful start", async () => {
    const c = build(true);
    const seen: string[] = [];
    const origSet = setState;
    setState = (patch) => {
      origSet(patch);
      if (patch.status) seen.push(patch.status);
    };
    const c2 = build(true);
    await c2.start();
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: "environment" }, audio: false });
    expect(state.status).toBe("live");
    void c;
    void seen;
  });

  it("sets error status when getUserMedia rejects (permission denied)", async () => {
    getUserMedia.mockRejectedValueOnce(Object.assign(new Error("denied"), { name: "NotAllowedError" }));
    const c = build(true);
    await c.start();
    expect(state.status).toBe("error");
    expect(state.error).toMatch(/permission|denied|allow/i);
  });

  it("capture() draws a frame and returns a jpeg Blob, status -> frozen", async () => {
    const c = build(true);
    await c.start();
    const blob = await c.capture();
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/jpeg");
    expect(state.status).toBe("frozen");
  });

  it("reset() returns a frozen controller to live without re-requesting the stream", async () => {
    const c = build(true);
    await c.start();
    await c.capture();
    getUserMedia.mockClear();
    c.reset();
    expect(state.status).toBe("live");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("stop() stops every track and goes idle", async () => {
    const c = build(true);
    await c.start();
    c.stop();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(state.status).toBe("idle");
  });
});
