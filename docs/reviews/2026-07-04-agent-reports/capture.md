# Report: Capture/Camera subsystem (review-capture agent)

## Capture/Camera subsystem

Read in full: `QuickCapture.tsx`, `CaptureFirst.tsx`, `ScanOverlay.tsx`, `QrScanOverlay.tsx`, `PhotoSource.tsx`, `PhotoField.tsx`, `captureReducer.ts` (+test), `useCamera.ts` (+test), plus the mount site in `StowMobileApp.tsx` and `completeWrite`/`storage` helpers. This subsystem is in good shape — the pre-launch fixes (orphaned-shelf-frame deletion, `stopped` guard in `useCamera`, request-id/cancelled refs, library-fallback `capture` attr) are all present and correct in current code. Findings below are the residual items.

---

### P1 — QR decode loop runs an unthrottled full decode every animation frame
`src/features/stow/ui/mobile/capture/QrScanOverlay.tsx:105-120`
```js
function tick() {
  raf = requestAnimationFrame(tick);
  if (handled || busy) return;
  ...
  busy = true;
  decoder.decode(video)...finally(() => { busy = false; });
}
```
- **Issue:** the loop schedules a decode on every rAF tick (~60fps); the only gate is the `busy` overlap guard, so on the jsQR path (iPhone/Safari — the common case) it runs `drawImage` + `getImageData` + a full 640px jsQR scan as fast as decode latency allows, continuously while the overlay is open.
- **Cost:** a QR scanner needs ~8-12fps to feel instant; running at 30-60fps is 3-6x the necessary CPU/GPU work and battery drain for the entire time the scanner sits open (users often hold it up for several seconds hunting for the label). Measurable, sustained drain on exactly the low-power devices on the jsQR path.
- **Fix:** add a timestamp throttle in `tick`. Introduce `let lastDecode = 0;` in the effect scope and a `const DECODE_INTERVAL_MS = 100;`. In `tick`, after the `handled || busy` check and before `busy = true`, add: `const now = performance.now(); if (now - lastDecode < DECODE_INTERVAL_MS) return; lastDecode = now;`. The native `BarcodeDetector` path benefits equally. Leaves rAF (so it auto-pauses when the tab is hidden) but caps real decodes at ~10/sec.

### P2 — Dead `"destination"` member in the `CapturePhase` union
`src/features/stow/ui/mobile/capture/captureReducer.ts:4`
```ts
export type CapturePhase = "analyzing" | "detected" | "review" | "destination" | "done";
```
- **Issue:** no action ever sets `phase: "destination"` and no component branches on it (`grep` confirms only the type declaration and the `phase:` field reference it). The destination picker is a `pickerOpen` boolean overlay in `QuickCapture`, not a reducer phase.
- **Cost:** misleads readers into thinking a destination *phase* exists in the state machine; invites a future `case "destination"` that can never be reached.
- **Fix:** delete `| "destination"` from the union. No other change needed — the reducer's `switch` doesn't reference it and `QuickCapture`'s render dispatch (`analyzing`/`detected` → frozen, `review` → review, else → done) is unaffected.

### P2 — `renderReview` reads a briefly-stale empty state on the last confirm/skip before `commitReady` fires
`src/features/stow/ui/mobile/capture/QuickCapture.tsx:254-258, 748-761`
```js
useEffect(() => {
  if (state.phase === "review" && state.cursor >= state.order.length) {
    dispatch({ type: "commitReady" });
  }
}, [state.cursor, state.order.length, state.phase]);
```
- **Issue:** confirming/skipping the final item advances `cursor` past `order.length` while `phase` is still `"review"`. React renders once with that state before the effect runs `commitReady`; in that render `currentDetection` is `undefined`, so `renderReview` shows the "No detections to review." fallback for one frame before `renderDone` takes over.
- **Cost:** a one-frame flash of a misleading empty message at the end of every shelf review. Cosmetic, not a data bug (commit still works), hence P2.
- **Fix:** collapse the phase transition into the reducer so there's no intermediate render: in the `confirm`/`skip` cases, when `advanceCursor(state)` reaches `state.order.length`, also set `phase: "done"`. Then delete the `commitReady` effect (254-258) and the now-unused `commitReady` action. Alternatively (smaller edit), in the render guard treat `state.phase === "review" && state.cursor >= state.order.length` as "done" and short-circuit to `renderDone()` before `renderReview()`.

---

### Verified clean

- **MediaStream / camera-track leaks** — `useCamera.ts` stops all tracks on `stop()`, on error, and via the `stopped` guard for a `getUserMedia` promise that resolves post-unmount (89-111, 124, 129-133); every overlay (`ScanOverlay`, `QrScanOverlay`, `PhotoSource`, `CaptureFirst`) calls `stop()` in its unmount cleanup. The `onCaptureShelf`/`onCaptureSingle` handoff relies on `nav.closeOverlay()` unmounting the overlay to stop the stream — verified that path fires.
- **Object URL (`createObjectURL`) leaks** — `PhotoSource` and `CaptureFirst` revoke via `clearFrozenPhoto` on retake/close/unmount; the shelf-capture preview URL is owned by `StowMobileApp` (`clearShelfCapture` revokes it on close, commit, and before creating a new one). No unrevoked URLs.
- **Orphaned Storage frame (pre-launch #23)** — fixed and correct: `QuickCapture` tracks `uploadedFrameRef` and `bestEffortDeleteImage`s it on unmount and before each re-upload; `CaptureFirst`/`PhotoField` delete on cancelled handoff and on superseded upload.
- **Async capture races / stale closures** — `QuickCapture` analyze effect uses `analyzedAttemptRef`+`retryKey` to dedupe and a `cancelled` flag; `CaptureFirst` uses `mountedRef`/`cancelledRef`/`processingRef` (double-tap guard); `PhotoField` uses `uploadRequestIdRef` + `mountedRef` to discard superseded uploads. `QrScanOverlay` keeps callbacks in refs so the decode loop never restarts on re-render. All sound.
- **Canvas memory** — `useCamera.drawToBlob` creates a throwaway canvas per capture (GC'd); `QrScanOverlay` reuses one canvas across decodes with `willReadFrequently: true`. No leaks or per-frame allocation churn.
- **`captureReducer` state-machine holes** — `advanceCursor` clamps at `order.length`; `rename`/`confirm`/`skip` no-op safely on a missing draft index; `selectCommitItems` correctly filters unkept/blank drafts and gates on a complete destination. Test coverage is thorough and matches behavior.
- **`useCamera` lifecycle** — controller is created once (ref-guarded), `start`/`stop`/`capture`/`reset` are stable `useCallback`s, unmount stops the stream. Tests cover unsupported/error/reset/stop paths.
- **Library-fallback `capture` attr (pre-launch #27)** — fixed: `ScanOverlay` and `CaptureFirst` file inputs no longer hardcode `capture="environment"`; `PhotoField` uses the correct `!supported` conditional.
- **rAF cancellation** — `QrScanOverlay` cancels its rAF in cleanup; no other component runs a rAF loop.
