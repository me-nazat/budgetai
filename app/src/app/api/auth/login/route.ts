export const dynamic = 'force-dynamic';

/**
 * @fileoverview Authentication API routes — login, register, refresh, logout, profile.
 *
 * Enterprise-grade auth endpoints using the layered architecture:
 * - apiHandler → rate limiting + error handling
 * - withAuth → JWT verification
 * - AuthService → business logic
 * - UserRepository → data access
 * - AuditService → compliance logging
 *
 * @module api/auth/login
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * POST /api/auth/login
 *
 * Authenticates a user with email and password.
 * Returns user profile and sets session cookies.
 * Supports 2FA flow if TOTP is enabled.
 *
 * @security
 * - Rate limited: 5 attempts per 15 minutes per IP.
 * - Generic error messages prevent user enumeration.
 * - Failed attempts are audit-logged.
 */
export const POST = apiHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    const result = await AuthService.login(body, {
      ip,
      userAgent,
      request,
    });

    if (result.requires2FA) {
        return NextResponse.json(
          {
            requires2FA: true,
            tempToken: result.tempToken,
            user: { id: result.user.id, email: result.user.email },
          },
          { status: 200 }
        );
    }

    return NextResponse.json({ user: result.user });
  },
  { rateLimit: 'auth' }
);
