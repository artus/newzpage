import { normalizeConfig, type NewzpageConfig } from "@/lib/config-schema";
import { browserStorage, writeJson, type StorageLike } from "./storage";

export const CONFIG_KEY = "newzpage.config.v1";

/** `null` means this browser has nothing stored yet. */
export type ConfigSnapshot = NewzpageConfig | null;

let storage: StorageLike | undefined | null = null;
let cachedRaw: string | null | undefined;
let cachedSnapshot: ConfigSnapshot = null;
const listeners = new Set<() => void>();

function store(): StorageLike | undefined {
  if (storage === null) storage = browserStorage();
  return storage;
}

/** Stable across calls while the stored text is unchanged, as useSyncExternalStore requires. */
export function getConfigSnapshot(): ConfigSnapshot {
  let raw: string | null = null;
  try {
    raw = store()?.getItem(CONFIG_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    cachedSnapshot = raw ? normalizeConfig(JSON.parse(raw)) : null;
  } catch {
    cachedSnapshot = null;
  }
  return cachedSnapshot;
}

/** Notified on saves from this tab and on storage events from other tabs. */
export function subscribeConfig(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === CONFIG_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Writes the configuration; returns false when the browser refuses to keep it. */
export function saveConfig(config: NewzpageConfig): boolean {
  const written = writeJson(store(), CONFIG_KEY, config);
  for (const listener of listeners) listener();
  return written;
}

/** For tests and reset: forget the stored configuration. */
export function clearStoredConfig(): void {
  try {
    store()?.removeItem(CONFIG_KEY);
  } catch {
    // ignore
  }
  for (const listener of listeners) listener();
}
