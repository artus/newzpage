/** The subset of the Web Storage API the app uses, so caches can be tested without a browser. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** localStorage when it is available and writable (private windows and some embeds refuse it). */
export function browserStorage(): StorageLike | undefined {
  try {
    if (typeof window === "undefined") return undefined;
    const storage = window.localStorage;
    const probe = "__newzpage_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return undefined;
  }
}

export function readJson<T>(storage: StorageLike | undefined, key: string): T | undefined {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** Returns false instead of throwing when the browser refuses (quota, disabled storage). */
export function writeJson(storage: StorageLike | undefined, key: string, value: unknown): boolean {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return !!storage;
  } catch {
    return false;
  }
}

/** In-memory stand-in with an optional byte quota, for tests and for browsers without storage. */
export class MemoryStorage implements StorageLike {
  private readonly items = new Map<string, string>();

  constructor(private readonly quotaBytes = Infinity) {}

  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    const size = [...this.items].reduce((sum, [k, v]) => (k === key ? sum : sum + (k.length + v.length) * 2), 0) + (key.length + value.length) * 2;
    if (size > this.quotaBytes) {
      const error = new Error("QuotaExceededError");
      error.name = "QuotaExceededError";
      throw error;
    }
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.items.delete(key);
  }

  keys(): string[] {
    return [...this.items.keys()];
  }
}
