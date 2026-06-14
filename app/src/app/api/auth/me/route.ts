export const dynamic = 'force-dynamic';

/**
 * @fileoverview Current user profile endpoint.
 *
 * Returns the authenticated user's profile data.
 * Used by the client-side `useApi` hook on app initialization.
 *
 * @module api/auth/me
 */

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { AuthService } from '@/services/auth.service';

/**
 * GET /api/auth/me
 *
 * Returns the current user's profile.
 *
 * @security Requires valid access token in cookies.
 */
export const GET = withAuth<any>(async (_request, { userId }) => {
    const profile = await AuthService.getProfile(userId);
    return NextResponse.json({ user: profile });
});
