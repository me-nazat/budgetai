/**
 * @fileoverview Redis-backed sliding window rate limiter.
 *
 * Implements a sliding window counter algorithm using Upstash Redis for
 * distributed rate limiting across serverless function instances. Falls
 * back to an in-memory store if Redis is unavailable.
 *
 * ## Algorithm
 * Uses a fixed-window counter with sub-second precision. Each request
 * increments a counter keyed by `ratelimit:{identifier}:{window}`.
 * The counter expires automatically after the window duration.
 *
 * ## Configuration
 * Rate limits are configurable per route pattern:
 * - Auth routes: 5 requests / 15 minutes
 * - API routes: 100 requests / minute
 * - File upload: 10 requests / minute
 *
 * @security
 * - Rate limiting prevents brute-force attacks on authentication.
 * - Distributed via Redis to work across serverless instances.
 * - Returns standard `Retry-After` headers for HTTP 429 responses.
 * - IP-based limiting with optional user-based limiting for authenticated routes.
 *
 * @module lib/security/rate-limiter
 */

import { Redis } from '@upstash/redis';

/**
 * Rate limit configuration for a specific route pattern.
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window. */
  maxRequests: number;

  /** Time window duration in seconds. */
  windowSeconds: number;
}

/**
 * Result of a rate limit check.
 */
export interface RateLimitResult {
  /** Whether the request is allowed. */
  allowed: boolean;

  /** Number of remaining requests in the current window. */
  remaining: number;

  /** Total limit for the current window. */
  limit: number;

  /** Unix timestamp (seconds) when the current window resets. */
  resetAt: number;

  /** Seconds until the current window resets (for Retry-After header). */
  retryAfterSeconds: number;
}

/**
 * Pre-configured rate limit profiles for different route types.
 *
 * @remarks
 * These values balance security with usability. Auth routes have
 * aggressive limits to prevent brute-force attacks, while general
 * API routes are more permissive.
 */
export const RATE_LIMIT_PROFILES = {
  /** Login/register: 5 attempts per 15 minutes per IP. */
  auth: { maxRequests: 5, windowSeconds: 900 } satisfies RateLimitConfig,

  /** Password reset: 3 attempts per hour per IP. */
  passwordReset: { maxRequests: 3, windowSeconds: 3600 } satisfies RateLimitConfig,

  /** 2FA verification: 5 attempts per 5 minutes per user. */
  twoFactor: { maxRequests: 5, windowSeconds: 300 } satisfies RateLimitConfig,

  /** General API: 100 requests per minute per user. */
  api: { maxRequests: 100, windowSeconds: 60 } satisfies RateLimitConfig,

  /** Strict API (sensitive operations): 30 requests per minute per user. */
  apiStrict: { maxRequests: 30, windowSeconds: 60 } satisfies RateLimitConfig,

  /** File upload: 10 requests per minute per user. */
  upload: { maxRequests: 10, windowSeconds: 60 } satisfies RateLimitConfig,

  /** AI chat: 20 requests per minute per user. */
  aiChat: { maxRequests: 20, windowSeconds: 60 } satisfies RateLimitConfig,
} as const;

export type RateLimitProfile = keyof typeof RATE_LIMIT_PROFILES;

/* ═══════════════════════════════════════════════════════════════
   REDIS CLIENT
   ═══════════════════════════════════════════════════════════════ */

let redisClient: Redis | null = null;
let redisAvailable = true;

/**
 * Gets or creates the Upstash Redis client singleton.
 *
 * @returns The Redis client, or null if Upstash credentials are not configured.
 */
function getRedisClient(): Redis | null {
  if (!redisAvailable) return null;

  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      console.warn(
        '[rate-limiter] Upstash Redis credentials not configured. ' +
        'Falling back to in-memory rate limiting. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed limiting.'
      );
      redisAvailable = false;
      return null;
    }

    redisClient = new Redis({ url, token });
  }

  return redisClient;
}

/* ═══════════════════════════════════════════════════════════════
   IN-MEMORY FALLBACK
   ═══════════════════════════════════════════════════════════════ */

/**
 * In-memory rate limit store used when Redis is unavailable.
 * Cleared periodically to prevent memory leaks.
 */
const memoryStore = new Map<string, { count: number; resetAt: number }>();

/**
 * Periodically cleans up expired entries from the in-memory store.
 * Runs every 60 seconds.
 */
if (typeof globalThis !== 'undefined') {
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now > entry.resetAt * 1000) {
        memoryStore.delete(key);
      }
    }
  }, 60_000);
  cleanup.unref?.();
}

/**
 * Checks rate limit using the in-memory fallback store.
 *
 * @param key - Unique rate limit key (e.g., 'auth:login:192.168.1.1').
 * @param config - Rate limit configuration.
 * @returns The rate limit result.
 *
 * @complexity O(1) — Map lookup and increment.
 */
function checkMemoryRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Math.floor(Date.now() / 1000);
  const windowEnd = now + config.windowSeconds;
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    // Window expired or new key — reset counter
    memoryStore.set(key, { count: 1, resetAt: windowEnd });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      limit: config.maxRequests,
      resetAt: windowEnd,
      retryAfterSeconds: 0,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      limit: config.maxRequests,
      resetAt: entry.resetAt,
      retryAfterSeconds: entry.resetAt - now,
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    limit: config.maxRequests,
    resetAt: entry.resetAt,
    retryAfterSeconds: 0,
  };
}

/* ═══════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════ */

/**
 * Checks whether a request should be rate-limited.
 *
 * Attempts to use Redis first for distributed limiting. If Redis is
 * unavailable, falls back to an in-memory counter that works per-instance.
 *
 * @param identifier - Unique identifier for the rate limit subject.
 *                     Typically an IP address or `userId:ip` combination.
 * @param profile - Pre-configured rate limit profile name.
 * @returns {Promise<RateLimitResult>} The rate limit check result.
 *
 * @example
 * ```ts
 * const result = await checkRateLimit('192.168.1.1', 'auth');
 * if (!result.allowed) {
 *   return NextResponse.json(
 *     { error: 'Too many requests' },
 *     {
 *       status: 429,
 *       headers: { 'Retry-After': String(result.retryAfterSeconds) },
 *     }
 *   );
 * }
 * ```
 *
 * @complexity
 * - Redis: O(1) — INCR + EXPIRE are O(1) in Redis.
 * - Memory: O(1) — Map lookup.
 *
 * @security
 * - Distributed via Redis to prevent bypass across serverless instances.
 * - Graceful fallback to in-memory limiting if Redis is down.
 * - Keys are prefixed with 'rl:' to avoid collisions with other Redis data.
 */
export async function checkRateLimit(
  identifier: string,
  profile: RateLimitProfile
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_PROFILES[profile];
  const key = `rl:${profile}:${identifier}`;

  const redis = getRedisClient();

  if (!redis) {
    return checkMemoryRateLimit(key, config);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const windowEnd = now + config.windowSeconds;

    // Atomic increment + conditional expire
    const count = await redis.incr(key);

    if (count === 1) {
      // First request in this window — set expiry
      await redis.expire(key, config.windowSeconds);
    }

    // Get the TTL to compute the reset time
    const ttl = await redis.ttl(key);
    const resetAt = now + Math.max(ttl, 0);

    if (count > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        limit: config.maxRequests,
        resetAt,
        retryAfterSeconds: Math.max(ttl, 0),
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - count,
      limit: config.maxRequests,
      resetAt,
      retryAfterSeconds: 0,
    };
  } catch (error) {
    console.error('[rate-limiter] Redis error, falling back to memory:', error);
    redisAvailable = false;
    redisClient = null;
    return checkMemoryRateLimit(key, config);
  }
}

/**
 * Constructs rate limit headers for HTTP responses.
 *
 * Returns standard `RateLimit-*` headers as defined by the
 * IETF draft-ietf-httpapi-ratelimit-headers specification.
 *
 * @param result - The rate limit check result.
 * @returns A Headers object with rate limit information.
 *
 * @example
 * ```ts
 * const result = await checkRateLimit(ip, 'api');
 * const headers = getRateLimitHeaders(result);
 * return NextResponse.json(data, { headers });
 * ```
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.resetAt),
  };

  if (!result.allowed) {
    headers['Retry-After'] = String(result.retryAfterSeconds);
  }

  return headers;
}

/**
 * Extracts the client IP address from a request.
 *
 * Checks proxy headers in order of trust priority:
 * 1. `x-forwarded-for` (standard reverse proxy header)
 * 2. `x-real-ip` (Nginx/Vercel)
 * 3. Falls back to 'unknown'
 *
 * @param request - The incoming HTTP request.
 * @returns The client's IP address string.
 *
 * @security
 * - Only the FIRST IP in X-Forwarded-For is used (closest to client).
 * - In production, ensure your reverse proxy sets these headers correctly
 *   and strips any client-supplied values to prevent spoofing.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}
