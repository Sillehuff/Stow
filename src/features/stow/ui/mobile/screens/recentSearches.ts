export const MAX_RECENT = 6;

const STORE_CAP = 8;
const MIN_LENGTH = 2;

export function recentSearchKey(householdId: string): string {
  return `stow:${householdId}:recent-searches`;
}

function safeStorage(provided?: Storage): Storage | null {
  if (provided) return provided;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readRecentSearches(householdId: string, storage?: Storage): string[] {
  const store = safeStorage(storage);
  if (!store) return [];

  try {
    const raw = store.getItem(recentSearchKey(householdId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && Boolean(entry)).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentSearch(householdId: string, query: string, storage?: Storage): void {
  const nextQuery = query.trim();
  if (nextQuery.length < MIN_LENGTH) return;

  const store = safeStorage(storage);
  if (!store) return;

  try {
    const key = recentSearchKey(householdId);
    const raw = store.getItem(key);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const current = Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
    const next = [nextQuery, ...current.filter((entry) => entry.toLowerCase() !== nextQuery.toLowerCase())].slice(0, STORE_CAP);
    store.setItem(key, JSON.stringify(next));
  } catch {
    // Storage can fail in private mode or when a stale value is corrupt.
  }
}
