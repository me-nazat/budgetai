/**
 * @fileoverview In-memory account lockout to prevent brute-force attacks.
 *
 * Tracks failed login attempts per IP address using an in-memory Map.
 * After 5 consecutive failures within 10 minutes, the IP is blocked
 * for 15 minutes.
 *
 * @security
 * - IP-based tracking prevents credential stuffing at scale.
 * - In-memory store resets on cold starts (acceptable for serverless).
 * - TTL cleanup prevents memory leaks.
 *
 * @module lib/security/account-lockout
 */

/** Maximum consecutive failed attempts before lockout. */
const MAX_ATTEMPTS = 5;

/** Window in ms for counting failures (10 minutes). */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

/** Lockout duration in ms (15 minutes). */
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

interface LockoutEntry {
  /** Number of consecutive failed attempts. */
  failCount: number;
  /** Timestamp of the first failure in the current window. */
  windowStart: number;
  /** Timestamp when the lockout expires (0 = not locked). */
  lockedUntil: number;
}

const store = new Map<string, LockoutEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leaks
if (typeof globalThis !== 'undefined') {
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      // Remove entries whose lockout has expired AND window has passed
      if (
        now > entry.lockedUntil &&
        now > entry.windowStart + ATTEMPT_WINDOW_MS
      ) {
        store.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  cleanup.unref?.();
}

/**
 * Checks whether the given IP is currently locked out.
 *
 * @param ip - The client IP address.
 * @returns An object with `locked` status and optional `retryAfterMs`.
 */
export function isLockedOut(ip: string): {
  locked: boolean;
  retryAfterMs: number;
} {
  const entry = store.get(ip);
  if (!entry) return { locked: false, retryAfterMs: 0 };

  const now = Date.now();

  if (entry.lockedUntil > now) {
    return {
      locked: true,
      retryAfterMs: entry.lockedUntil - now,
    };
  }

  // Lockout expired — reset if window also expired
  if (now > entry.windowStart + ATTEMPT_WINDOW_MS) {
    store.delete(ip);
  }

  return { locked: false, retryAfterMs: 0 };
}

/**
 * Records a failed login attempt for the given IP.
 * Triggers lockout if the threshold is reached.
 *
 * @param ip - The client IP address.
 */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.windowStart + ATTEMPT_WINDOW_MS) {
    // Start a new window
    store.set(ip, {
      failCount: 1,
      windowStart: now,
      lockedUntil: 0,
    });
    return;
  }

  entry.failCount++;

  if (entry.failCount >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
}

/**
 * Clears the failure record for the given IP (called on successful login).
 *
 * @param ip - The client IP address.
 */
export function clearFailedAttempts(ip: string): void {
  store.delete(ip);
}
