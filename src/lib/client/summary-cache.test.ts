import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ArticleRecord } from "@/lib/edition/types";
import { SUMMARIZER_VERSION } from "@/lib/summarize/types";
import { MemoryStorage } from "./storage";
import { SUMMARY_INDEX_KEY, SummaryCache } from "./summary-cache";

const record = (n: number, extra: Partial<ArticleRecord> = {}): ArticleRecord => ({
  url: `https://example.org/article-${n}`,
  version: SUMMARIZER_VERSION,
  fetchedAt: 0,
  source: "page",
  lang: "en",
  analysis: { version: SUMMARIZER_VERSION, lang: "en", sentences: [{ i: 0, p: 0, text: "x".repeat(200), words: 30, score: 1 }], pick: [0], totalWords: 30, totalSentences: 1 },
  wordCount: 30,
  expiresAt: 1_000_000,
  ...extra,
});

describe("SummaryCache", () => {
  it("stores and returns records, honouring expiry and the summariser version", () => {
    const storage = new MemoryStorage();
    const cache = new SummaryCache(storage);
    assert.equal(cache.set(record(1), 10), true);
    assert.equal(cache.get("https://example.org/article-1", 20)?.url, "https://example.org/article-1");
    assert.equal(cache.get("https://example.org/article-1", 2_000_000), undefined, "expired");
    cache.set(record(2, { version: SUMMARIZER_VERSION - 1 }), 10);
    assert.equal(cache.get("https://example.org/article-2", 20), undefined, "old version");
    assert.equal(cache.stats().entries, 0);
  });

  it("keeps at most maxEntries, dropping the least recently used", () => {
    const cache = new SummaryCache(new MemoryStorage(), { maxEntries: 3, maxBytes: 10_000_000 });
    for (let n = 1; n <= 3; n++) cache.set(record(n), n);
    cache.get("https://example.org/article-1", 10); // article 1 is now the most recently used
    cache.set(record(4), 11);
    assert.equal(cache.stats().entries, 3);
    assert.equal(cache.get("https://example.org/article-2", 12), undefined, "the least recently used went");
    assert.ok(cache.get("https://example.org/article-1", 12));
    assert.ok(cache.get("https://example.org/article-4", 12));
  });

  it("keeps the total size under maxBytes", () => {
    const cache = new SummaryCache(new MemoryStorage(), { maxEntries: 1000, maxBytes: 12_000 });
    for (let n = 1; n <= 20; n++) assert.equal(cache.set(record(n), n), true, `set ${n}`);
    const stats = cache.stats();
    assert.ok(stats.bytes <= 12_000, `bytes ${stats.bytes}`);
    assert.ok(stats.entries >= 2 && stats.entries < 20, `entries ${stats.entries}`);
    assert.ok(cache.get("https://example.org/article-20", 30), "the newest entry survives");
  });

  it("recovers when the browser reports a full quota", () => {
    const storage = new MemoryStorage(6_000);
    const cache = new SummaryCache(storage, { maxEntries: 1000, maxBytes: 10_000_000 });
    for (let n = 1; n <= 12; n++) assert.equal(cache.set(record(n), n), true, `set ${n}`);
    assert.ok(cache.get("https://example.org/article-12", 20), "newest survives quota pressure");
    assert.ok(cache.stats().entries < 12, "older entries were evicted to make room");
    const index = JSON.parse(storage.getItem(SUMMARY_INDEX_KEY)!);
    assert.equal(Object.keys(index).length, cache.stats().entries, "index matches what is stored");
  });

  it("never stores a record without copy, so failures are retried", () => {
    const cache = new SummaryCache(new MemoryStorage());
    assert.equal(cache.set(record(1, { source: "none", analysis: null, error: "HTTP 403" }), 10), false);
    assert.equal(cache.set(record(2, { analysis: { version: SUMMARIZER_VERSION, lang: "en", sentences: [], pick: [], totalWords: 0, totalSentences: 0 } }), 10), false);
    assert.equal(cache.stats().entries, 0);
    assert.equal(cache.get("https://example.org/article-1", 20), undefined);
  });

  it("survives a corrupt index and clears completely", () => {
    const storage = new MemoryStorage();
    storage.setItem(SUMMARY_INDEX_KEY, "{not json");
    const cache = new SummaryCache(storage);
    assert.equal(cache.get("https://example.org/article-1"), undefined);
    cache.set(record(1), 1);
    cache.clear();
    assert.equal(cache.stats().entries, 0);
    assert.deepEqual(storage.keys(), []);
  });
});
