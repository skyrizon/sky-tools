/**
 * Fixed-window rate limiter kept in memory. On serverless hosts each instance
 * has its own memory, so this caps bursts from one visitor rather than being a
 * global guarantee — enough to stop someone flooding the Discord webhook.
 */
export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return function check(key: string): { ok: boolean; retryAfterSeconds: number } {
    const now = Date.now();

    // Drop expired entries now and then so the map can't grow forever.
    if (hits.size > 5000) {
      for (const [k, entry] of hits) if (entry.resetAt <= now) hits.delete(k);
    }

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, retryAfterSeconds: 0 };
    }
    if (entry.count >= limit) {
      return { ok: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { ok: true, retryAfterSeconds: 0 };
  };
}

/** Best-effort client IP from the proxy headers Vercel sets. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
