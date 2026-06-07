import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_RECENT,
  pushRecentSearch,
  readRecentSearches,
  recentSearchKey
} from "@/features/stow/ui/mobile/screens/recentSearches";

function makeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    key: (index) => Array.from(map.keys())[index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value)
  };
}

describe("recentSearches", () => {
  let store: Storage;

  beforeEach(() => {
    store = makeStorage();
  });

  it("namespaces the key by household", () => {
    expect(recentSearchKey("h1")).toBe("stow:h1:recent-searches");
  });

  it("returns [] when nothing is stored or JSON is corrupt", () => {
    expect(readRecentSearches("h1", store)).toEqual([]);
    store.setItem(recentSearchKey("h1"), "{not json");
    expect(readRecentSearches("h1", store)).toEqual([]);
  });

  it("reads stored terms, dropping falsy entries, capped at MAX_RECENT", () => {
    store.setItem(recentSearchKey("h1"), JSON.stringify(["a", "", "b", "c", "d", "e", "f", "g", "h"]));
    expect(readRecentSearches("h1", store)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(readRecentSearches("h1", store).length).toBeLessThanOrEqual(MAX_RECENT);
  });

  it("prepends a new term, dedupes case-insensitively, caps at 8 on write", () => {
    pushRecentSearch("h1", "Drill", store);
    pushRecentSearch("h1", "Tent", store);
    pushRecentSearch("h1", "drill", store);
    const raw = JSON.parse(store.getItem(recentSearchKey("h1")) as string) as string[];
    expect(raw[0]).toBe("drill");
    expect(raw.filter((term) => term.toLowerCase() === "drill")).toHaveLength(1);
    expect(raw).toEqual(["drill", "Tent"]);
  });

  it("ignores blank or 1-char queries on write", () => {
    pushRecentSearch("h1", " ", store);
    pushRecentSearch("h1", "x", store);
    expect(store.getItem(recentSearchKey("h1"))).toBeNull();
  });

  it("keeps at most 8 stored entries", () => {
    for (const term of ["aa", "bb", "cc", "dd", "ee", "ff", "gg", "hh", "ii"]) {
      pushRecentSearch("h1", term, store);
    }
    const raw = JSON.parse(store.getItem(recentSearchKey("h1")) as string) as string[];
    expect(raw).toHaveLength(8);
    expect(raw[0]).toBe("ii");
  });
});
