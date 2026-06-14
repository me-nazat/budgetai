export const dynamic = 'force-dynamic';

/**
 * @fileoverview Token refresh endpoint.
 *
 * Implements refresh token rotation: exchanges a valid refresh token
 * for a new access token and a new refresh token. The old refresh
 * token is invalidated immediately.
 *
 * @module api/auth/refresh
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * POST /api/auth/refresh
 *
 * Refreshes the access token using a valid refresh token cookie.
 * Implements token rotation for security.
 *
 * @security
 * - Rate limited to prevent token abuse.
 * - Refresh tokens are one-time use (rotated on each refresh).
 * - Expired/revoked tokens return 401.
 */
export const POST = apiHandler(
  async (request: NextRequest) => {
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    const result = await AuthService.refresh({ ip, userAgent, request });

    return NextResponse.json({ user: result.user });
  },
  { rateLimit: 'api' }
);
