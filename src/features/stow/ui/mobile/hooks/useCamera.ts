import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export type CameraStatus = "idle" | "starting" | "live" | "frozen" | "error" | "unsupported";

export interface CameraController {
  videoRef: RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  supported: boolean;
  start(): Promise<void>;
  stop(): void;
  capture(): Promise<Blob>;
  reset(): void;
}

export function isCameraSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

function messageForGetUserMediaError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission denied. Allow camera access or pick a photo from your library.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No camera available. Pick a photo from your library instead.";
    case "NotReadableError":
      return "The camera is in use by another app. Close it and try again.";
    default:
      return "Couldn't start the camera. Pick a photo from your library instead.";
  }
}

async function defaultDrawToBlob(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth || 1080;
  const height = video.videoHeight || 1080;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), "image/jpeg", 0.9);
  });
  if (!blob) throw new Error("Failed to encode photo");
  return blob;
}

export interface CameraInternalState {
  status: CameraStatus;
  error: string | null;
}

export interface CameraControllerDeps {
  getState(): CameraInternalState;
  setState(patch: Partial<CameraInternalState>): void;
  getVideoEl(): HTMLVideoElement | null;
  getStream(): MediaStream | null;
  setStream(stream: MediaStream | null): void;
  requestStream(constraints: MediaStreamConstraints): Promise<MediaStream>;
  drawToBlob(video: HTMLVideoElement): Promise<Blob>;
  supported: boolean;
}

export interface InternalCameraController {
  start(): Promise<void>;
  stop(): void;
  capture(): Promise<Blob>;
  reset(): void;
}

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  video: { facingMode: "environment" },
  audio: false
};

export function createCameraController(deps: CameraControllerDeps): InternalCameraController {
  // Guards against a getUserMedia promise that resolves after stop()/unmount —
  // without this the late stream is assigned but never released (camera stays on).
  let stopped = false;

  function stopTracks() {
    const stream = deps.getStream();
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    deps.setStream(null);
  }

  async function start(): Promise<void> {
    if (!deps.supported) {
      deps.setState({ status: "unsupported", error: null });
      return;
    }
    stopped = false;
    deps.setState({ status: "starting", error: null });
    try {
      const stream = await deps.requestStream(CAMERA_CONSTRAINTS);
      if (stopped) {
        // Acquired after the caller stopped/unmounted — release immediately.
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      deps.setStream(stream);
      const video = deps.getVideoEl();
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // Some browsers reject autoplay even after the stream starts.
        }
      }
      deps.setState({ status: "live", error: null });
    } catch (error) {
      stopTracks();
      deps.setState({ status: "error", error: messageForGetUserMediaError(error) });
    }
  }

  function stop(): void {
    stopped = true;
    stopTracks();
    deps.setState({ status: "idle", error: null });
  }

  async function capture(): Promise<Blob> {
    const video = deps.getVideoEl();
    if (!video) throw new Error("Camera is not ready");
    const blob = await deps.drawToBlob(video);
    deps.setState({ status: "frozen", error: null });
    return blob;
  }

  function reset(): void {
    deps.setState({ status: "live", error: null });
  }

  return { start, stop, capture, reset };
}

export function useCamera(): CameraController {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const supportedRef = useRef<boolean>(isCameraSupported());
  const [state, setState] = useState<CameraInternalState>({ status: "idle", error: null });

  const stateRef = useRef(state);
  stateRef.current = state;

  const controllerRef = useRef<InternalCameraController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createCameraController({
      getState: () => stateRef.current,
      setState: (patch) => setState((prev) => ({ ...prev, ...patch })),
      getVideoEl: () => videoRef.current,
      getStream: () => streamRef.current,
      setStream: (stream) => {
        streamRef.current = stream;
      },
      requestStream: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      drawToBlob: defaultDrawToBlob,
      supported: supportedRef.current
    });
  }

  useEffect(() => {
    return () => {
      controllerRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => controllerRef.current!.start(), []);
  const stop = useCallback(() => controllerRef.current!.stop(), []);
  const capture = useCallback(() => controllerRef.current!.capture(), []);
  const reset = useCallback(() => controllerRef.current!.reset(), []);

  return {
    videoRef,
    status: state.status,
    error: state.error,
    supported: supportedRef.current,
    start,
    stop,
    capture,
    reset
  };
}
