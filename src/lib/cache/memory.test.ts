import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryCache } from "./memory";

describe("MemoryCache", () => {
  it("expires entries and evicts the least recently used", () => {
    const cache = new MemoryCache<string>(2);
    cache.set("a", "A", 100, 0);
    cache.set("b", "B", 100, 0);
    assert.equal(cache.get("a", 50), "A");
    cache.set("c", "C", 100, 0);
    assert.equal(cache.get("b", 50), undefined, "b was the least recently used");
    assert.equal(cache.get("a", 50), "A");
    assert.equal(cache.get("c", 50), "C");
    assert.equal(cache.get("a", 150), undefined, "expired");
    assert.equal(cache.size, 1);
  });
});
