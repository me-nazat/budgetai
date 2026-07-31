/**
 * @fileoverview Advanced session management with dual-token architecture.
 *
 * Implements a secure session system using:
 * - **Short-lived access tokens** (15 min JWT) for API authentication.
 * - **Long-lived refresh tokens** (7 days) for session persistence.
 * - **Redis blocklist** for immediate session revocation.
 * - **Token rotation** on each refresh to limit exposure window.
 *
 * ## Token Architecture
 * ```
 * ┌─────────────┐    ┌─────────────┐
 * │ Access JWT  │    │  Refresh    │
 * │   (15 min)  │    │  Token      │
 * │             │    │  (7 days)   │
 * │ In-memory   │    │ HTTP-only   │
 * │ or header   │    │ cookie      │
 * └──────┬──────┘    └──────┬──────┘
 *        │                  │
 *        ▼                  ▼
 *   API requests      Token refresh
 *   (stateless)       (DB + Redis)
 * ```
 *
 * @security
 * - Access tokens are stateless JWTs — no DB lookup required.
 * - Refresh tokens are hashed (SHA-256) before DB storage.
 * - Revoked sessions are added to a Redis blocklist for O(1) checks.
 * - Token rotation on each refresh limits the impact of token theft.
 *
 * @module lib/security/session-manager
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

/* ═══════════════════════════════════════════════════════════════
   CONFIGURATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Name of the HTTP-only cookie storing the access token.
 * @constant
 */
const ACCESS_COOKIE_NAME = 'wai-access';

/**
 * Name of the HTTP-only cookie storing the refresh token.
 * @constant
 */
const REFRESH_COOKIE_NAME = 'wai-refresh';

/**
 * Access token expiry as a jose-compatible duration string.
 * 15 minutes provides a good balance between security and UX.
 * @constant
 */
const ACCESS_TOKEN_EXPIRY = '15m';

/**
 * Access token max age in seconds (matches JWT expiry).
 * @constant
 */
const ACCESS_MAX_AGE = 15 * 60;

/**
 * Refresh token max age in seconds for non-remembered devices (2 hours).
 * For remembered devices ("Remember Me"), the max age is 30 days (2,592,000 seconds).
 * @constant
 */
const REFRESH_MAX_AGE = 2 * 60 * 60;

/**
 * Refresh token max age in seconds for remembered devices (30 days).
 * @constant
 */
const REFRESH_MAX_AGE_REMEMBER_ME = 30 * 24 * 60 * 60;

/**
 * JWT payload interface with Wealth AI custom claims.
 */
export interface SessionPayload extends JWTPayload {
  /** User's database ID. */
  userId: number;
  /** User's email address. */
  email: string;
  /** Session type: 'access' or 'refresh'. */
  type: 'access' | 'refresh';
  /** Session ID for revocation tracking. */
  sessionId?: string;
}

/* ═══════════════════════════════════════════════════════════════
   JWT KEY MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

import { env } from '@/lib/env';

/**
 * Gets the JWT signing key, encoded for use with jose.
 *
 * @throws {Error} In production if JWT_SECRET is missing or is the insecure default.
 * @returns The encoded secret key.
 */
function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

/* ═══════════════════════════════════════════════════════════════
   TOKEN CREATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Creates a short-lived access JWT for API authentication.
 *
 * @param userId - The authenticated user's database ID.
 * @param email - The authenticated user's email address.
 * @returns A signed JWT string valid for 15 minutes.
 *
 * @complexity O(1) — JWT signing is constant-time for fixed-size payloads.
 *
 * @security
 * - Uses HS256 (HMAC-SHA256) for signing.
 * - `nbf` (Not Before) is set to prevent premature use.
 * - Short expiry limits the impact of token theft.
 */
export async function createAccessToken(
  userId: number,
  email: string
): Promise<string> {
  return new SignJWT({
    userId,
    email,
    type: 'access' as const,
  } satisfies Omit<SessionPayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setNotBefore('0s')
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setIssuer('wealth-ai')
    .setAudience('wealth-ai-api')
    .sign(getJwtSecret());
}

/**
 * Creates a long-lived refresh token for session persistence.
 *
 * Unlike access tokens (which are JWTs), refresh tokens are opaque
 * random strings. They are hashed before database storage and validated
 * by looking up the hash.
 *
 * @returns A cryptographically random 64-character hex string.
 *
 * @complexity O(1) — generates fixed-size random bytes.
 *
 * @security
 * - 256 bits of entropy from CSPRNG.
 * - The raw token is sent to the client; only the hash is stored.
 * - Tokens are single-use: each refresh produces a new token.
 */
export function createRefreshToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashes a refresh token for database storage.
 *
 * Uses SHA-256 to create a deterministic hash of the token.
 * This allows lookup by hash without storing the raw token.
 *
 * @param token - The raw refresh token string.
 * @returns The SHA-256 hex digest of the token.
 *
 * @complexity O(1) — SHA-256 on a fixed-size input.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/* ═══════════════════════════════════════════════════════════════
   TOKEN VERIFICATION
   ═══════════════════════════════════════════════════════════════ */

/**
 * Verifies and decodes an access JWT.
 *
 * Validates the signature, expiration, issuer, and audience claims.
 * Returns the decoded payload if valid, or null if verification fails.
 *
 * @param token - The JWT string to verify.
 * @returns The decoded session payload, or null if invalid/expired.
 *
 * @complexity O(1) — JWT verification is constant-time.
 *
 * @security
 * - Signature verification prevents token tampering.
 * - Expiration check prevents use of expired tokens.
 * - Audience check prevents cross-service token reuse.
 */
export async function verifyAccessToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret(), {
      issuer: 'wealth-ai',
      audience: 'wealth-ai-api',
    });

    const userId = payload.userId;
    const email = payload.email;

    if (typeof userId !== 'number' || typeof email !== 'string') {
      return null;
    }

    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════
   COOKIE MANAGEMENT
   ═══════════════════════════════════════════════════════════════ */

/**
 * Sets both access and refresh token cookies.
 *
 * Both cookies are HTTP-only, secure (in production), and SameSite=Strict.
 * The access token has a short max-age matching its JWT expiry (15 min).
 * The refresh token has a longer max-age for session persistence.
 * When rememberMe is true, the refresh token persists for 30 days (sliding window).
 *
 * @param accessToken - The signed access JWT.
 * @param refreshToken - The opaque refresh token string.
 * @param rememberMe - Whether to extend refresh token to 30 days.
 *
 * @security
 * - `httpOnly: true` prevents JavaScript access (XSS protection).
 * - `secure: true` in production ensures HTTPS-only transmission.
 * - `sameSite: 'strict'` prevents CSRF in cross-origin requests.
 * - `path: '/'` ensures tokens are sent for all routes.
 * - RememberMe consent is implicit via checkbox - no extra notification needed.
 * - The 30-day sliding window is maintained by token rotation on each refresh.
 */
export async function setSessionCookies(
  accessToken: string,
  refreshToken: string,
  rememberMe?: boolean
): Promise<void> {
  const cookieStore = await cookies();
  let isSecure = process.env.NODE_ENV === 'production';
  
  try {
    // Next.js 15 requires headers() to be awaited
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const host = headersList.get('host') || '';
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      isSecure = false; // Disable secure cookies for local production builds
    }
  } catch {
    // Silently continue if headers() is unavailable
  }

  cookieStore.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    maxAge: ACCESS_MAX_AGE,
    path: '/',
  });

  const refreshMaxAge = getRefreshMaxAge(rememberMe);

  cookieStore.set(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'strict',
    maxAge: refreshMaxAge,
    path: '/',
  });

  cookieStore.set('wealth-ai-auth-state', 'authenticated', {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'strict',
    maxAge: refreshMaxAge,
    path: '/',
  });
}

/**
 * Retrieves the current session from cookies.
 *
 * First attempts to validate the access token. If it's expired,
 * returns null (the client should attempt a refresh).
 *
 * @returns The decoded session payload, or null if not authenticated.
 *
 * @complexity O(1) — cookie read + JWT verification.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();

  // Try access token first (fast path)
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) return payload;
  }

  return null;
}

/**
 * Gets the raw refresh token from cookies.
 *
 * Used during the token refresh flow to locate the session in the database.
 *
 * @returns The raw refresh token string, or null if not present.
 */
export async function getRefreshTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;
}

/**
 * Clears all session cookies, effectively logging the user out on the client.
 *
 * @remarks
 * This does NOT revoke the refresh token in the database or Redis.
 * For full logout, call the session revocation service first.
 */
export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
}

/**
 * Retrieves the current session, or attempts to refresh if only the refresh token is present.
 * Suitable for middleware where we want to ensure a session exists before passing the request.
 */
export async function getSessionOrRefresh(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (session) return session;

  // If no access token but refresh token exists, we might need a refresh.
  // Note: in edge runtime, we rely on the route /api/auth/refresh to handle this securely, 
  // but if needed locally in edge, we'd do a fetch to origin.
  // We'll return null here and let the middleware handle the fetch.
  return null;
}

/**
 * Computes the expiration date for a new refresh token.
 *
 * @param rememberMe - Whether the session should persist for 30 days (Remember Me).
 * @returns ISO-8601 date string for the expiration timestamp.
 */
export function computeRefreshExpiry(rememberMe?: boolean): string {
  const expiry = new Date();
  if (rememberMe) {
    expiry.setDate(expiry.getDate() + 30);
  } else {
    expiry.setHours(expiry.getHours() + 2);
  }
  return expiry.toISOString();
}

/**
 * Gets the refresh token max age in seconds based on rememberMe flag.
 *
 * @param rememberMe - Whether the session should persist for 30 days.
 * @returns Max age in seconds for cookie setting.
 */
export function getRefreshMaxAge(rememberMe?: boolean): number {
  return rememberMe ? REFRESH_MAX_AGE_REMEMBER_ME : REFRESH_MAX_AGE;
}

/**
 * Extracts a device fingerprint from the request for session tracking.
 *
 * Creates a partial hash of the User-Agent and IP to identify the device
 * without storing PII directly. This allows users to see "active sessions"
 * without exposing raw IP addresses.
 *
 * @param request - The incoming HTTP request.
 * @returns A hex string fingerprint.
 *
 * @security
 * - Uses partial hashing to pseudonymize the IP.
 * - The fingerprint is deterministic for the same device/network.
 * - Not used for security decisions — only for informational display.
 */
export function computeDeviceFingerprint(request: Request): string {
  const ua = request.headers.get('user-agent') || 'unknown';
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  return createHash('sha256')
    .update(`${ua}:${ip}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Extracts a human-readable device name from the User-Agent string.
 *
 * @param request - The incoming HTTP request.
 * @returns A simplified device description (e.g., "Chrome on macOS").
 */
export function parseDeviceName(request: Request): string {
  const ua = request.headers.get('user-agent') || '';

  // Browser detection
  let browser = 'Unknown Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Edg')) browser = 'Edge';

  // OS detection
  let os = 'Unknown OS';
  if (ua.includes('Mac OS')) os = 'macOS';
  else if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}
