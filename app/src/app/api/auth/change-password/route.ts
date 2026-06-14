export const dynamic = 'force-dynamic';

/**
 * @fileoverview Change password endpoint.
 *
 * Allows authenticated users to change their password by verifying
 * their current password first. On success, all existing sessions
 * are revoked (forcing re-login on all devices).
 *
 * @module api/auth/change-password
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { AuthService } from '@/services/auth.service';
import { getClientIP } from '@/lib/security/rate-limiter';
import { z } from 'zod';
import { validateInput } from '@/lib/types/api';
import { passwordSchema } from '@/lib/types/dto';

const ChangePasswordDTO = z.object({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
}).refine(
  (data) => data.currentPassword !== data.newPassword,
  { message: 'New password must be different from the current password', path: ['newPassword'] }
);

/**
 * POST /api/auth/change-password
 *
 * Changes the authenticated user's password.
 * Requires the current password for verification.
 * Revokes all sessions on success.
 *
 * @security
 * - Requires authentication.
 * - Rate limited to prevent brute-force current-password guessing.
 * - All sessions are revoked after password change.
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const validated = validateInput(ChangePasswordDTO, body);

    await AuthService.changePassword(
      userId,
      validated.currentPassword,
      validated.newPassword
    );

    return NextResponse.json({
      message: 'Password changed successfully. Please log in again.',
    });
  }),
  { rateLimit: 'auth' }
);
