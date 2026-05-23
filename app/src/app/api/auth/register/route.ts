/**
 * @fileoverview Registration API route.
 *
 * Creates a new user account with hashed password,
 * sets session cookies, and creates a welcome notification.
 *
 * @module api/auth/register
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { NextResponse } from 'next/server';
import { AuthService } from '@/services/auth.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * POST /api/auth/register
 *
 * Registers a new user account.
 *
 * @security Rate limited: 5 attempts per 15 minutes per IP.
 */
export const POST = apiHandler(
  async (request: NextRequest) => {
    const body = await request.json();
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    const result = await AuthService.register(body, {
      ip,
      userAgent,
      request,
    });

    return NextResponse.json({ user: result.user }, { status: 201 });
  },
  { rateLimit: 'auth' }
);
