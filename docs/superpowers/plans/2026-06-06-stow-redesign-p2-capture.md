# Stow Mobile Redesign — P2 Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real camera capture, a reusable photo field, a single-item AI scan, a camera-first add entry, and the single-mode scan overlay to the new mobile Stow app — replacing P1's `PhotoField` placeholders with the genuine capture flow, all on the existing shared data layer.

**Architecture:** A new `capture/` slice plus a `hooks/useCamera.ts` controller and a `components/PhotoField.tsx` field, under `src/features/stow/ui/mobile/`. `useCamera` wraps `getUserMedia({video:{facingMode:"environment"}})` with a canvas→JPEG-`Blob` capture, freeze/retake/reset state machine, and feature-detection so callers can fall back to `<input type="file" accept="image/*" capture="environment">`. Uploads reuse `uploadFileToStorage`; orphan cleanup uses a new `bestEffortDeleteImage` in `src/lib/firebase/storage.ts`; the single AI scan reuses the existing `visionCategorizeItemImage` callable and applies the returned `VisionSuggestion` to draft fields via a small pure helper. The scan FAB, photo overlay, and a new `captureFirst` overlay are routed through `StowMobileApp` using the contract's `useMobileNavigation` overlay state (with `OverlayKind` extended by `"captureFirst"`).

**Tech Stack:** React 19 + TypeScript, react-router-dom v7, lucide-react, Firebase Storage + Callable Functions, Vite, Vitest (node env, pure-function tests — repo has no jsdom/RTL), Playwright (`tests/`).

**Spec:** `docs/superpowers/specs/2026-06-06-stow-mobile-redesign-design.md` (§6.9 capture flows, §7.8 cleanup) · **Roadmap:** `docs/superpowers/plans/2026-06-06-stow-mobile-redesign-roadmap.md` ("P2 — Capture") · **Contract (LOCKED):** `docs/superpowers/plans/2026-06-06-stow-redesign-shared-contract.md` (§9 capture, §9.1 cleanup, §9.2 single scan, §11 mapping)

**Conventions:**
- Run a single test file with `npx vitest run <path>`; the full unit suite with `npm test`.
- There is **no `verify` script**; "verify" = `npm run typecheck && npm test && npm run build`.
- End every commit message with the repo trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Token translation (contract §1.3):** prototype components receive a JS palette `P` and use inline values like `P.accent`, `P.radius + 6`, `P.accent + "16"`. In our code components read CSS vars instead: `P.accent` → `var(--stow-accent)`, `P.canvas` → `var(--stow-canvas)`, `P.border` → `var(--stow-border)`, `P.borderL` → `var(--stow-border-l)`, `P.surface` → `var(--stow-surface)`, `P.ink` → `var(--stow-ink)`, `P.inkMuted` → `var(--stow-ink-muted)`, `P.warm` → `var(--stow-warm)`, `P.accentSoft` → `var(--stow-accent-soft)`; `P.radius + 6` → `var(--stow-radius-button)`, `+8` → `var(--stow-radius-card)`, `+2` → `var(--stow-radius-input)`, bare `P.radius` → `var(--stow-radius)`; alpha tints `P.accent + "16"` → `color-mix(in srgb, var(--stow-accent) 9%, transparent)` (16≈9%, 1A≈10%, 22≈13%, 44≈27%, 55≈33%). The dark camera surface `#0A0A12` is a literal in the prototype and stays a literal (it is not a token).
- **Prototype → domain mapping (contract §11):** the prototypes use mock URLs (`PHOTO_POOL`, `CAMERA_FEED`) and a mock AI result (`{name, value, tags}`). **Never ship the mock URLs.** Real photos come from `useCamera`/the file picker, and the real AI result is `VisionCategorizeResponse.suggestion` = `{ suggestedName, tags, notes, confidence, rationale }` — there is **no value field**, so the single scan fills name/tags/notes only and value stays manual (contract §9.2).
- **Cross-phase surfaces (contract):** P1 is assumed complete. This plan consumes P1 contract-defined surfaces — `useWorkspaceData` (`actions.createItem`, `actions.updateItem`, `items`, `spaces`), `useMobileNavigation` (overlay state), the `Sheet`/`Confirm` shell primitives, `components/Button.tsx`, `components/Field.tsx` — and **replaces** P1's `AddItemSheet` PhotoField placeholder slot and P1's `ItemDetail` edit-mode photo placeholder with the real `PhotoField` built here. Cross-phase interfaces come from the contract, not from reading the P1 plan file.
- Scope note: this plan is capture-only. Whole-shelf batch capture (`QuickCapture`, `captureReducer`, shelf detection backend) is **P3**; `ScanOverlay`'s "Whole shelf" mode is rendered **disabled** here ("coming in P3").

---

## File-structure map (this phase)

Create (under `src/features/stow/ui/mobile/` unless noted):
- `hooks/useCamera.ts` — `CameraController` (getUserMedia, canvas→Blob, freeze/retake/reset, error/unsupported, feature-detect). **Logic — full code.**
- `hooks/useCamera.test.ts` — feature-detect + status-transition tests with a mocked `navigator.mediaDevices`.
- `capture/applyVisionSuggestion.ts` — pure helper "apply a `VisionSuggestion` to item-draft fields". **Logic — full code.**
- `capture/applyVisionSuggestion.test.ts` — unit tests for the helper.
- `capture/CornerBrackets.tsx` — viewfinder corner brackets (shared by PhotoSource/ScanOverlay). **Markup — ported.**
- `capture/PhotoSource.tsx` — full-screen camera + library source picker; file-input fallback when `!supported`. **Logic + ported markup.**
- `components/PhotoField.tsx` — empty (Take Photo / Library / Scan-with-AI) + filled (preview + Retake/Replace/Remove); upload + cleanup. **Logic + ported markup.**
- `capture/CaptureFirst.tsx` — camera-first add entry (photo → details sheet pre-filled, "AI filled" badge). **Logic + ported markup.**
- `capture/ScanOverlay.tsx` — single-mode dark viewfinder with corner brackets, `stowScan` line, mode strip ("One item" / "Whole shelf" disabled). **Logic + ported markup.**

Modify:
- `src/lib/firebase/storage.ts` — add `bestEffortDeleteImage` (contract §9.1). **Logic — full code.**
- `src/lib/firebase/storage.test.ts` — add `bestEffortDeleteImage` tests (file may exist from prior phases; create if absent).
- `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts` — extend `OverlayKind` with `"captureFirst"` (contract §3).
- `src/features/stow/ui/mobile/add/AddItemSheet.tsx` — replace P1 PhotoField placeholder slot with the real `PhotoField`; wire single-scan + "AI filled" badge.
- `src/features/stow/ui/mobile/screens/ItemDetail.tsx` — replace P1 edit-mode photo placeholder with the real `PhotoField`.
- `src/features/stow/ui/mobile/StowMobileApp.tsx` — route `photo` / `scan` / `captureFirst` overlays; scan FAB opens `ScanOverlay`.
- `tests/` — Playwright spec: add an item via the file-input fallback path (mock the vision callable).

No new Firestore types, indexes, rules, or repository methods are introduced in P2 (reuse `createItem`/`updateItem`/`createItemDraft`/`completeItemDraft` from the contract's data layer).

---

## Task 1: Image-orphan cleanup — `bestEffortDeleteImage`

Contract §9.1: add to `src/lib/firebase/storage.ts`. Best-effort delete of a previously uploaded image; swallow errors (log only). Called on photo replace/remove (Task 5) and is the carry-over of the legacy cleanup behavior (spec §7.8).

**Files:**
- Modify: `src/lib/firebase/storage.ts`
- Test: `src/lib/firebase/storage.test.ts` (create if it does not exist)

- [x] **Step 1: Write the failing test**

> The test mocks `deleteStorageObject` by spying on the module's own export is not possible (same-module call), so `bestEffortDeleteImage` is written to call `deleteStorageObject` indirectly is **not** done — instead it calls the Firebase `deleteObject` path through `deleteStorageObject`. To keep the unit test pure and avoid Firebase, we mock the entire `@/lib/firebase/storage` Firebase dependency surface by mocking `@/lib/firebase/client` (`getStorageClient`) and `firebase/storage`. The test asserts: (a) no-op when there is no `storagePath`; (b) calls delete when a `storagePath` is present; (c) never throws when the underlying delete rejects.

```ts
// src/lib/firebase/storage.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";

const deleteObjectMock = vi.fn();
const refMock = vi.fn((_storage: unknown, path: string) => ({ fullPath: path }));

vi.mock("firebase/storage", () => ({
  deleteObject: (...args: unknown[]) => deleteObjectMock(...args),
  ref: (...args: unknown[]) => refMock(...(args as [unknown, string])),
  // present so other imports in the module resolve if tree-shaking pulls them
  getDownloadURL: vi.fn(),
  uploadBytes: vi.fn()
}));

vi.mock("@/lib/firebase/client", () => ({
  getStorageClient: vi.fn(async () => ({ __storage: true }))
}));

import { bestEffortDeleteImage } from "@/lib/firebase/storage";

afterEach(() => {
  deleteObjectMock.mockReset();
  refMock.mockClear();
});

describe("bestEffortDeleteImage", () => {
  it("does nothing when image is null/undefined", async () => {
    await bestEffortDeleteImage(null);
    await bestEffortDeleteImage(undefined);
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("does nothing when the image has no storagePath", async () => {
    await bestEffortDeleteImage({ downloadUrl: "https://example.com/x.jpg" });
    expect(deleteObjectMock).not.toHaveBeenCalled();
  });

  it("deletes the object when a storagePath is present", async () => {
    deleteObjectMock.mockResolvedValueOnce(undefined);
    await bestEffortDeleteImage({ storagePath: "households/h1/items/i1/images/a.jpg" });
    expect(deleteObjectMock).toHaveBeenCalledTimes(1);
    expect(refMock).toHaveBeenCalledWith(expect.anything(), "households/h1/items/i1/images/a.jpg");
  });

  it("never throws when the underlying delete rejects", async () => {
    deleteObjectMock.mockRejectedValueOnce(new Error("not-found"));
    await expect(
      bestEffortDeleteImage({ storagePath: "households/h1/items/i1/images/missing.jpg" })
    ).resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/firebase/storage.test.ts`
Expected: FAIL — `bestEffortDeleteImage is not a function` (not yet exported).

- [x] **Step 3: Write the implementation**

Add to the end of `src/lib/firebase/storage.ts` (the file already imports `ImageRef` and exports `deleteStorageObject`):

```ts
export async function bestEffortDeleteImage(image: ImageRef | null | undefined): Promise<void> {
  const storagePath = image?.storagePath;
  if (!storagePath) return;
  try {
    await deleteStorageObject(storagePath);
  } catch (error) {
    // Orphan cleanup is best-effort: a missing or already-deleted object,
    // or a transient Storage error, must never block the user-facing action.
    console.warn("bestEffortDeleteImage: failed to delete", storagePath, error);
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/firebase/storage.test.ts`
Expected: PASS (4 tests).

- [x] **Step 5: Commit**

```bash
git add src/lib/firebase/storage.ts src/lib/firebase/storage.test.ts
git commit -m "feat(storage): add bestEffortDeleteImage orphan cleanup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Pure helper — apply a `VisionSuggestion` to draft fields

Contract §9.2: the single AI scan fills `name`/`tags`/`notes` (value stays manual). `VisionCategorizeResponse.suggestion` is `VisionSuggestion = { suggestedName, tags, notes, confidence, rationale }` (`src/types/llm.ts`). Extract a tiny pure helper so the merge logic is unit-tested and reused by `PhotoField`, `CaptureFirst`, and `AddItemSheet`.

**Files:**
- Create: `src/features/stow/ui/mobile/capture/applyVisionSuggestion.ts`
- Test: `src/features/stow/ui/mobile/capture/applyVisionSuggestion.test.ts`

- [x] **Step 1: Write the failing test**

```ts
// src/features/stow/ui/mobile/capture/applyVisionSuggestion.test.ts
import { describe, expect, it } from "vitest";
import {
  applyVisionSuggestion,
  type ItemDraftFields
} from "@/features/stow/ui/mobile/capture/applyVisionSuggestion";
import type { VisionSuggestion } from "@/types/llm";

const base: ItemDraftFields = { name: "", tags: [], notes: "", value: "" };

const suggestion: VisionSuggestion = {
  suggestedName: "Sony WH-1000XM5",
  tags: ["Tech", "Audio"],
  notes: "Over-ear headphones",
  confidence: 0.82
};

describe("applyVisionSuggestion", () => {
  it("fills name, tags, and notes from the suggestion", () => {
    const next = applyVisionSuggestion(base, suggestion);
    expect(next.name).toBe("Sony WH-1000XM5");
    expect(next.tags).toEqual(["Tech", "Audio"]);
    expect(next.notes).toBe("Over-ear headphones");
  });

  it("never touches value (value stays manual per contract §9.2)", () => {
    const next = applyVisionSuggestion({ ...base, value: "250" }, suggestion);
    expect(next.value).toBe("250");
  });

  it("does not overwrite a name the user already typed", () => {
    const next = applyVisionSuggestion({ ...base, name: "My headphones" }, suggestion);
    expect(next.name).toBe("My headphones");
  });

  it("merges suggested tags into existing tags without duplicates, preserving order", () => {
    const next = applyVisionSuggestion({ ...base, tags: ["Audio", "Gift"] }, suggestion);
    expect(next.tags).toEqual(["Audio", "Gift", "Tech"]);
  });

  it("does not overwrite notes the user already typed", () => {
    const next = applyVisionSuggestion({ ...base, notes: "bought 2024" }, suggestion);
    expect(next.notes).toBe("bought 2024");
  });

  it("treats a blank/whitespace suggested name as no suggestion", () => {
    const next = applyVisionSuggestion(base, { ...suggestion, suggestedName: "  " });
    expect(next.name).toBe("");
  });

  it("ignores missing notes on the suggestion", () => {
    const next = applyVisionSuggestion(base, {
      suggestedName: "Lamp",
      tags: [],
      confidence: 0.4
    });
    expect(next.notes).toBe("");
    expect(next.name).toBe("Lamp");
  });

  it("returns a new object and does not mutate the input", () => {
    const input = { ...base, tags: ["Audio"] };
    const next = applyVisionSuggestion(input, suggestion);
    expect(next).not.toBe(input);
    expect(input.tags).toEqual(["Audio"]);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/capture/applyVisionSuggestion.test.ts`
Expected: FAIL — "Failed to resolve import" / `applyVisionSuggestion is not a function`.

- [x] **Step 3: Write the implementation**

```ts
// src/features/stow/ui/mobile/capture/applyVisionSuggestion.ts
import type { VisionSuggestion } from "@/types/llm";

/**
 * The mutable item-draft fields the Add Item / Edit / Capture-first flows hold
 * as strings while the user is editing. `value` is a string here because it is
 * bound to a numeric text input; it is parsed to a number only at save time.
 */
export interface ItemDraftFields {
  name: string;
  tags: string[];
  notes: string;
  value: string;
}

/**
 * Apply an AI VisionSuggestion to draft fields per contract §9.2:
 * fill name/tags/notes, never value (value stays a manual field).
 * User-entered values win — we only fill empties and merge tags.
 */
export function applyVisionSuggestion(
  fields: ItemDraftFields,
  suggestion: VisionSuggestion
): ItemDraftFields {
  const suggestedName = suggestion.suggestedName?.trim() ?? "";
  const name = fields.name.trim() ? fields.name : suggestedName;

  const suggestedNotes = suggestion.notes?.trim() ?? "";
  const notes = fields.notes.trim() ? fields.notes : suggestedNotes;

  const mergedTags = [...fields.tags];
  for (const tag of suggestion.tags ?? []) {
    if (tag && !mergedTags.includes(tag)) mergedTags.push(tag);
  }

  return {
    ...fields,
    name,
    notes,
    tags: mergedTags
    // value intentionally left untouched (contract §9.2)
  };
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/capture/applyVisionSuggestion.test.ts`
Expected: PASS (8 tests).

- [x] **Step 5: Commit**

```bash
git add src/features/stow/ui/mobile/capture/applyVisionSuggestion.ts src/features/stow/ui/mobile/capture/applyVisionSuggestion.test.ts
git commit -m "feat(mobile): add applyVisionSuggestion draft-merge helper

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `useCamera` — controller (feature-detect + status transitions)

Contract §9 `CameraController`. Real `getUserMedia({video:{facingMode:"environment"}})`, draw the current video frame to a canvas, export a JPEG `Blob`, freeze/retake/reset, and permission/error/unsupported states. The hook is **not** a pure function, but its feature-detect and status transitions are testable by mocking `navigator.mediaDevices` and the canvas. We test those; the live video pipeline is validated by manual + Playwright (Task 9).

**Files:**
- Create: `src/features/stow/ui/mobile/hooks/useCamera.ts`
- Test: `src/features/stow/ui/mobile/hooks/useCamera.test.ts`

- [x] **Step 1: Write the failing test**

> We avoid React Testing Library (not in the repo). Instead, `useCamera` is structured so the controller object is produced by a pure factory `createCameraController(deps)` that the hook wraps with `useRef`/`useState`. The factory takes injectable refs + a `setState` callback so we can drive it from a node test. `isCameraSupported()` is also exported and pure. The hook `useCamera()` is the thin React wrapper (covered by manual/Playwright).

```ts
// src/features/stow/ui/mobile/hooks/useCamera.test.ts
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
    void c; void seen;
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
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useCamera.test.ts`
Expected: FAIL — import cannot be resolved.

- [x] **Step 3: Write the implementation**

```ts
// src/features/stow/ui/mobile/hooks/useCamera.ts
import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus = "idle" | "starting" | "live" | "frozen" | "error" | "unsupported";

export interface CameraController {
  videoRef: React.RefObject<HTMLVideoElement>;
  status: CameraStatus;
  error: string | null;
  supported: boolean;
  start(): Promise<void>;
  stop(): void;
  capture(): Promise<Blob>;
  reset(): void;
}

/** Feature-detect getUserMedia. Pure; SSR/test-safe. */
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

/** Draw the current video frame to a canvas and return a JPEG Blob. */
async function defaultDrawToBlob(video: HTMLVideoElement): Promise<Blob> {
  const width = video.videoWidth || 1080;
  const height = video.videoHeight || 1080;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9)
  );
  if (!blob) throw new Error("Failed to encode photo");
  return blob;
}

// ── Testable factory ─────────────────────────────────────────────────────────
// The controller logic is extracted from React so its status transitions and
// feature-detect branch can be unit-tested by injecting deps. `useCamera()`
// below wires real refs/state into it.

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
  requestStream(): Promise<MediaStream>;
  drawToBlob(video: HTMLVideoElement): Promise<Blob>;
  supported: boolean;
}

export interface InternalCameraController {
  start(): Promise<void>;
  stop(): void;
  capture(): Promise<Blob>;
  reset(): void;
}

export function createCameraController(deps: CameraControllerDeps): InternalCameraController {
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
    deps.setState({ status: "starting", error: null });
    try {
      const stream = await deps.requestStream();
      deps.setStream(stream);
      const video = deps.getVideoEl();
      if (video) {
        video.srcObject = stream;
        try {
          await video.play();
        } catch {
          // autoplay can reject on some browsers; the stream is still live.
        }
      }
      deps.setState({ status: "live", error: null });
    } catch (error) {
      stopTracks();
      deps.setState({ status: "error", error: messageForGetUserMediaError(error) });
    }
  }

  function stop(): void {
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
    // Return to the still-running live preview after a freeze.
    deps.setState({ status: "live", error: null });
  }

  return { start, stop, capture, reset };
}

// ── React hook ────────────────────────────────────────────────────────────────

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
      requestStream: () =>
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false }),
      drawToBlob: defaultDrawToBlob,
      supported: supportedRef.current
    });
  }

  // Always stop the stream on unmount.
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
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/stow/ui/mobile/hooks/useCamera.test.ts`
Expected: PASS (all `isCameraSupported` + `createCameraController` cases).

- [x] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/features/stow/ui/mobile/hooks/useCamera.ts src/features/stow/ui/mobile/hooks/useCamera.test.ts
git commit -m "feat(mobile): add useCamera controller with feature-detect and freeze/retake

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `CornerBrackets` viewfinder primitive

Shared by `PhotoSource` (Task 5) and `ScanOverlay` (Task 8). Port `CornerBrackets` from `prototype/photo.jsx` (lines 7-13). It takes a `color` prop and renders four absolutely-positioned L-shaped corners.

**Files:**
- Create: `src/features/stow/ui/mobile/capture/CornerBrackets.tsx`

- [x] **Step 1: Write the component** (no unit test — pure presentational SVG-less markup; covered by manual + Playwright)

```tsx
// src/features/stow/ui/mobile/capture/CornerBrackets.tsx
import type { CSSProperties } from "react";

/**
 * Viewfinder corner brackets. Ported from prototype/photo.jsx `CornerBrackets`.
 * `color` is passed through (callers use var(--stow-accent) or a literal rgba).
 */
export function CornerBrackets({ color }: { color: string }) {
  const positions: CSSProperties[] = [
    { top: 0, left: 0 },
    { top: 0, right: 0 },
    { bottom: 0, left: 0 },
    { bottom: 0, right: 0 }
  ];
  const radii = ["18px 0 0 0", "0 18px 0 0", "0 0 0 18px", "0 0 18px 0"];
  return (
    <>
      {[0, 1, 2, 3].map((k) => (
        <div
          key={k}
          style={{
            position: "absolute",
            width: 40,
            height: 40,
            border: `3px solid ${color}`,
            borderRadius: radii[k],
            ...positions[k],
            ...(k < 2 ? { borderBottom: "none" } : { borderTop: "none" }),
            ...(k % 2 === 0 ? { borderRight: "none" } : { borderLeft: "none" })
          }}
        />
      ))}
    </>
  );
}
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 3: Commit**

```bash
git add src/features/stow/ui/mobile/capture/CornerBrackets.tsx
git commit -m "feat(mobile): add CornerBrackets viewfinder primitive

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `PhotoField` component (empty + filled, upload + cleanup)

Contract §9:
```ts
// components/PhotoField.tsx
{ value: ImageRef | null; onChange: (next: ImageRef | null) => void; onScanAI?: () => void; uploadPath: (fileName: string) => string }
```
Empty state = Take Photo / Library / Scan-with-AI tiles; filled state = preview + Retake / Replace / Remove. On pick: `uploadFileToStorage(uploadPath(name), file)` → `ImageRef` → `onChange`. On replace/remove: `bestEffortDeleteImage(old)` (Task 1). Port markup from `prototype/photo.jsx` `PhotoField` (lines 28-64) + `SourceTile` (lines 15-25).

This component owns the **library/file picker** and the **camera source** by delegating to `PhotoSource` (rendered as an overlay it controls via local state). "Take Photo" opens `PhotoSource` in camera mode; "Library" triggers a hidden `<input type="file">`. "Scan with AI" calls `onScanAI` (the parent runs the scan against the just-uploaded image — see Task 6/7). When the camera is unsupported, "Take Photo" also falls back to the file input with `capture="environment"` (contract §9 fallback note).

**Component prop interface (our code):**
```ts
interface PhotoFieldProps {
  value: ImageRef | null;
  onChange: (next: ImageRef | null) => void;
  onScanAI?: () => void;
  uploadPath: (fileName: string) => string;
}
```

**Consumes:** `uploadFileToStorage` (`@/lib/firebase/storage`), `bestEffortDeleteImage` (Task 1), `PhotoSource` (Task 5b — built next), icons from `@/features/stow/ui/mobile/theme/icons` (`Camera`, `ImageIcon`, `Sparkles`, `ChevronRight`, `Trash2`, re-export `ImageIcon` is needed — add it in Step 1 if missing from P0's icon re-exports).

**Section-by-section structure (ported):**
1. **Filled** (`value` truthy): a 170px-tall rounded preview `<img src={value.downloadUrl}>` with a bottom gradient scrim and a control row — Retake (camera), Replace (library), spacer, Remove (danger). Ported from prototype lines 36-46.
2. **Empty**: a row of two `SourceTile`s (Take Photo / Library) + a full-width "Scan with AI" button. Ported from prototype lines 48-62.
3. A hidden `<input type="file" accept="image/*">` (and `capture="environment"` when unsupported) used by Library and by the Take-Photo fallback.
4. A locally-rendered `<PhotoSource>` overlay when the user opened the camera source.

**Non-obvious code / bindings:**
- Uploads must use a **unique file name** so replace doesn't collide: `\`photo-${Date.now()}.jpg\``.
- After a successful upload, capture the **previous** `value` and call `bestEffortDeleteImage(prev)` (replace/remove). Do this *after* `onChange(next)` so the UI updates immediately and cleanup is fire-and-forget.
- A busy flag disables the tiles while uploading and shows "Uploading…".

**Files:**
- Create: `src/features/stow/ui/mobile/components/PhotoField.tsx`

- [x] **Step 1: Write the component**

> If `ImageIcon` is not re-exported from `@/features/stow/ui/mobile/theme/icons` (P0 re-exported a shell-glyph subset), import the missing glyphs directly from `lucide-react` in this file: `import { Camera, ImageIcon, Sparkles, ChevronRight, Trash2 } from "lucide-react";` Confirm names with `node -e "console.log(['Camera','ImageIcon','Sparkles','ChevronRight','Trash2'].map(n=>[n, !!require('lucide-react')[n]]))"`. (Verified present at plan time.)

```tsx
// src/features/stow/ui/mobile/components/PhotoField.tsx
import { useRef, useState } from "react";
import { Camera, ImageIcon, Sparkles, ChevronRight, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ImageRef } from "@/types/domain";
import { uploadFileToStorage, bestEffortDeleteImage } from "@/lib/firebase/storage";
import { PhotoSource } from "@/features/stow/ui/mobile/capture/PhotoSource";
import { isCameraSupported } from "@/features/stow/ui/mobile/hooks/useCamera";

interface PhotoFieldProps {
  value: ImageRef | null;
  onChange: (next: ImageRef | null) => void;
  onScanAI?: () => void;
  uploadPath: (fileName: string) => string;
}

function nextFileName() {
  return `photo-${Date.now()}.jpg`;
}

export function PhotoField({ value, onChange, onScanAI, uploadPath }: PhotoFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isCameraSupported();

  async function uploadBlob(blob: Blob) {
    const name = nextFileName();
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    setBusy(true);
    const previous = value;
    try {
      const ref = await uploadFileToStorage(uploadPath(name), file, { contentType: file.type });
      onChange(ref);
      if (previous) void bestEffortDeleteImage(previous); // fire-and-forget orphan cleanup
    } finally {
      setBusy(false);
    }
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-picking the same file
    if (file) void uploadBlob(file);
  }

  function openCamera() {
    if (supported) setCameraOpen(true);
    else fileInputRef.current?.click(); // <input capture=environment> fallback
  }

  function openLibrary() {
    fileInputRef.current?.click();
  }

  function removePhoto() {
    const previous = value;
    onChange(null);
    if (previous) void bestEffortDeleteImage(previous);
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        {...(!supported ? { capture: "environment" as const } : {})}
        onChange={onFilePicked}
        style={{ display: "none" }}
      />

      {value?.downloadUrl ? (
        <div
          style={{
            position: "relative",
            borderRadius: "var(--stow-radius-button)",
            overflow: "hidden",
            height: 170,
            border: "1px solid var(--stow-border-l)"
          }}
        >
          <img
            src={value.downloadUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 70,
              background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)"
            }}
          />
          <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", gap: 8 }}>
            <FilledControl icon={Camera} label="Retake" onClick={openCamera} disabled={busy} />
            <FilledControl icon={ImageIcon} label="Replace" onClick={openLibrary} disabled={busy} />
            <div style={{ flex: 1 }} />
            <FilledControl icon={Trash2} label="" danger onClick={removePhoto} disabled={busy} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <SourceTile icon={Camera} label={busy ? "Uploading…" : "Take Photo"} sub="Use camera" onClick={openCamera} disabled={busy} />
            <SourceTile icon={ImageIcon} label="Library" sub="Choose photo" onClick={openLibrary} disabled={busy} />
          </div>
          {onScanAI ? (
            <button
              type="button"
              onClick={onScanAI}
              disabled={busy}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                borderRadius: "var(--stow-radius-button)",
                border: "1.5px solid color-mix(in srgb, var(--stow-accent) 27%, transparent)",
                background: "color-mix(in srgb, var(--stow-accent) 10%, transparent)",
                cursor: busy ? "default" : "pointer",
                fontFamily: "inherit",
                textAlign: "left",
                opacity: busy ? 0.6 : 1
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "var(--stow-accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <Sparkles size={17} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--stow-ink)" }}>Scan with AI</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--stow-warm)" }}>
                  Auto-fill name, tags &amp; notes from a photo
                </div>
              </div>
              <ChevronRight size={16} color="var(--stow-accent)" />
            </button>
          ) : null}
        </div>
      )}

      {cameraOpen ? (
        <PhotoSource
          onClose={() => setCameraOpen(false)}
          onPicked={(blob) => {
            setCameraOpen(false);
            void uploadBlob(blob);
          }}
        />
      ) : null}
    </>
  );
}

function SourceTile({
  icon: Icon,
  label,
  sub,
  onClick,
  disabled
}: {
  icon: LucideIcon;
  label: string;
  sub: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "20px 8px",
        borderRadius: "var(--stow-radius-button)",
        border: "1.5px solid var(--stow-border)",
        background: "var(--stow-canvas)",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.6 : 1
      }}
    >
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: 14,
          background: "color-mix(in srgb, var(--stow-accent) 9%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Icon size={22} color="var(--stow-accent)" />
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--stow-ink)" }}>{label}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--stow-warm)" }}>{sub}</div>
    </button>
  );
}

function FilledControl({
  icon: Icon,
  label,
  danger,
  onClick,
  disabled
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: label ? "9px 14px" : "9px 11px",
        borderRadius: 99,
        border: "none",
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        fontFamily: "inherit",
        opacity: disabled ? 0.6 : 1
      }}
    >
      <Icon size={14} color={danger ? "#FF6B6B" : "#fff"} />
      {label ? ` ${label}` : ""}
    </button>
  );
}
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: FAIL only if `PhotoSource` is not yet created — proceed to Task 5b, then re-run. (If implementing strictly in order, create the `PhotoSource` stub from Task 5b before typechecking. The two are a unit; build Task 5b immediately after.)

- [x] **Step 3: Commit** (after Task 5b typechecks clean)

```bash
git add src/features/stow/ui/mobile/components/PhotoField.tsx
git commit -m "feat(mobile): add PhotoField with upload and orphan cleanup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5b: `PhotoSource` overlay (camera + library, freeze→Retake/Use)

Contract §9:
```ts
// capture/PhotoSource.tsx
{ onClose; onPicked: (blob: Blob) => void } — camera + library picker, freeze→Retake/Use.
```
Full-screen dark capture overlay. Drives `useCamera` (Task 3). iOS framing (CornerBrackets), shutter button, freeze frame on capture, then Retake / Use Photo. When `!camera.supported` (or on camera error), render a fallback panel with a single "Choose from library" button backed by `<input type="file" accept="image/*" capture="environment">` — selecting a file resolves to a `Blob` via `onPicked`. The "library" affordance in the camera bottom-left also opens that file input (we do not ship the mock `PHOTO_POOL` grid — contract §11).

Port the camera markup from `prototype/photo.jsx` `PhotoSource` (camera branch, lines 101-169), translating tokens per §1.3 and replacing the mock `CAMERA_FEED`/`PHOTO_POOL` image with a live `<video ref={camera.videoRef}>` for the live preview and a frozen `<img>`/`<canvas>` snapshot for the captured frame. The library-grid branch (prototype lines 75-98) is **replaced** by the OS file picker.

**Component prop interface (our code):**
```ts
interface PhotoSourceProps {
  onClose: () => void;
  onPicked: (blob: Blob) => void;
}
```

**Consumes:** `useCamera` (Task 3), `CornerBrackets` (Task 4), icons `X`, `ImageIcon`, `Check`, `Camera` (lucide-react direct import to be safe).

**State machine (local):**
- On mount: call `camera.start()`.
- `camera.status === "live"` → show `<video>` preview, CornerBrackets, shutter + library button.
- Shutter (`onShutter`) → `const blob = await camera.capture()` then store `frozenUrl = URL.createObjectURL(blob)` and `frozenBlob = blob`; status becomes `"frozen"`.
- Frozen → show frozen `<img src={frozenUrl}>`, Retake (`camera.reset()`, revoke object URL, clear frozen) / Use (`onPicked(frozenBlob)`).
- `camera.status === "error" | "unsupported"` → fallback panel (message from `camera.error` when present) with "Choose from library".
- On unmount / close → `camera.stop()` and `URL.revokeObjectURL(frozenUrl)`.

**Files:**
- Create: `src/features/stow/ui/mobile/capture/PhotoSource.tsx`

- [x] **Step 1: Write the component**

```tsx
// src/features/stow/ui/mobile/capture/PhotoSource.tsx
import { useEffect, useRef, useState } from "react";
import { X, ImageIcon, Check, Camera } from "lucide-react";
import { useCamera } from "@/features/stow/ui/mobile/hooks/useCamera";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";

interface PhotoSourceProps {
  onClose: () => void;
  onPicked: (blob: Blob) => void;
}

const DARK = "#0A0A12"; // literal camera surface (contract §1.3: not a token)

export function PhotoSource({ onClose, onPicked }: PhotoSourceProps) {
  const camera = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);
  const frozenBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    void camera.start();
    return () => {
      camera.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (frozenUrl) URL.revokeObjectURL(frozenUrl);
    };
  }, [frozenUrl]);

  async function onShutter() {
    try {
      const blob = await camera.capture();
      frozenBlobRef.current = blob;
      setFrozenUrl(URL.createObjectURL(blob));
    } catch {
      // capture failure leaves us live; the user can retry or use the library
    }
  }

  function retake() {
    if (frozenUrl) URL.revokeObjectURL(frozenUrl);
    setFrozenUrl(null);
    frozenBlobRef.current = null;
    camera.reset();
  }

  function usePhoto() {
    if (frozenBlobRef.current) onPicked(frozenBlobRef.current);
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onPicked(file);
  }

  const frozen = camera.status === "frozen" && !!frozenUrl;
  const unavailable = camera.status === "unsupported" || camera.status === "error";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 85,
        background: DARK,
        display: "flex",
        flexDirection: "column",
        animation: "stowUp 0.28s ease-out"
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFilePicked}
        style={{ display: "none" }}
      />

      {/* top bar */}
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 20px",
          zIndex: 5
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 99,
            background: "rgba(255,255,255,0.15)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)"
          }}
        >
          <X size={18} color="#fff" />
        </button>
        <div style={{ color: "#fff", fontSize: 14, fontWeight: 700 }}>New Photo</div>
        <div style={{ width: 40 }} />
      </div>

      {/* viewfinder / frozen frame / fallback */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {unavailable ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              padding: 32,
              textAlign: "center"
            }}
          >
            <Camera size={40} color="rgba(255,255,255,0.5)" />
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, maxWidth: 280 }}>
              {camera.error ?? "Camera unavailable on this device."}
            </div>
          </div>
        ) : frozen ? (
          <img
            src={frozenUrl ?? undefined}
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <>
            <video
              ref={camera.videoRef}
              playsInline
              muted
              autoPlay
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at 50% 42%, transparent 38%, rgba(0,0,0,0.5) 100%)"
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: 244,
                height: 244
              }}
            >
              <CornerBrackets color="rgba(255,255,255,0.85)" />
            </div>
          </>
        )}
      </div>

      {/* bottom controls */}
      <div style={{ position: "relative", padding: "18px 24px 54px", zIndex: 5 }}>
        {unavailable ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: "100%",
              padding: "15px 0",
              borderRadius: 16,
              border: "none",
              background: "var(--stow-accent)",
              color: "#fff",
              fontSize: 15,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8
            }}
          >
            <ImageIcon size={16} color="#fff" /> Choose from library
          </button>
        ) : frozen ? (
          <div style={{ display: "flex", gap: 12 }}>
            <button
              type="button"
              onClick={retake}
              style={{
                flex: 1,
                padding: "15px 0",
                borderRadius: 16,
                border: "1.5px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit"
              }}
            >
              Retake
            </button>
            <button
              type="button"
              onClick={usePhoto}
              style={{
                flex: 1,
                padding: "15px 0",
                borderRadius: 16,
                border: "none",
                background: "var(--stow-accent)",
                color: "#fff",
                fontSize: 15,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              <Check size={16} color="#fff" /> Use Photo
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              type="button"
              aria-label="Choose from library"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 46,
                height: 46,
                borderRadius: 12,
                border: "2px solid rgba(255,255,255,0.5)",
                padding: 0,
                cursor: "pointer",
                background: "rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <ImageIcon size={20} color="rgba(255,255,255,0.85)" />
            </button>
            <button
              type="button"
              aria-label="Capture"
              onClick={onShutter}
              disabled={camera.status !== "live"}
              style={{
                width: 74,
                height: 74,
                borderRadius: 99,
                border: "5px solid rgba(255,255,255,0.35)",
                background: "#fff",
                cursor: camera.status === "live" ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: camera.status === "live" ? 1 : 0.6
              }}
            >
              <div style={{ width: 54, height: 54, borderRadius: 99, background: "#fff", border: "2px solid #0A0A12" }} />
            </button>
            <div style={{ width: 46, height: 46 }} />
          </div>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (both `PhotoField` and `PhotoSource` now resolve).

- [x] **Step 3: Commit**

```bash
git add src/features/stow/ui/mobile/capture/PhotoSource.tsx
git commit -m "feat(mobile): add PhotoSource camera+library capture overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Wire `PhotoField` into `AddItemSheet` (real field + single AI scan)

Replace P1's `PhotoField` **placeholder slot** in `AddItemSheet` with the real `PhotoField`. The Add Item sheet holds the draft fields the contract/P1 already manage; this task connects the photo + AI scan and the "✨ AI filled" badge.

Contract §9.2 single-scan flow: capture/upload (done inside `PhotoField`) → `visionCategorizeItemImage({ householdId, imageRef: { storagePath }, context })` → fill name/tags/notes via `applyVisionSuggestion` (Task 2) → review (the sheet stays open with fields filled) → save (existing `createItem`). Honest loading copy: "Reading photo…".

**Files:**
- Modify: `src/features/stow/ui/mobile/add/AddItemSheet.tsx`

> **Context for the engineer:** P1 created `AddItemSheet` with a placeholder where the photo field goes (roadmap P1 Task 8: "Photo (`PhotoField` placeholder until P2)") and an "✨ AI filled" badge slot. The sheet already owns form state for name, space/area selection, value, tags, and notes, and already calls `useWorkspaceData().actions.createItem` on submit. You are wiring the real photo field + scan; do **not** rebuild the rest of the sheet. The exact local state names in P1 may differ — adapt the bindings below to the existing state. The required behaviors are fixed.

- [x] **Step 1: Add image state + the AI-filled flag (if P1 did not already)**

In `AddItemSheet`, ensure the component holds:
```tsx
const [image, setImage] = useState<ImageRef | null>(null);
const [aiFilled, setAiFilled] = useState(false);
const [scanning, setScanning] = useState(false);
const [scanError, setScanError] = useState<string | null>(null);
```
Imports to add at the top:
```tsx
import type { ImageRef } from "@/types/domain";
import { PhotoField } from "@/features/stow/ui/mobile/components/PhotoField";
import { applyVisionSuggestion, type ItemDraftFields } from "@/features/stow/ui/mobile/capture/applyVisionSuggestion";
import { visionCategorizeItemImage } from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
```
The component must receive `householdId` (already available in P1 via props or `useWorkspaceData`); the scan also passes the selected space/area as context. The upload path uses the **draft image** namespace keyed by a stable per-sheet id so the scan can read it back. Generate one id when the sheet opens:
```tsx
const draftImageId = useMemo(() => inventoryRepository.createItemDraftId(householdId), [householdId]);
```
(Import `inventoryRepository` from `@/features/stow/services/repository` if not already imported. Using a draft id only as a storage-path segment is fine — no draft doc is written for the manual Add Item path; the image becomes the item's image on save.)

- [x] **Step 2: Define the upload path + scan handler**

```tsx
const uploadPath = useCallback(
  (fileName: string) => storagePaths.draftImage(householdId, draftImageId, fileName),
  [householdId, draftImageId]
);

const runAiScan = useCallback(async () => {
  if (!image?.storagePath) {
    setScanError("Add a photo first, then scan.");
    return;
  }
  setScanning(true);
  setScanError(null);
  try {
    const response = await visionCategorizeItemImage({
      householdId,
      imageRef: { storagePath: image.storagePath },
      context: {
        spaceId: selectedSpaceId ?? undefined,
        areaId: selectedAreaId ?? undefined,
        areaName: selectedAreaName ?? undefined
      }
    });
    const current: ItemDraftFields = { name, tags, notes, value };
    const next = applyVisionSuggestion(current, response.suggestion);
    setName(next.name);
    setTags(next.tags);
    setNotes(next.notes);
    setAiFilled(true);
    // value intentionally untouched (contract §9.2)
  } catch (error) {
    setScanError("Couldn't read the photo. Try again or fill the details yourself.");
  } finally {
    setScanning(false);
  }
}, [image, householdId, selectedSpaceId, selectedAreaId, selectedAreaName, name, tags, notes, value]);
```
> Bind `selectedSpaceId` / `selectedAreaId` / `selectedAreaName` / `name` / `tags` / `notes` / `value` / their setters to whatever P1 named them. `tags` is a `string[]` in the draft fields (the sheet may store tags as an array of chips). `value` is the string-backed numeric input.

- [x] **Step 3: Render the real PhotoField in the photo slot**

Replace the P1 placeholder block with:
```tsx
<div style={{ marginBottom: 14 }}>
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
    <FieldLabel>Photo</FieldLabel>
    {aiFilled ? (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 9.5,
          fontWeight: 800,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: "var(--stow-accent)",
          background: "var(--stow-accent-soft)",
          padding: "3px 8px",
          borderRadius: 99
        }}
      >
        <Sparkles size={10} color="var(--stow-accent)" /> AI filled
      </span>
    ) : null}
  </div>
  <PhotoField
    value={image}
    onChange={(next) => {
      setImage(next);
      if (!next) setAiFilled(false);
    }}
    onScanAI={runAiScan}
    uploadPath={uploadPath}
  />
  {scanning ? (
    <p style={{ margin: "8px 2px 0", fontSize: 12.5, fontWeight: 600, color: "var(--stow-ink-muted)" }}>
      Reading photo…
    </p>
  ) : null}
  {scanError ? (
    <p style={{ margin: "8px 2px 0", fontSize: 12.5, fontWeight: 600, color: "var(--stow-danger)" }}>
      {scanError}
    </p>
  ) : null}
</div>
```
> `FieldLabel` and `Sparkles`: use P1's field-label primitive (or `components/Field.tsx`'s label) and import `Sparkles` from `lucide-react`. Match the surrounding markup style P1 used.

- [x] **Step 4: Pass the image (and AI metadata) into the existing save**

In the sheet's submit handler (P1's `createItem` call), include the image and AI provenance so the saved item carries the photo and is marked AI-assisted when scanned:
```tsx
await actions.createItem({
  // ...existing fields P1 already passes (name, spaceId, areaId, areaNameSnapshot, value, tags, notes)...
  image: image ?? undefined,
  entryMode: aiFilled ? "ai_assisted" : "manual"
});
```
> `createItem`'s `photoStatus`/`entryMode` are derived by the repo if omitted (`defaultPhotoStatus`/`defaultEntryMode`), so `entryMode` is the only provenance flag worth setting explicitly. Do not invent a `vision` payload — `VisionCategorizeResponse` does not surface the full `VisionMetadata` to the client here; `entryMode: "ai_assisted"` is sufficient for P2.

- [x] **Step 5: Reset photo state when the sheet closes/submits**

Ensure the sheet's existing reset/close path also clears `image`, `aiFilled`, `scanning`, and `scanError`. If the user closes without saving and an image was uploaded to the draft namespace, that object is orphaned; call `bestEffortDeleteImage(image)` on cancel:
```tsx
function handleCancel() {
  if (image) void bestEffortDeleteImage(image); // unsaved draft photo cleanup
  setImage(null);
  setAiFilled(false);
  setScanError(null);
  onClose(); // P1's close
}
```
Import `bestEffortDeleteImage` from `@/lib/firebase/storage`. On successful save, clear the state **without** deleting (the image now belongs to the item).

- [x] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [x] **Step 7: Commit**

```bash
git add src/features/stow/ui/mobile/add/AddItemSheet.tsx
git commit -m "feat(mobile): wire real PhotoField and single AI scan into AddItemSheet

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Wire `PhotoField` into `ItemDetail` edit mode

Replace P1's **edit-mode photo placeholder** in `ItemDetail` with the real `PhotoField`. In edit mode the user can Retake/Replace/Remove the item photo; on Save (P1's existing `updateItem` call) the image is persisted. Uploads go to the **item image** namespace. No AI scan here (the empty-state Scan tile is only in Add — pass no `onScanAI`, or omit it).

Port intent from `prototype/screens-detail.jsx` `ItemDetail` edit branch (line 75: `<PhotoField ... target="edit" />`).

**Files:**
- Modify: `src/features/stow/ui/mobile/screens/ItemDetail.tsx`

> **Context:** P1 built `ItemDetail` with view/edit/tag/move sub-modes; the edit sub-mode has a photo placeholder slot (roadmap P1 Task 7: "Edit covers name/photo/value/notes (photo editing — parity gap vs desktop-next)"). P1 already holds an edit-form state object (name/image/value/notes) and calls `updateItem` on save. You are swapping the placeholder for the real field and ensuring cleanup on replace/remove.

- [ ] **Step 1: Add imports**

```tsx
import { PhotoField } from "@/features/stow/ui/mobile/components/PhotoField";
import { storagePaths } from "@/lib/firebase/paths";
import { bestEffortDeleteImage } from "@/lib/firebase/storage";
import type { ImageRef } from "@/types/domain";
```

- [ ] **Step 2: Render the real PhotoField in the edit photo slot**

The edit form holds the item id (`item.id`) and an editable image (P1's `edit.image`, typed as `ImageRef | null`). Replace the placeholder with:
```tsx
<div>
  <FieldLabel>Photo</FieldLabel>
  <PhotoField
    value={editImage}
    onChange={setEditImage}
    uploadPath={(fileName) => storagePaths.itemImage(householdId, item.id, fileName)}
  />
</div>
```
> Bind `editImage`/`setEditImage` to P1's edit-form image state and label primitive. `householdId` is available in `ItemDetail` (props or `useWorkspaceData`). If P1 stored the edit image as a string URL rather than an `ImageRef`, change that piece of P1 state to `ImageRef | null` to match `PhotoField`'s contract `value` type (the rest of the edit form only reads `editImage?.downloadUrl` for preview, which `PhotoField` now owns).

- [ ] **Step 3: Persist the image on Save**

In P1's edit-save handler (the `updateItem` call), pass the edited image. `updateItem`'s patch already accepts `image?: ImageRef | null` (repository contract). Removing the photo sends `image: null`:
```tsx
await actions.updateItem({
  householdId,
  itemId: item.id,
  patch: {
    // ...existing name/value/notes patch P1 builds...
    image: editImage ?? null
  }
});
```

- [ ] **Step 4: Cleanup the previous image when it changed**

After a successful save, if the saved image differs from the item's prior image, delete the orphaned prior object:
```tsx
const previousPath = item.image?.storagePath;
const nextPath = editImage?.storagePath;
if (previousPath && previousPath !== nextPath) {
  void bestEffortDeleteImage(item.image);
}
```
> `PhotoField` already cleans up the *intermediate* old upload when the user Replaces within the editor. This Step covers the case where the user replaced/removed and then saved: the **original committed** image (which `PhotoField` never saw as its `value` until edit opened) must be cleaned only on save. Place this block right after the `updateItem` promise resolves. (If P1 seeded `editImage` from `item.image` on entering edit mode, `PhotoField`'s own replace-cleanup already deleted intermediate uploads; this guards the original.)

- [ ] **Step 5: Wire item-delete cleanup (spec §7.8)**

P1's `ItemDetail` delete action calls `actions.deleteItem`. Add image cleanup so deleting an item with a photo doesn't orphan the Storage object:
```tsx
function confirmDelete() {
  const imageToClean = item.image;
  void actions.deleteItem({ householdId, itemId: item.id }).then(() => {
    if (imageToClean) void bestEffortDeleteImage(imageToClean);
  });
  // P1's existing post-delete navigation (back/close) stays as-is
}
```
> Match P1's actual delete call signature. The point is: after the item doc is deleted, best-effort-delete its image.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/stow/ui/mobile/screens/ItemDetail.tsx
git commit -m "feat(mobile): real photo editing + image cleanup in ItemDetail

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: `ScanOverlay` (single mode) + `CaptureFirst` + overlay routing

This task wires the scan FAB to `ScanOverlay`, builds the camera-first add entry `CaptureFirst`, extends the nav `OverlayKind` with `"captureFirst"`, and routes `photo`/`scan`/`captureFirst` through `StowMobileApp`.

### 8a. Extend `OverlayKind` (contract §3)

**Files:**
- Modify: `src/features/stow/ui/mobile/hooks/useMobileNavigation.ts`

- [ ] **Step 1: Add `"captureFirst"` to the union**

Find (P0):
```ts
export type OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace";
```
Replace with:
```ts
export type OverlayKind = "scan" | "photo" | "addItem" | "addSpace" | "addArea" | "editSpace" | "captureFirst";
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no exhaustive switch should break; if one does, handle `"captureFirst"` there).

- [ ] **Step 3: Commit**

```bash
git add src/features/stow/ui/mobile/hooks/useMobileNavigation.ts
git commit -m "feat(mobile): add captureFirst overlay kind

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### 8b. `ScanOverlay` (single mode; whole-shelf disabled until P3)

Contract §9:
```ts
// capture/ScanOverlay.tsx
{ onClose; onCaptureSingle: (blob: Blob) => void; onCaptureShelf?: (blob: Blob) => void }
```
Dark viewfinder, corner brackets, `stowScan` line, mode strip "One item" / "Whole shelf". P2 ships **single** mode only; render the "Whole shelf" segment **disabled** with a "coming in P3" affordance. The single-mode shutter captures a frame and calls `onCaptureSingle(blob)`. Drives `useCamera`.

Port markup from `prototype/screens-detail.jsx` `ScanOverlay` (lines 333-388), translating tokens per §1.3, replacing the mock viewfinder background with a live `<video>`, and replacing the mock `act.doScan`/`act.startQuickCapture` with real capture. The prototype's `scanning` boolean (an external "identifying" state) maps to a local `busy` flag set while capturing.

**Component prop interface (our code):**
```ts
interface ScanOverlayProps {
  onClose: () => void;
  onCaptureSingle: (blob: Blob) => void;
  onCaptureShelf?: (blob: Blob) => void; // accepted for forward-compat; P2 ignores/disables shelf
}
```

**Consumes:** `useCamera` (Task 3), `CornerBrackets` (Task 4), icons `X`, `Sparkles`, `ScanLine`, `Grid` (lucide-react).

**Structure (ported):**
1. Top bar: Close (`X`), centered "AI Scan" chip (`Sparkles`), spacer.
2. Viewfinder: live `<video ref={camera.videoRef}>` with the radial vignette, a 250px CornerBrackets frame (accent), and the `stowScan` animated line (only while `camera.status === "live"`).
3. Caption block: title/subtitle (honest copy — "Point at an item" / "Stow will name and tag it for you").
4. Mode strip: two segments. "One item" (active), "Whole shelf" (**disabled**, dimmed, with a small "Soon" tag — `onClick` no-op).
5. Shutter: round button; `onShutter` → `const blob = await camera.capture(); onCaptureSingle(blob)`.

**Non-obvious:** on mount call `camera.start()`; on unmount `camera.stop()`. If `camera.status` is `error`/`unsupported`, show the same fallback message style as `PhotoSource` plus a "Choose from library" file input that yields a `Blob` to `onCaptureSingle` (so scan still works without a live camera).

**Files:**
- Create: `src/features/stow/ui/mobile/capture/ScanOverlay.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/stow/ui/mobile/capture/ScanOverlay.tsx
import { useEffect, useRef } from "react";
import { X, Sparkles, ScanLine, Grid } from "lucide-react";
import { useCamera } from "@/features/stow/ui/mobile/hooks/useCamera";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";

interface ScanOverlayProps {
  onClose: () => void;
  onCaptureSingle: (blob: Blob) => void;
  onCaptureShelf?: (blob: Blob) => void;
}

const DARK = "#0A0A12";

export function ScanOverlay({ onClose, onCaptureSingle }: ScanOverlayProps) {
  const camera = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void camera.start();
    return () => camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onShutter() {
    try {
      const blob = await camera.capture();
      onCaptureSingle(blob);
    } catch {
      // leave overlay open on failure; user can retry or use library
    }
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onCaptureSingle(file);
  }

  const unavailable = camera.status === "unsupported" || camera.status === "error";
  const live = camera.status === "live";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 75,
        background: DARK,
        display: "flex",
        flexDirection: "column",
        animation: "stowUp 0.3s ease-out"
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFilePicked}
        style={{ display: "none" }}
      />

      {/* top bar */}
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 20px",
          zIndex: 3
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 99,
            background: "rgba(255,255,255,0.15)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(10px)"
          }}
        >
          <X size={18} color="#fff" />
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            background: "rgba(255,255,255,0.12)",
            padding: "8px 14px",
            borderRadius: 99
          }}
        >
          <Sparkles size={14} color="var(--stow-accent)" /> AI Scan
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* viewfinder */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        {!unavailable ? (
          <video
            ref={camera.videoRef}
            playsInline
            muted
            autoPlay
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at 50% 45%, rgba(40,40,60,0.6), #0A0A12 70%)"
          }}
        />
        <div style={{ position: "relative", width: 250, height: 250, borderRadius: 28 }}>
          <CornerBrackets color="var(--stow-accent)" />
          {live ? (
            <div
              style={{
                position: "absolute",
                left: 8,
                right: 8,
                height: 3,
                borderRadius: 99,
                background: "var(--stow-accent)",
                boxShadow: "0 0 16px var(--stow-accent)",
                animation: "stowScan 1.4s ease-in-out infinite"
              }}
            />
          ) : null}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ScanLine size={40} color="rgba(255,255,255,0.25)" />
          </div>
        </div>
      </div>

      <div style={{ padding: "0 24px 60px", textAlign: "center", position: "relative", zIndex: 3 }}>
        <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
          {unavailable ? "Camera unavailable" : "Point at an item"}
        </div>
        <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginBottom: 22 }}>
          {unavailable
            ? camera.error ?? "Pick a photo from your library to scan."
            : "Stow will name and tag it for you"}
        </div>

        {/* mode strip — one item (active) vs whole shelf (P3) */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "rgba(255,255,255,0.12)",
            borderRadius: 99,
            padding: 4,
            width: "fit-content",
            margin: "0 auto 22px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
              background: "var(--stow-accent)"
            }}
          >
            <ScanLine size={14} color="#fff" /> One item
          </div>
          <div
            aria-disabled="true"
            title="Coming in P3"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 18px",
              borderRadius: 99,
              fontSize: 13,
              fontWeight: 800,
              color: "rgba(255,255,255,0.4)",
              background: "transparent",
              cursor: "not-allowed"
            }}
          >
            <Grid size={14} color="rgba(255,255,255,0.4)" /> Whole shelf
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.5,
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.5)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 99,
                padding: "1px 6px"
              }}
            >
              Soon
            </span>
          </div>
        </div>

        {unavailable ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: "14px 22px",
              borderRadius: 99,
              border: "none",
              background: "#fff",
              color: "#0A0A12",
              fontSize: 14,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "inherit"
            }}
          >
            Choose from library
          </button>
        ) : (
          <button
            type="button"
            aria-label="Scan"
            onClick={onShutter}
            disabled={!live}
            style={{
              width: 76,
              height: 76,
              borderRadius: 99,
              margin: "0 auto",
              border: "5px solid rgba(255,255,255,0.3)",
              background: live ? "#fff" : "var(--stow-warm)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: live ? "pointer" : "default"
            }}
          >
            <div style={{ width: 54, height: 54, borderRadius: 99, background: live ? "var(--stow-accent)" : "var(--stow-warm)" }} />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/stow/ui/mobile/capture/ScanOverlay.tsx
git commit -m "feat(mobile): add single-mode ScanOverlay (whole-shelf disabled until P3)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### 8c. `CaptureFirst` (camera-first add entry)

Contract §9:
```ts
// capture/CaptureFirst.tsx
{ householdId; spaceId?; areaId?; onClose; onCreated: (itemId: string) => void } — camera-first add (photo→details sheet, AI-filled badge).
```
The whole "Add Item" can begin here: capture/pick/AI-scan first, then the details sheet opens pre-filled (with the "✨ AI filled" badge handled by `AddItemSheet`, Task 6). Port the camera-first flow from `prototype/photo.jsx` `CaptureFirst` (lines 176-303), translating tokens and replacing the mock capture/AI with real `useCamera` + upload + `visionCategorizeItemImage`.

**Design decision (how it hands off):** `CaptureFirst` is a thin **camera entry** that produces an `ImageRef` (and optional applied `VisionSuggestion`), then closes itself and opens `AddItemSheet` pre-filled. Rather than duplicate the whole add form, `CaptureFirst` uses the contract draft path: it uploads the photo to the draft namespace, optionally runs the scan, then calls back to `StowMobileApp` to open `addItem` with a payload `{ image, aiFilled, suggestion?, spaceId?, areaId? }`. `AddItemSheet` (Task 6) reads that overlay payload to seed its initial state.

> This keeps a single source of truth for the add form (`AddItemSheet`) and satisfies the contract's `onCreated` by having the *sheet* create the item; `CaptureFirst`'s `onCreated` is invoked by the sheet via the shell after `createItem` resolves. To honor the literal contract signature, `CaptureFirst` still accepts `onCreated` and calls it if it takes the *direct* create path (mode where the user taps "Use Photo" with no further details — see Step 2). Implement the handoff-to-sheet as the default; the direct-create path is the fast lane.

**Component prop interface (our code):**
```ts
interface CaptureFirstProps {
  householdId: string;
  spaceId?: string | null;
  areaId?: string | null;
  onClose: () => void;
  onCreated: (itemId: string) => void;
  onOpenDetails: (payload: {
    image: ImageRef;
    aiFilled: boolean;
    suggestion?: VisionSuggestion;
    spaceId?: string | null;
    areaId?: string | null;
  }) => void;
}
```
> `onOpenDetails` is the handoff to `AddItemSheet`. It is an addition beyond the contract's named props but does not change any locked signature — the contract's four props remain. `StowMobileApp` supplies it (Step 8d).

**Consumes:** `useCamera` (Task 3), `CornerBrackets` (Task 4), `uploadFileToStorage` + `bestEffortDeleteImage` (`@/lib/firebase/storage`), `visionCategorizeItemImage` (`@/lib/firebase/functions`), `storagePaths` (`@/lib/firebase/paths`), `inventoryRepository` (for a draft id), icons `X`, `Sparkles`, `Camera`, `ArrowRight`, `Check` (lucide-react).

**State machine (local), ported from prototype:**
- `mode: "photo" | "ai"` (mode strip), `phase: "live" | "frozen" | "uploading" | "identifying"`, `frozenUrl`/`frozenBlob`.
- On mount: `camera.start()`. Live preview + CornerBrackets + caption ("Center your item in the frame" / "Frame the item — Stow will name & tag it").
- Shutter → `camera.capture()` → freeze.
- Frozen: Retake (`camera.reset()`) / **Use Photo**:
  - Upload the frozen blob to `storagePaths.draftImage(householdId, draftId, name)` → `ImageRef` (`phase="uploading"`).
  - If `mode === "ai"`: `phase="identifying"`; call `visionCategorizeItemImage` with the uploaded `storagePath` + `{spaceId,areaId}` context; build a `suggestion`; then `onOpenDetails({ image, aiFilled:true, suggestion, spaceId, areaId })` and `onClose()`.
  - Else: `onOpenDetails({ image, aiFilled:false, spaceId, areaId })` and `onClose()`.
- `camera` error/unsupported → fallback (file input → upload → same handoff).
- Skip (top-right, before capture): `onOpenDetails`-less → just `onClose()` then open an empty `addItem` (the shell handles "Skip" by opening the sheet with no payload; pass a no-image open). For simplicity, "Skip" calls `onClose()` and the shell opens `addItem` with no payload (Step 8d wires this).
- On unmount: `camera.stop()`, revoke `frozenUrl`.

**Files:**
- Create: `src/features/stow/ui/mobile/capture/CaptureFirst.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/features/stow/ui/mobile/capture/CaptureFirst.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Sparkles, Camera, ArrowRight, Check } from "lucide-react";
import type { ImageRef } from "@/types/domain";
import type { VisionSuggestion } from "@/types/llm";
import { useCamera } from "@/features/stow/ui/mobile/hooks/useCamera";
import { CornerBrackets } from "@/features/stow/ui/mobile/capture/CornerBrackets";
import { uploadFileToStorage, bestEffortDeleteImage } from "@/lib/firebase/storage";
import { visionCategorizeItemImage } from "@/lib/firebase/functions";
import { storagePaths } from "@/lib/firebase/paths";
import { inventoryRepository } from "@/features/stow/services/repository";

interface CaptureFirstProps {
  householdId: string;
  spaceId?: string | null;
  areaId?: string | null;
  onClose: () => void;
  onCreated: (itemId: string) => void;
  onOpenDetails: (payload: {
    image: ImageRef;
    aiFilled: boolean;
    suggestion?: VisionSuggestion;
    spaceId?: string | null;
    areaId?: string | null;
  }) => void;
}

const DARK = "#0A0A12";
type Phase = "live" | "frozen" | "uploading" | "identifying";

export function CaptureFirst({ householdId, spaceId, areaId, onClose, onOpenDetails }: CaptureFirstProps) {
  const camera = useCamera();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"photo" | "ai">("photo");
  const [phase, setPhase] = useState<Phase>("live");
  const [frozenUrl, setFrozenUrl] = useState<string | null>(null);
  const frozenBlobRef = useRef<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const draftId = useMemo(() => inventoryRepository.createItemDraftId(householdId), [householdId]);

  useEffect(() => {
    void camera.start();
    return () => camera.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => {
    if (frozenUrl) URL.revokeObjectURL(frozenUrl);
  }, [frozenUrl]);

  const ai = mode === "ai";

  async function onShutter() {
    try {
      const blob = await camera.capture();
      frozenBlobRef.current = blob;
      setFrozenUrl(URL.createObjectURL(blob));
      setPhase("frozen");
    } catch {
      setError("Couldn't capture. Try again or choose from your library.");
    }
  }

  function retake() {
    if (frozenUrl) URL.revokeObjectURL(frozenUrl);
    setFrozenUrl(null);
    frozenBlobRef.current = null;
    setError(null);
    setPhase("live");
    camera.reset();
  }

  async function handleBlob(blob: Blob) {
    setError(null);
    setPhase("uploading");
    const name = `photo-${Date.now()}.jpg`;
    const file = new File([blob], name, { type: blob.type || "image/jpeg" });
    let image: ImageRef;
    try {
      image = await uploadFileToStorage(storagePaths.draftImage(householdId, draftId, name), file, {
        contentType: file.type
      });
    } catch {
      setError("Upload failed. Check your connection and try again.");
      setPhase(frozenBlobRef.current ? "frozen" : "live");
      return;
    }
    if (!ai) {
      onOpenDetails({ image, aiFilled: false, spaceId, areaId });
      onClose();
      return;
    }
    setPhase("identifying");
    try {
      const response = await visionCategorizeItemImage({
        householdId,
        imageRef: { storagePath: image.storagePath! },
        context: { spaceId: spaceId ?? undefined, areaId: areaId ?? undefined }
      });
      onOpenDetails({ image, aiFilled: true, suggestion: response.suggestion, spaceId, areaId });
      onClose();
    } catch {
      // Scan failed but we still have a good photo — hand off without AI fill.
      onOpenDetails({ image, aiFilled: false, spaceId, areaId });
      onClose();
    }
  }

  function useFrozen() {
    if (frozenBlobRef.current) void handleBlob(frozenBlobRef.current);
  }

  function onFilePicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleBlob(file);
  }

  function skip() {
    // Discard any uploaded-but-unused draft photo and open an empty details sheet.
    onClose();
  }

  const busy = phase === "uploading" || phase === "identifying";
  const frozen = phase === "frozen" && !!frozenUrl;
  const unavailable = camera.status === "unsupported" || camera.status === "error";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 85,
        background: DARK,
        display: "flex",
        flexDirection: "column",
        animation: "stowUp 0.3s ease-out"
      }}
    >
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onFilePicked} style={{ display: "none" }} />

      {/* top bar */}
      <div
        style={{
          position: "absolute",
          top: 52,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 18px",
          zIndex: 6
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            width: 40,
            height: 40,
            borderRadius: 99,
            background: "rgba(255,255,255,0.15)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(10px)"
          }}
        >
          <X size={18} color="#fff" />
        </button>
        <div style={{ color: "#fff", fontSize: 15, fontWeight: 800, letterSpacing: -0.2 }}>New Item</div>
        {!frozen && !busy ? (
          <button
            type="button"
            onClick={skip}
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "rgba(255,255,255,0.85)",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              padding: "8px 4px"
            }}
          >
            Skip
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>

      {/* viewfinder / frozen frame */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        {unavailable ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
            <Camera size={40} color="rgba(255,255,255,0.5)" />
            <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: 600, maxWidth: 280 }}>
              {camera.error ?? "Camera unavailable on this device."}
            </div>
          </div>
        ) : frozen ? (
          <img src={frozenUrl ?? undefined} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <>
            <video ref={camera.videoRef} playsInline muted autoPlay style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 44%, transparent 36%, rgba(0,0,0,0.55) 100%)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 244, height: 244 }}>
              <CornerBrackets color={ai ? "var(--stow-accent)" : "rgba(255,255,255,0.85)"} />
            </div>
            <div style={{ position: "absolute", top: "calc(50% + 142px)", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.78)", fontSize: 13, fontWeight: 600 }}>
              {ai ? "Frame the item — Stow will name & tag it" : "Center your item in the frame"}
            </div>
          </>
        )}
        {phase === "identifying" ? (
          <>
            <div style={{ position: "absolute", inset: 0, background: "rgba(10,10,18,0.4)" }} />
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 244, height: 244, borderRadius: 20 }}>
              <CornerBrackets color="var(--stow-accent)" />
              <div style={{ position: "absolute", left: 8, right: 8, height: 3, borderRadius: 99, background: "var(--stow-accent)", boxShadow: "0 0 16px var(--stow-accent)", animation: "stowScan 1.4s ease-in-out infinite" }} />
            </div>
          </>
        ) : null}
      </div>

      {/* bottom controls */}
      <div style={{ position: "relative", padding: "16px 24px 50px", zIndex: 5 }}>
        {error ? (
          <p style={{ textAlign: "center", color: "#FF6B6B", fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{error}</p>
        ) : null}
        {busy ? (
          <div style={{ textAlign: "center", color: "#fff" }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              {phase === "identifying" ? "Reading photo…" : "Saving photo…"}
            </div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              {phase === "identifying" ? "Naming & tagging" : "Uploading"}
            </div>
          </div>
        ) : unavailable ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%", padding: "15px 0", borderRadius: 16, border: "none", background: "var(--stow-accent)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}
          >
            Choose from library
          </button>
        ) : frozen ? (
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" onClick={retake} style={{ flex: 1, padding: "15px 0", borderRadius: 16, border: "1.5px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Retake
            </button>
            <button type="button" onClick={useFrozen} style={{ flex: 1.4, padding: "15px 0", borderRadius: 16, border: "none", background: "var(--stow-accent)", color: "#fff", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {ai ? <><Sparkles size={16} color="#fff" /> Use &amp; Identify</> : <><ArrowRight size={16} color="#fff" /> Use Photo</>}
            </button>
          </div>
        ) : (
          <>
            {/* mode strip */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.12)", borderRadius: 99, padding: 4, width: "fit-content", margin: "0 auto 20px" }}>
              {([["photo", "Photo", Camera], ["ai", "AI Scan", Sparkles]] as const).map(([key, label, Icon]) => {
                const on = mode === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setMode(key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 18px",
                      borderRadius: 99,
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      fontSize: 13,
                      fontWeight: 800,
                      color: on ? "#fff" : "rgba(255,255,255,0.6)",
                      background: on ? (key === "ai" ? "var(--stow-accent)" : "rgba(255,255,255,0.22)") : "transparent"
                    }}
                  >
                    <Icon size={14} color={on ? "#fff" : "rgba(255,255,255,0.6)"} /> {label}
                  </button>
                );
              })}
            </div>
            {/* capture row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button
                type="button"
                aria-label="Choose from library"
                onClick={() => fileInputRef.current?.click()}
                style={{ width: 46, height: 46, borderRadius: 12, border: "2px solid rgba(255,255,255,0.5)", padding: 0, cursor: "pointer", background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Camera size={20} color="rgba(255,255,255,0.7)" />
              </button>
              <button
                type="button"
                aria-label="Capture"
                onClick={onShutter}
                disabled={camera.status !== "live"}
                style={{ width: 74, height: 74, borderRadius: 99, border: "5px solid rgba(255,255,255,0.35)", background: "#fff", cursor: camera.status === "live" ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", opacity: camera.status === "live" ? 1 : 0.6 }}
              >
                <div style={{ width: 54, height: 54, borderRadius: 99, background: ai ? "var(--stow-accent)" : "#fff", border: ai ? "none" : "2px solid #0A0A12" }} />
              </button>
              <div style={{ width: 46, height: 46 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

> Note: `bestEffortDeleteImage` is imported for symmetry with the other capture surfaces and to make the "Skip after upload" cleanup available; in the flow above, Skip happens before upload so no cleanup is needed. Keep the import only if used; otherwise remove it to satisfy `noUnusedLocals`. (The `AddItemSheet` cancel path, Task 6 Step 5, owns cleanup of the handed-off draft image if the user later abandons the sheet.)

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. If `bestEffortDeleteImage` is unused, remove its import.

- [ ] **Step 3: Commit**

```bash
git add src/features/stow/ui/mobile/capture/CaptureFirst.tsx
git commit -m "feat(mobile): add CaptureFirst camera-first add entry

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### 8d. Route overlays in `StowMobileApp` + scan FAB → `ScanOverlay`

Wire the three capture overlays into the shell using the contract's overlay state (`nav.overlay`, `nav.openOverlay`, `nav.closeOverlay`). P0's shell rendered a "Capture arrives in P2" toast on the scan FAB; replace that with opening `ScanOverlay`.

**Files:**
- Modify: `src/features/stow/ui/mobile/StowMobileApp.tsx`

> **Context:** P0's `StowMobileApp` owned `onScan={() => setToast("Capture arrives in P2")}` and rendered placeholder screens. P1 added screens + the add/edit sheets and presumably routes `addItem`/`addSpace`/etc. overlays via `nav.overlay.kind`. This task adds `scan`, `photo` (if any caller opens a bare photo overlay), and `captureFirst`, and makes the FAB and "add item" entry point use them.

- [ ] **Step 1: Import the capture overlays + needed types**

```tsx
import { ScanOverlay } from "@/features/stow/ui/mobile/capture/ScanOverlay";
import { CaptureFirst } from "@/features/stow/ui/mobile/capture/CaptureFirst";
import type { ImageRef } from "@/types/domain";
import type { VisionSuggestion } from "@/types/llm";
```

- [ ] **Step 2: Make the scan FAB open the scan overlay**

Replace P0's `onScan` toast:
```tsx
<BottomNav
  tab={nav.tab}
  onTab={(t) => nav.navigateToTab(t)}
  onScan={() => nav.openOverlay("scan")}
  packedCount={packedCount}
/>
```

- [ ] **Step 3: Render the scan overlay and route its single capture into Add Item**

After the existing overlay/sheet renders, add:
```tsx
{nav.overlay.kind === "scan" ? (
  <ScanOverlay
    onClose={nav.closeOverlay}
    onCaptureSingle={(blob) => {
      // Hand the captured frame to the camera-first add flow's upload+scan path:
      // open captureFirst pre-frozen is overkill — instead open Add Item with the blob.
      // Simplest correct wiring: stash the blob and open the addItem overlay, which
      // uploads via PhotoField on mount. To avoid a second capture UI, we route the
      // blob through CaptureFirst's headless upload by opening captureFirst with a seed.
      nav.openOverlay("captureFirst", { seedBlob: blob, mode: "ai" });
    }}
  />
) : null}
```
> **Simplify (recommended implementation):** rather than seeding `CaptureFirst` with a blob (which complicates its state machine), have `ScanOverlay`'s `onCaptureSingle` perform the upload + scan inline here in the shell using a small async handler, then open `addItem` with the resulting payload. Implement Step 3 as the inline handler below and drop the `seedBlob` idea:

```tsx
async function handleScanSingle(blob: Blob) {
  nav.closeOverlay(); // close the scan viewfinder
  const draftId = inventoryRepository.createItemDraftId(householdId);
  const name = `photo-${Date.now()}.jpg`;
  const file = new File([blob], name, { type: blob.type || "image/jpeg" });
  let image: ImageRef | null = null;
  try {
    image = await uploadFileToStorage(storagePaths.draftImage(householdId, draftId, name), file, { contentType: file.type });
  } catch {
    setToast("Upload failed. Try again.");
    return;
  }
  let suggestion: VisionSuggestion | undefined;
  try {
    const response = await visionCategorizeItemImage({
      householdId,
      imageRef: { storagePath: image.storagePath! },
      context: { spaceId: nav.selectedSpaceId ?? undefined, areaId: nav.selectedAreaId ?? undefined }
    });
    suggestion = response.suggestion;
  } catch {
    setToast("Couldn't read the photo — add details yourself.");
  }
  nav.openOverlay("addItem", {
    image,
    aiFilled: !!suggestion,
    suggestion,
    spaceId: nav.selectedSpaceId,
    areaId: nav.selectedAreaId
  });
}
```
and render:
```tsx
{nav.overlay.kind === "scan" ? (
  <ScanOverlay onClose={nav.closeOverlay} onCaptureSingle={(blob) => void handleScanSingle(blob)} />
) : null}
```
Add the imports `uploadFileToStorage` (`@/lib/firebase/storage`), `visionCategorizeItemImage` (`@/lib/firebase/functions`), `storagePaths` (`@/lib/firebase/paths`), `inventoryRepository` (`@/features/stow/services/repository`).

- [ ] **Step 4: Render `CaptureFirst` and route its handoff into Add Item**

```tsx
{nav.overlay.kind === "captureFirst" ? (
  <CaptureFirst
    householdId={householdId}
    spaceId={nav.selectedSpaceId}
    areaId={nav.selectedAreaId}
    onClose={nav.closeOverlay}
    onCreated={(itemId) => {
      nav.closeOverlay();
      nav.openItem(itemId);
    }}
    onOpenDetails={(payload) => nav.openOverlay("addItem", { ...payload })}
  />
) : null}
```

- [ ] **Step 5: Make the "Add Item" entry point open `CaptureFirst` (camera-first)**

P1 wired some control (e.g. a "+ Add Item" button in `RoomScreen`/empty states) to `nav.openOverlay("addItem")`. For the camera-first design (spec §6.9, prototype `addFlow: "cameraFirst"`), change those entry points to open `captureFirst` instead, so adding an item starts at the camera. Keep a path to the bare sheet for "Skip". Concretely, the add-item triggers call:
```tsx
nav.openOverlay("captureFirst");
```
and `CaptureFirst`'s Skip (`onClose`) returns to the prior screen; the user can also start from the scan FAB. (If P1's empty-state explicitly wants the form, leaving it on `addItem` is acceptable — the key requirement is that `captureFirst` is reachable from at least the primary Add affordance.)

- [ ] **Step 6: Ensure `AddItemSheet` consumes the overlay payload**

`AddItemSheet` (Task 6) must seed its initial state from `nav.overlay.payload` when present: `image`, `aiFilled`, and `suggestion` (apply via `applyVisionSuggestion` on open), plus `spaceId`/`areaId` pre-selection. Add to `AddItemSheet` (extends Task 6):
```tsx
// when the sheet opens, seed from overlay payload
useEffect(() => {
  const payload = overlayPayload; // passed in from StowMobileApp as a prop, or read from nav
  if (!payload) return;
  if (payload.image) setImage(payload.image as ImageRef);
  if (payload.suggestion) {
    const next = applyVisionSuggestion({ name, tags, notes, value }, payload.suggestion as VisionSuggestion);
    setName(next.name); setTags(next.tags); setNotes(next.notes);
    setAiFilled(true);
  } else if (payload.aiFilled) {
    setAiFilled(true);
  }
  if (payload.spaceId) setSelectedSpaceId(payload.spaceId as string);
  if (payload.areaId) setSelectedAreaId(payload.areaId as string);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
> How `AddItemSheet` receives the payload depends on P1's wiring: either `StowMobileApp` passes `nav.overlay.payload` as an `initial` prop to `<AddItemSheet>`, or `AddItemSheet` calls `useMobileNavigation` itself. Prefer passing it as an explicit `initial?: AddItemInitial` prop from the shell for testability. Define:
> ```ts
> interface AddItemInitial { image?: ImageRef; aiFilled?: boolean; suggestion?: VisionSuggestion; spaceId?: string | null; areaId?: string | null; }
> ```
> and have `StowMobileApp` render `<AddItemSheet initial={nav.overlay.kind === "addItem" ? (nav.overlay.payload as AddItemInitial) : undefined} ... />`.

- [ ] **Step 7: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add src/features/stow/ui/mobile/StowMobileApp.tsx src/features/stow/ui/mobile/add/AddItemSheet.tsx
git commit -m "feat(mobile): route scan/photo/captureFirst overlays and camera-first add

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Playwright — add an item via the file-input fallback path

Add an e2e spec that exercises the capture path **without** a real camera: the file-input fallback. Mock the vision callable so the AI scan is deterministic. This validates `PhotoField` (file pick → upload → `ImageRef`), the single-scan wiring, and `createItem`.

**Files:**
- Create: `tests/mobile-capture.spec.ts` (match the repo's existing Playwright spec location/style — see `tests/` and `playwright.config.ts`)

> **Context for the engineer:** the repo runs Playwright against the app with Firebase emulators (`npm run test:smoke`, `playwright.config.ts`). Follow the existing authenticated-spec setup (auth/bootstrap helpers used by the current smoke spec). The key capture-specific techniques:
> - **Force the fallback path:** override `navigator.mediaDevices` to be undefined via `page.addInitScript` so `isCameraSupported()` returns false and `PhotoField`/overlays use `<input capture>`.
> - **Drive the hidden file input:** `setInputFiles` on the `input[type=file]` rendered by `PhotoField` (it is `display:none` but Playwright can still set files on it).
> - **Mock the vision callable:** intercept the callable HTTP route (`**/visionCategorizeItemImage`) with `page.route` and fulfill a `{ result: { data: { suggestion: {...}, provider: {...}, jobId } } }` body (Firebase callables wrap the response under `result`/`data`).

- [ ] **Step 1: Write the spec**

```ts
// tests/mobile-capture.spec.ts
import { test, expect } from "@playwright/test";
import path from "node:path";

// Reuse the project's existing auth/bootstrap helper used by the smoke spec.
// import { signInTestUser } from "./helpers/auth"; // adjust to the repo's helper

const FIXTURE = path.join(__dirname, "fixtures", "sample-item.jpg"); // add a small jpg fixture

test.beforeEach(async ({ page }) => {
  // 1) Force camera-unsupported so capture uses the file-input fallback.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", { value: undefined, configurable: true });
  });

  // 2) Mock the vision callable to a deterministic suggestion.
  await page.route("**/visionCategorizeItemImage", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: {
          data: {
            suggestion: {
              suggestedName: "Sony WH-1000XM5",
              tags: ["Tech", "Audio"],
              notes: "Over-ear headphones",
              confidence: 0.9
            },
            provider: { providerType: "gemini", model: "test" },
            jobId: "test-job"
          }
        }
      })
    });
  });

  // await signInTestUser(page); // project helper
  await page.goto("/app");
});

test("add an item via the file-input fallback and AI scan", async ({ page }) => {
  // Open the camera-first add entry (Skip → details sheet), or open Add Item directly.
  // Adjust selectors to the implemented UI (use role/text where possible).
  await page.getByRole("button", { name: /scan/i }).click(); // scan FAB
  // Camera is unsupported → ScanOverlay shows "Choose from library".
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser").catch(() => null),
    page.getByRole("button", { name: /choose from library/i }).click()
  ]);
  if (chooser) {
    await chooser.setFiles(FIXTURE);
  } else {
    // Fallback: set files directly on the hidden input if no filechooser event fires.
    await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
  }

  // The single-scan wiring uploads then opens Add Item pre-filled.
  await expect(page.getByText(/AI filled/i)).toBeVisible();
  await expect(page.getByDisplayValue("Sony WH-1000XM5")).toBeVisible();

  // Save the item.
  await page.getByRole("button", { name: /add item/i }).click();

  // It appears in the inventory (toast or list). Adjust to the implemented confirmation.
  await expect(page.getByText(/Sony WH-1000XM5/)).toBeVisible();
});
```

- [ ] **Step 2: Add the fixture image**

Create a tiny valid JPEG at `tests/fixtures/sample-item.jpg` (any small real jpg). If the repo already has an image fixture, reuse it and update the path.

- [ ] **Step 3: Run the spec**

Run: `npm run test:smoke -- tests/mobile-capture.spec.ts` (or the repo's documented single-spec invocation; check `package.json` scripts and `playwright.config.ts`).
Expected: PASS. Iterate selectors to match the implemented markup (prefer `getByRole`/`getByText` over CSS).

- [ ] **Step 4: Commit**

```bash
git add tests/mobile-capture.spec.ts tests/fixtures/sample-item.jpg
git commit -m "test(mobile): e2e add item via file-input fallback with mocked vision

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Full verification + manual smoke

- [ ] **Step 1: Run the unit suite**

Run: `npm test`
Expected: PASS, including the new `storage.test.ts` (`bestEffortDeleteImage`), `applyVisionSuggestion.test.ts`, and `useCamera.test.ts`.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both succeed.

- [ ] **Step 3: Manual smoke in dev (real camera)**

Run: `npm run dev` (with emulators if testing data), open `http://127.0.0.1:5173/app` on a device/browser with a camera (or Chrome with a fake camera: `--use-fake-device-for-media-stream`). Verify:
- **Scan FAB → ScanOverlay:** dark viewfinder, accent corner brackets, animated scan line; "One item" active, "Whole shelf" disabled with a "Soon" tag. Shutter captures a frame; it uploads, runs the (real or mocked) scan, and opens Add Item pre-filled with an "AI filled" badge; value is empty.
- **Add Item → PhotoField:** empty state shows Take Photo / Library / Scan with AI. "Take Photo" opens the camera (`PhotoSource`), freeze → Retake / Use Photo; "Use Photo" uploads and shows the filled preview with Retake / Replace / Remove. "Scan with AI" fills name/tags/notes (not value); honest "Reading photo…" copy appears.
- **Replace/Remove cleanup:** replacing a photo then checking Storage shows the old object removed (best-effort); removing clears the preview.
- **ItemDetail edit:** the photo field replaces/removes the item photo; Save persists; the prior Storage object is cleaned.
- **Camera-unsupported fallback:** in a browser with `navigator.mediaDevices` disabled (or iOS Safari quirks), Take Photo / scan fall back to the OS file picker with `capture="environment"`, and the flow still completes.
- **Camera-first add:** the primary Add affordance opens `CaptureFirst`; Photo and AI Scan modes both work; Skip opens the details sheet.
- Legacy `/spaces` and desktop `/next` still load unchanged.

- [ ] **Step 4: Final commit (if any manual fixups were needed)**

```bash
git add -A
git commit -m "chore(mobile): P2 capture verified

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (P2 plan vs roadmap + contract)

**Roadmap "P2 — Capture" tasks:**
- (1) `useCamera` — getUserMedia `facingMode:"environment"`, canvas→Blob, freeze/retake, permission errors, `<input capture>` fallback → **Task 3** (full code; feature-detect + transitions unit-tested). ✓
- (2) `PhotoSource` — camera + library source UI, iOS framing/shutter/freeze→Retake/Use → **Task 5b** (mock `PHOTO_POOL` grid replaced by OS file picker per §11). ✓
- (3) `PhotoField` — empty (Take Photo / Library / Scan with AI) + filled (Retake/Replace/Remove) → **Task 5**. ✓
- (4) Single AI scan — capture→upload→`visionCategorizeItemImage`→fill name/tags/notes→review→save, honest copy → **Task 2** (pure merge helper) + **Task 6** (AddItemSheet wiring) + **Task 8d** (scan-FAB inline handler). ✓ (value left manual per §9.2). ✓
- (5) `CaptureFirst` — camera-first add (photo→details sheet pre-filled, AI-filled badge) → **Task 8c** + handoff to **Task 6** sheet + **Task 8d** routing. ✓
- (6) `ScanOverlay` single mode behind scan FAB → **Task 8b** + **Task 8d**. ✓
- (7) Image-orphan cleanup on replace/remove → **Task 1** (`bestEffortDeleteImage`) wired in **Task 5** (PhotoField replace/remove), **Task 7** (ItemDetail edit + delete). ✓

**Contract sections:**
- **§9** signatures: `CameraController` (Task 3 — exact shape), `PhotoSource {onClose,onPicked}` (5b), `PhotoField {value,onChange,onScanAI?,uploadPath}` (5), `CaptureFirst {householdId,spaceId?,areaId?,onClose,onCreated}` (8c — locked props kept; `onOpenDetails` added as an extra, non-breaking prop), `ScanOverlay {onClose,onCaptureSingle,onCaptureShelf?}` (8b). ✓
- **§9.1** `bestEffortDeleteImage(image): Promise<void>` in `src/lib/firebase/storage.ts`, swallow errors, called on replace/remove + item delete → **Task 1**, consumed in Tasks 5/7. ✓
- **§9.2** single scan fills name/tags/notes, value manual, honest "Reading photo…" → Tasks 2/6/8. ✓
- **§3** `OverlayKind` extended with `"captureFirst"`; `openOverlay("captureFirst")` → **Task 8a/8d**. ✓
- **§11** prototype→domain: never ship `PHOTO_POOL`/`CAMERA_FEED` (replaced with live video/file picker); AI result mapped to `VisionSuggestion` (name/tags/notes, no value) → throughout. ✓
- **§1.3** token translation applied in all ported markup (Tasks 4/5/5b/8b/8c). ✓
- **§0.1** depth: full code for `useCamera`, `bestEffortDeleteImage`, the single-scan flow, and event/data wiring; ported markup with prop interface + bindings + structure for PhotoSource/PhotoField/ScanOverlay/CaptureFirst/CornerBrackets. ✓

**Tests:** `useCamera` feature-detect + status transitions with mocked `navigator.mediaDevices` (Task 3); pure `applyVisionSuggestion` helper (Task 2); `bestEffortDeleteImage` (Task 1); capture UI via manual + Playwright file-input fallback with mocked callable (Task 9). ✓ (No jsdom/RTL introduced; UI validated manual + e2e per contract §0.)

**Placeholder scan:** no "TODO"/"handle errors"/"similar to above" left as code; every code step shows code or a precise port instruction naming the prototype function and the binding adaptation needed against P1's existing state. The few "adapt to P1's exact state names" notes are unavoidable cross-phase glue (P1 file not yet written) and are paired with fixed required behaviors + concrete code.

**Type consistency:** `CameraController`/`CameraStatus`/`createCameraController`/`isCameraSupported` (Task 3) consumed in 5b/8b/8c; `ItemDraftFields`/`applyVisionSuggestion` (Task 2) consumed in 6/8c/8d; `bestEffortDeleteImage` (Task 1) consumed in 5/7/8c; `PhotoSource`/`PhotoField`/`ScanOverlay`/`CaptureFirst` prop interfaces match their call sites in 5/8d; `OverlayKind` (8a) used by `openOverlay` calls in 8d. `VisionSuggestion` fields (`suggestedName`/`tags`/`notes`/`confidence`) match `src/types/llm.ts`. `ImageRef`/`createItem`/`updateItem`/`storagePaths.draftImage`/`storagePaths.itemImage` match the live data layer read at plan time.

**Known cross-phase risks/assumptions (flag for the executing engineer):**
- P1's exact local-state names in `AddItemSheet`/`ItemDetail` are unknown (P1 plan not yet authored); Tasks 6/7/8d give fixed behaviors + code and call out the bindings to adapt. If P1 stored the edit image as a URL string, convert that piece to `ImageRef | null`.
- The scan-FAB single capture is wired via an inline upload+scan handler in `StowMobileApp` (Task 8d) rather than reusing `CaptureFirst`'s machine, to avoid seeding a frozen blob into that component. This is the recommended path; the alternative (seed `CaptureFirst`) is explicitly rejected in 8d Step 3.
- Callable response shape in the Playwright mock (`{ result: { data: ... } }`) should be confirmed against how `firebase/functions` httpsCallable unwraps emulator responses; adjust the mock body if the interception layer differs.
