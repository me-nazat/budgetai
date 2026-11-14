/**
 * @fileoverview Next.js Edge Middleware — Session auto-refresh.
 *
 * Intercepts all authenticated route requests. If the access token cookie
 * is missing/expired but a refresh token cookie exists, it calls the
 * refresh endpoint to obtain new tokens before the page loads.
 *
 * This ensures users stay logged in as long as their 7-day refresh token
 * is valid — even after closing the browser and returning hours later.
 *
 * @module middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ACCESS_COOKIE = 'wai-access';
const REFRESH_COOKIE = 'wai-refresh';

/** Public paths that don't require authentication. */
const PUBLIC_PATHS = ['/', '/login', '/register'];

/** API paths should not be intercepted by middleware. */
const API_PREFIX = '/api';

function getJwtSecretForEdge(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  return new TextEncoder().encode(
    raw || 'wealth-ai-default-secret-dev-only-not-for-production'
  );
}

/**
 * Quickly check if the access token is still valid (not expired).
 * This runs in the edge runtime — no DB calls, just JWT signature + expiry.
 */
async function isAccessTokenValid(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, getJwtSecretForEdge(), {
      issuer: 'wealth-ai',
      audience: 'wealth-ai-api',
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip public pages and API routes
  if (PUBLIC_PATHS.includes(pathname) || pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  // Skip static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // Case 1: Access token exists and is valid — proceed normally
  if (accessToken) {
    const valid = await isAccessTokenValid(accessToken);
    if (valid) {
      return NextResponse.next();
    }
  }

  // Case 2: No valid access token but refresh token exists — refresh silently
  if (refreshToken) {
    try {
      const origin = request.nextUrl.origin;
      const refreshResponse = await fetch(`${origin}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        },
      });

      if (refreshResponse.ok) {
        // Forward the Set-Cookie headers from the refresh response
        const response = NextResponse.next();
        const setCookieHeaders = refreshResponse.headers.getSetCookie();

        for (const cookie of setCookieHeaders) {
          response.headers.append('Set-Cookie', cookie);
        }

        return response;
      }
    } catch (error) {
      console.error('[middleware] Token refresh failed:', error);
    }
  }

  // Case 3: No valid tokens — redirect to login
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
