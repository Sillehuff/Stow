// Small localStorage-backed UI preferences shared across mobile screens.
// Kept in its own module so screens don't import each other just to read a preference.

export const DEFAULT_SPACE_KEY = "stow:mobile:default-space";

/** The user's preferred default space id, or "" when unset/unavailable. */
export function readDefaultSpaceId(): string {
  try {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(DEFAULT_SPACE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeDefaultSpaceId(spaceId: string): void {
  try {
    window.localStorage.setItem(DEFAULT_SPACE_KEY, spaceId);
  } catch {
    // Storage can be unavailable in private mode; the in-session select value still works.
  }
}
