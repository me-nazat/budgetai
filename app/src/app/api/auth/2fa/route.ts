/**
 * @fileoverview Two-Factor Authentication setup and management.
 *
 * Provides endpoints for setting up TOTP 2FA,
 * verifying setup with an authenticator code,
 * and disabling 2FA.
 *
 * @module api/auth/2fa
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { apiSuccess } from '@/lib/types/api';
import { withAuth } from '@/lib/middleware/with-auth';
import { AuthService } from '@/services/auth.service';
import { validateInput } from '@/lib/types/api';
import { TwoFactorSetupDTO } from '@/lib/types/dto';

/**
 * POST /api/auth/2fa
 *
 * Initiates TOTP 2FA setup. Returns the QR code URI
 * and backup codes. The user must verify the setup
 * by calling PUT with a valid TOTP code.
 *
 * @security Requires authentication.
 */
export const POST = apiHandler(
  withAuth(async (_request, { userId }) => {
    const setup = await AuthService.setupTOTP(userId);
    return apiSuccess({
      uri: setup.uri,
      backupCodes: setup.backupCodes,
    });
  })
);

/**
 * PUT /api/auth/2fa
 *
 * Confirms TOTP setup by verifying a code from the authenticator.
 * After this call succeeds, 2FA is fully enabled.
 *
 * @security
 * - Requires authentication.
 * - Requires a valid TOTP code to confirm setup.
 */
export const PUT = apiHandler(
  withAuth(async (request, { userId }) => {
    const body = await request.json();
    const validated = validateInput(TwoFactorSetupDTO, body);

    // In a real implementation, the secret would come from a temporary store
    // For now, the setup flow handles this via the service
    await AuthService.confirmTOTPSetup(
      userId,
      validated.verificationCode,
      body.secret || '',
      body.backupCodes || []
    );

    return apiSuccess({ message: '2FA enabled successfully' });
  })
);
