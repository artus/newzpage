import type { ArticleRecord } from "@/lib/edition/types";
import { SUMMARIZER_VERSION } from "@/lib/summarize/types";
import { hashId } from "@/lib/util/hash";
import { readJson, type StorageLike } from "./storage";

export interface SummaryCacheOptions {
  /** Most entries kept; the least recently used go first. */
  maxEntries: number;
  /** Rough size of all entries in bytes (UTF-16, as browsers count it). */
  maxBytes: number;
}

interface IndexEntry {
  key: string;
  size: number;
  usedAt: number;
  expiresAt: number;
}

type Index = Record<string, IndexEntry>;

export const SUMMARY_INDEX_KEY = "newzpage.articles.index.v1";
const ENTRY_PREFIX = "newzpage.article.v1.";
const DEFAULT_TTL = 30 * 24 * 3600 * 1000;

/**
 * A rolling cache of article analyses in the reader's browser. Entries are keyed by article URL; an index
 * records size and last use so the cache can evict least-recently-used entries when it grows past its
 * limits or when the browser reports its quota is full. Reloading a page never re-summarises an article
 * that is still here.
 */
export class SummaryCache {
  private index: Index | undefined;
  private dirty = false;
  private readonly options: SummaryCacheOptions;

  constructor(
    private readonly storage: StorageLike,
    options: Partial<SummaryCacheOptions> = {},
  ) {
    this.options = { maxEntries: options.maxEntries ?? 400, maxBytes: options.maxBytes ?? 3_000_000 };
  }

  private load(): Index {
    if (!this.index) {
      const raw = readJson<Index>(this.storage, SUMMARY_INDEX_KEY);
      this.index = raw && typeof raw === "object" ? raw : {};
    }
    return this.index;
  }

  get(url: string, now = Date.now()): ArticleRecord | undefined {
    const index = this.load();
    const entry = index[url];
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.remove(url);
      return undefined;
    }
    const record = readJson<ArticleRecord>(this.storage, entry.key);
    if (!record || record.version !== SUMMARIZER_VERSION || record.url !== url) {
      this.remove(url);
      return undefined;
    }
    entry.usedAt = now;
    this.dirty = true;
    return record;
  }

  /** Stores a record, making room first; returns false when the browser would not keep it. */
  set(record: ArticleRecord, now = Date.now()): boolean {
    const index = this.load();
    const json = JSON.stringify(record);
    const size = (json.length + ENTRY_PREFIX.length + 12) * 2;
    if (size > this.options.maxBytes / 4) return false;
    this.remove(record.url);
    const entry: IndexEntry = { key: ENTRY_PREFIX + hashId(record.url), size, usedAt: now, expiresAt: record.expiresAt ?? now + DEFAULT_TTL };
    index[record.url] = entry;
    this.evict(record.url);
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        this.storage.setItem(entry.key, json);
        this.dirty = true;
        this.flush();
        return true;
      } catch {
        if (!this.evictSome(record.url, Math.max(1, Math.ceil(Object.keys(index).length / 10)))) break;
      }
    }
    delete index[record.url];
    this.dirty = true;
    this.flush();
    return false;
  }

  remove(url: string): void {
    const index = this.load();
    const entry = index[url];
    if (!entry) return;
    try {
      this.storage.removeItem(entry.key);
    } catch {
      // nothing to do; the index entry goes regardless
    }
    delete index[url];
    this.dirty = true;
  }

  /** Writes the index when reads have touched it; call after a page has been composed. */
  flush(): void {
    if (!this.dirty) return;
    const index = this.load();
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        this.storage.setItem(SUMMARY_INDEX_KEY, JSON.stringify(index));
        this.dirty = false;
        return;
      } catch {
        if (!this.evictSome(undefined, Math.max(1, Math.ceil(Object.keys(index).length / 10)))) return;
      }
    }
  }

  stats(): { entries: number; bytes: number } {
    const entries = Object.values(this.load());
    return { entries: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.size, 0) };
  }

  clear(): void {
    for (const url of Object.keys(this.load())) this.remove(url);
    try {
      this.storage.removeItem(SUMMARY_INDEX_KEY);
    } catch {
      // ignore
    }
    this.index = {};
    this.dirty = false;
  }

  /** Drops least-recently-used entries until the cache is within its limits; `keep` is never dropped. */
  private evict(keep: string | undefined): void {
    const index = this.load();
    const stats = () => this.stats();
    while (stats().entries > this.options.maxEntries || stats().bytes > this.options.maxBytes) {
      if (!this.evictSome(keep, 1)) break;
    }
    void index;
  }

  private evictSome(keep: string | undefined, count: number): boolean {
    const index = this.load();
    const victims = Object.entries(index)
      .filter(([url]) => url !== keep)
      .sort((a, b) => a[1].usedAt - b[1].usedAt)
      .slice(0, count);
    for (const [url] of victims) this.remove(url);
    return victims.length > 0;
  }
}
