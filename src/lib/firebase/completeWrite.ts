/**
 * With persistent local cache, Firestore write promises resolve only on SERVER ack.
 * Offline, the local (optimistic) write has already applied — block the UI on the
 * server ack only when online. Returns whether the write is server-committed.
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
