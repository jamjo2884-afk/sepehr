/**
 * Simple in-memory rate limiter for API routes.
 *
 * Uses a sliding window counter per key (typically IP address).
 * Not suitable for distributed deployments — for production,
 * replace with Redis-backed or Upstash rate limiting.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000);

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check rate limit for a given key.
 * Returns whether the request is allowed and metadata.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    // New window
    store.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt: now + config.windowMs,
    };
  }

  // Existing window
  entry.count += 1;
  const allowed = entry.count <= config.maxRequests;
  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// Pre-defined rate limit configs for common endpoints
export const RATE_LIMITS = {
  /** Sync operations — expensive, limit to 10 per minute */
  sync: { maxRequests: 10, windowMs: 60_000 },
  /** Import operations — very expensive, limit to 5 per 5 minutes */
  import: { maxRequests: 5, windowMs: 300_000 },
  /** Bulk edit — limit to 20 per minute */
  bulkEdit: { maxRequests: 20, windowMs: 60_000 },
  /** General API — limit to 100 per minute */
  default: { maxRequests: 100, windowMs: 60_000 },
} as const;
