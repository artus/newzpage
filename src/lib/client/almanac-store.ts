import { browserStorage, writeJson, type StorageLike } from "./storage";

export const ALMANAC_KEY = "newzpage.almanac.v1";

/** Where the almanac is worked out for. Kept in this browser only. */
export interface AlmanacPlace {
  lat: number;
  lon: number;
  /** A name for the place, when one is known. */
  name?: string;
  /** The IANA zone to show the times in; the browser's own when absent. */
  timeZone?: string;
  /** Whether the browser gave the place or the reader picked a city. */
  source: "browser" | "city";
}

/** `null` means no place is set; `undefined` is what the server and a hydrating page see. */
export type AlmanacSnapshot = AlmanacPlace | null;

export function validPlace(value: unknown): value is AlmanacPlace {
  if (typeof value !== "object" || value === null) return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.lat === "number" &&
    Math.abs(place.lat) <= 90 &&
    typeof place.lon === "number" &&
    Math.abs(place.lon) <= 180 &&
    (place.name === undefined || typeof place.name === "string") &&
    (place.timeZone === undefined || typeof place.timeZone === "string") &&
    (place.source === "browser" || place.source === "city")
  );
}

let storage: StorageLike | undefined | null = null;
let cachedRaw: string | null | undefined;
let cachedSnapshot: AlmanacSnapshot = null;
const listeners = new Set<() => void>();

function store(): StorageLike | undefined {
  if (storage === null) storage = browserStorage();
  return storage;
}

/** Stable across calls while the stored text is unchanged, as useSyncExternalStore requires. */
export function getAlmanacSnapshot(): AlmanacSnapshot {
  let raw: string | null = null;
  try {
    raw = store()?.getItem(ALMANAC_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    cachedSnapshot = validPlace(parsed) ? parsed : null;
  } catch {
    cachedSnapshot = null;
  }
  return cachedSnapshot;
}

export function subscribeAlmanac(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === ALMANAC_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Keeps the place; returns false when the browser refuses to. */
export function saveAlmanacPlace(place: AlmanacPlace): boolean {
  const written = writeJson(store(), ALMANAC_KEY, place);
  for (const listener of listeners) listener();
  return written;
}

export function clearAlmanacPlace(): void {
  try {
    store()?.removeItem(ALMANAC_KEY);
  } catch {
    // nothing to do
  }
  for (const listener of listeners) listener();
}
