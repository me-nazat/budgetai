/**
 * @fileoverview Next.js Edge Middleware — Session auto-refresh & zero-trust auth guard.
 *
 * Intercepts all requests:
 * 1. Authenticated users visiting /login or /register redirect immediately to /dashboard.
 * 2. Unauthenticated requests to protected routes redirect cleanly to /login?redirect=<pathname>
 *    without flashing protected UI skeletons.
 * 3. Expired access tokens with valid 7-day refresh tokens refresh transparently in the background.
 *
 * @module middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ACCESS_COOKIE = 'wai-access';
const REFRESH_COOKIE = 'wai-refresh';

/** Auth entry paths where logged-in users should not linger. */
const AUTH_PAGES = ['/login', '/register'];

/** Public marketing paths that require no authentication. */
const PUBLIC_MARKETING_PATHS = ['/'];

/** API paths should not be intercepted by page navigation middleware. */
const API_PREFIX = '/api';

function getJwtSecretForEdge(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw && process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing in production runtime.');
  }
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
  const { pathname, searchParams } = request.nextUrl;

  // Skip static assets and internal Next.js requests
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Skip API routes — route-level handlers enforce withAuth
  if (pathname.startsWith(API_PREFIX)) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // Check if current user has an active or refreshable session
  let isAuthenticated = false;
  let refreshResponseCookies: string[] = [];

  if (accessToken) {
    isAuthenticated = await isAccessTokenValid(accessToken);
  }

  if (!isAuthenticated && refreshToken) {
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
        isAuthenticated = true;
        refreshResponseCookies = refreshResponse.headers.getSetCookie();
      }
    } catch (error) {
      console.error('[middleware] Token refresh failed:', error);
    }
  }

  // Case A: Authenticated user visiting /login or /register -> Redirect to /dashboard
  if (AUTH_PAGES.includes(pathname)) {
    if (isAuthenticated) {
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      const redirectUrl = new URL(redirectTo, request.url);
      const response = NextResponse.redirect(redirectUrl);
      for (const cookie of refreshResponseCookies) {
        response.headers.append('Set-Cookie', cookie);
      }
      return response;
    }
    return NextResponse.next();
  }

  // Case B: Public marketing landing page -> Allow access
  if (PUBLIC_MARKETING_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Case C: Authenticated user accessing protected routes -> Proceed and append any new refresh cookies
  if (isAuthenticated) {
    const response = NextResponse.next();
    for (const cookie of refreshResponseCookies) {
      response.headers.append('Set-Cookie', cookie);
    }
    return response;
  }

  // Case D: Unauthenticated request to protected routes -> Clean redirect to /login?redirect=<pathname>
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
