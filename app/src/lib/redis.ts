import { Redis } from '@upstash/redis';

let redisClient: Redis | null = null;
let redisAvailable = true;

/**
 * Gets or creates the Upstash Redis client singleton.
 *
 * @returns The Redis client, or null if Upstash credentials are not configured.
 */
export function getRedisClient(): Redis | null {
  if (!redisAvailable) return null;

  if (!redisClient) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token || url.includes('your-chosen-instance') || token.includes('your_secure_rest_token_here')) {
      console.warn(
        '[redis] Upstash Redis credentials not configured or using placeholders. ' +
        'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for Redis functionality.'
      );
      redisAvailable = false;
      return null;
    }

    try {
      redisClient = new Redis({
        url,
        token,
      });
    } catch (error) {
      console.error('[redis] Failed to initialize Redis client:', error);
      redisAvailable = false;
      return null;
    }
  }

  return redisClient;
}

/**
 * Invalidate dashboard cache version for the user.
 * Increments `dashboard-version:${userId}` to trigger invalidation.
 */
export async function invalidateDashboardCache(userId: number | string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  try {
    const key = `dashboard-version:${userId}`;
    await redis.incr(key);
  } catch (error) {
    console.error(`[redis] Failed to invalidate dashboard cache for user ${userId}:`, error);
  }
}
