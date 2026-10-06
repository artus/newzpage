interface Bucket {
  tokens: number;
  updatedAt: number;
}

export type Admission = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * A token bucket per client, kept in process memory: a full bucket allows a burst (a first front page asks for
 * dozens of articles at once), after which requests are admitted at the refill rate. On a serverless platform
 * each instance counts on its own, so this stops one client hammering an instance, not a distributed crowd.
 */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    readonly capacity: number,
    readonly refillPerSecond: number,
    private readonly maxClients = 10_000,
  ) {}

  take(client: string, now = Date.now()): Admission {
    const bucket = this.buckets.get(client) ?? { tokens: this.capacity, updatedAt: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + ((now - bucket.updatedAt) / 1000) * this.refillPerSecond);
    bucket.updatedAt = now;
    // Re-inserted so the map's order stays least recently seen first.
    this.buckets.delete(client);
    this.buckets.set(client, bucket);
    while (this.buckets.size > this.maxClients) {
      const oldest = this.buckets.keys().next().value;
      if (oldest === undefined) break;
      this.buckets.delete(oldest);
    }
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { ok: true };
    }
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((1 - bucket.tokens) / this.refillPerSecond)) };
  }
}

/**
 * The client's address as the platform's proxy reports it. Vercel overwrites these headers; a server reached
 * directly would take them from the client, so a self-hosted deployment belongs behind a proxy that sets them.
 */
export function clientAddress(headers: Headers): string {
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "unknown";
}
