export const dynamic = 'force-dynamic';

/**
 * @fileoverview Logout endpoint.
 *
 * Revokes the current session's refresh token,
 * clears all authentication cookies, and logs the event.
 *
 * @module api/auth/logout
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { AuthService } from '@/services/auth.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * POST /api/auth/logout
 *
 * Logs out the current session.
 * Revokes the refresh token and clears session cookies.
 */
export const POST = apiHandler(
  withAuth<any>(async (request, { userId }) => {
    const ip = getClientIP(request);
    await AuthService.logout(userId, { ip });
    const response = NextResponse.json({ message: 'Logged out successfully' });
    // Clear auth state for cache warming
    response.headers.set('Set-Cookie', 'wealth-ai-auth-state=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
    return response;
  })
);
