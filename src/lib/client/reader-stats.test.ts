import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { READER_KEY, readReaderStats, recordEdition, volumeOf } from "./reader-stats";
import { MemoryStorage } from "./storage";

describe("reader stats", () => {
  it("starts the record on the first edition and counts only editions with new stories", () => {
    const storage = new MemoryStorage();
    const first = recordEdition("abc", storage, new Date("2026-09-16T10:00:00Z"));
    assert.deepEqual(first, { since: "2026-09-16T10:00:00.000Z", editions: 1, fingerprint: "abc" });
    const same = recordEdition("abc", storage, new Date("2026-09-16T11:00:00Z"));
    assert.equal(same.editions, 1, "a reload with the same stories is the same edition");
    const second = recordEdition("def", storage, new Date("2026-09-17T10:00:00Z"));
    assert.equal(second.editions, 2);
    assert.equal(second.since, "2026-09-16T10:00:00.000Z", "the first visit is kept");
    assert.deepEqual(readReaderStats(storage), second);
  });

  it("recovers from a corrupt record", () => {
    const storage = new MemoryStorage();
    storage.setItem(READER_KEY, '{"since":"nope","editions":-3}');
    assert.equal(readReaderStats(storage), undefined);
    assert.equal(recordEdition("abc", storage).editions, 1);
  });

  it("counts volumes in months since the first edition", () => {
    const stats = { since: "2026-09-16T10:00:00.000Z", editions: 40 };
    assert.equal(volumeOf(stats, new Date("2026-09-20T00:00:00Z")), 1);
    assert.equal(volumeOf(stats, new Date("2026-10-15T00:00:00Z")), 1);
    assert.equal(volumeOf(stats, new Date("2026-10-16T00:00:00Z")), 2);
    assert.equal(volumeOf(stats, new Date("2026-12-01T00:00:00Z")), 3);
    assert.equal(volumeOf(stats, new Date("2027-09-16T00:00:00Z")), 13);
  });
});
