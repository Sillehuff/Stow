/**
 * With persistent local cache, Firestore write promises resolve only on SERVER ack.
 * Offline, the local (optimistic) write has already applied — block the UI on the
 * server ack only when online. Returns whether the write is server-committed.
 *
 * Caveats:
 * - `navigator.onLine` (the default signal) is optimistic: `true` does not guarantee
 *   the server is reachable. A true-but-unreachable network still awaits the ack, so
 *   the anti-hang guarantee only holds when the browser KNOWS it's offline.
 * - Offline writes resolve `false` ("will sync") immediately. If a queued write is later
 *   denied server-side (e.g. security rules reject it), the optimistic local doc is rolled
 *   back. Pass `onQueuedWriteRejected` to surface that to the user instead of only logging it.
 */
export function completeWrite(
  write: Promise<unknown>,
  isOnline: () => boolean = () => navigator.onLine,
  onQueuedWriteRejected?: (error: unknown) => void
): Promise<boolean> {
  if (isOnline()) {
    return write.then(() => true);
  }
  write.catch((error) => {
    console.error("Queued offline write failed", error);
    onQueuedWriteRejected?.(error);
  });
  return Promise.resolve(false);
}
