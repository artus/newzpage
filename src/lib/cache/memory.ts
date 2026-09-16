interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * A small in-process cache with per-entry expiry and least-recently-used eviction. The server keeps no
 * user data; this only stops many readers (or tabs) from fetching the same feed or article repeatedly.
 */
export class MemoryCache<T> {
  private readonly entries = new Map<string, Entry<T>>();

  constructor(private readonly maxEntries: number) {}

  get(key: string, now = Date.now()): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: now + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }
}
