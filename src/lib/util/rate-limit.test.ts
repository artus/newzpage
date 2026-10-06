import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientAddress, RateLimiter } from "./rate-limit";

describe("RateLimiter", () => {
  it("allows a burst, then admits at the refill rate", () => {
    const limiter = new RateLimiter(3, 0.5);
    for (let i = 0; i < 3; i++) assert.deepEqual(limiter.take("a", 0), { ok: true });
    assert.deepEqual(limiter.take("a", 0), { ok: false, retryAfterSeconds: 2 });
    assert.deepEqual(limiter.take("a", 1000), { ok: false, retryAfterSeconds: 1 }, "half a token has come back");
    assert.deepEqual(limiter.take("a", 2000), { ok: true });
    assert.deepEqual(limiter.take("b", 2000), { ok: true }, "each client has a bucket of its own");
  });

  it("never refills beyond its capacity", () => {
    const limiter = new RateLimiter(2, 1);
    limiter.take("a", 0);
    assert.deepEqual(limiter.take("a", 60_000), { ok: true });
    assert.deepEqual(limiter.take("a", 60_000), { ok: true });
    assert.equal(limiter.take("a", 60_000).ok, false);
  });

  it("forgets the least recently seen clients beyond its bound", () => {
    const limiter = new RateLimiter(1, 0.001, 2);
    limiter.take("a", 0);
    limiter.take("b", 0);
    limiter.take("c", 0);
    assert.equal(limiter.take("a", 0).ok, true, "a was forgotten and starts with a full bucket");
    assert.equal(limiter.take("c", 0).ok, false);
  });
});

describe("clientAddress", () => {
  it("prefers the proxy's real address, then the first forwarded one", () => {
    assert.equal(clientAddress(new Headers({ "x-real-ip": "203.0.113.7", "x-forwarded-for": "198.51.100.1" })), "203.0.113.7");
    assert.equal(clientAddress(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" })), "198.51.100.1");
    assert.equal(clientAddress(new Headers()), "unknown");
  });
});
