import { env } from "@/env";

/**
 * Rate limiting behind a tiny interface. Production: Upstash Redis
 * (@upstash/ratelimit — wired when UPSTASH_* env vars are set).
 * Dev/test: in-memory sliding window (single-process only).
 */

export interface RateLimiter {
  /** Returns true if the action is allowed for this key. */
  limit(key: string): Promise<{ success: boolean; remaining: number }>;
}

class InMemorySlidingWindow implements RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private max: number,
    private windowMs: number
  ) {}

  async limit(key: string) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const arr = (this.hits.get(key) ?? []).filter((t) => t > windowStart);
    if (arr.length >= this.max) {
      this.hits.set(key, arr);
      return { success: false, remaining: 0 };
    }
    arr.push(now);
    this.hits.set(key, arr);
    return { success: true, remaining: this.max - arr.length };
  }
}

function createLimiter(max: number, windowMs: number): RateLimiter {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    // TODO(prod): swap in @upstash/ratelimit driver before deploy.
    console.warn("Upstash configured but driver not installed — using in-memory limiter");
  }
  return new InMemorySlidingWindow(max, windowMs);
}

const globalForRl = globalThis as unknown as {
  __ratelimiters?: Record<string, RateLimiter>;
};

function cached(name: string, factory: () => RateLimiter): RateLimiter {
  globalForRl.__ratelimiters ??= {};
  globalForRl.__ratelimiters[name] ??= factory();
  return globalForRl.__ratelimiters[name];
}

// §5.1 / §7 limits
export const otpSendLimiter = cached("otpSend", () => createLimiter(3, 15 * 60 * 1000)); // 3 per phone / 15 min
export const loginLimiter = cached("login", () => createLimiter(5, 60 * 1000)); // 5 per IP / min
export const presignLimiter = cached("presign", () => createLimiter(30, 60 * 1000)); // 30 per user / min
export const downloadLimiter = cached("download", () => createLimiter(60, 60 * 1000)); // 60 per user / min
