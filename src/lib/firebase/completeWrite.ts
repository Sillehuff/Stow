/**
 * With persistent local cache, Firestore write promises resolve only on SERVER ack.
 * Offline, the local (optimistic) write has already applied — block the UI on the
 * server ack only when online. Returns whether the write is server-committed.
 *
 * Caveats:
 * - `navigator.onLine` (the default signal) is optimistic: `true` does not guarantee
 *   the server is reachable. A true-but-unreachable network still awaits the ack, so
 *   the anti-hang guarantee only holds when the browser KNOWS it's offline.
 * - Offline failures are only logged. If a queued write is later denied server-side
 *   (e.g. security rules reject it), the user already saw "will sync" and the item
 *   silently disappears once the local cache reconciles. Surfacing that is a known
 *   deferred follow-up.
 */
export function completeWrite(
  write: Promise<unknown>,
  isOnline: () => boolean = () => navigator.onLine
): Promise<boolean> {
  if (isOnline()) {
    return write.then(() => true);
  }
  write.catch((error) => console.error("Queued offline write failed", error));
  return Promise.resolve(false);
}
