/** Stable position-first comparator: missing position sorts last, ties broken by name. */
export function byPosition<T extends { position?: number; name: string }>(a: T, b: T): number {
  return (
    (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) ||
    a.name.localeCompare(b.name)
  );
}
