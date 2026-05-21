/**
 * @fileoverview Current user profile endpoint.
 *
 * Returns the authenticated user's profile data.
 * Used by the client-side `useApi` hook on app initialization.
 *
 * @module api/auth/me
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { apiSuccess, apiError } from '@/lib/types/api';
import { withAuth } from '@/lib/middleware/with-auth';
import { AuthService } from '@/services/auth.service';

/**
 * GET /api/auth/me
 *
 * Returns the current user's profile.
 *
 * @security Requires valid access token in cookies.
 */
export const GET = apiHandler(
  withAuth(async (_request, { userId }) => {
    const profile = await AuthService.getProfile(userId);
    return apiSuccess({ user: profile });
  })
);
