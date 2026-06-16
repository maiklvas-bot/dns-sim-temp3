export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function readDraftFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (fallback && typeof fallback === "object" && parsed && typeof parsed === "object" && !Array.isArray(fallback) && !Array.isArray(parsed)) {
      return { ...fallback, ...parsed };
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeDraftToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A local draft is optional and must never block the admin workspace.
  }
}

export function clearDraftFromStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Draft cleanup is best-effort.
  }
}
