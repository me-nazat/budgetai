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
    return NextResponse.json({ message: 'Logged out successfully' });
  })
);
