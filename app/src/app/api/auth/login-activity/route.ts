export const dynamic = 'force-dynamic';

/**
 * @fileoverview Login activity timeline endpoint.
 *
 * Returns the last 20 login/logout events for the current user
 * from the existing audit_logs table. Also returns the current
 * session's token hash for "this device" identification.
 *
 * @module api/auth/login-activity
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { auditLogs } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import {
  getRefreshTokenFromCookie,
  hashRefreshToken,
} from '@/lib/security/session-manager';

/**
 * GET /api/auth/login-activity
 *
 * Returns the last 20 login-related audit log entries for the current user,
 * plus the current session's token hash for "this device" badge.
 *
 * @security Requires authentication.
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const loginActions = ['LOGIN', 'LOGIN_FAILED', 'LOGOUT'] as const;

    const events = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        ipAddress: auditLogs.ipAddress,
        userAgent: auditLogs.userAgent,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.userId, userId),
          inArray(auditLogs.action, [...loginActions])
        )
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(20);

    // Parse metadata JSON and extract device name from user agent
    const activity = events.map((event) => {
      let parsedMetadata: Record<string, unknown> = {};
      try {
        if (event.metadata) {
          parsedMetadata = JSON.parse(event.metadata) as Record<string, unknown>;
        }
      } catch {
        // Ignore malformed JSON
      }

      return {
        id: event.id,
        action: event.action,
        ipAddress: event.ipAddress || 'Unknown',
        deviceName: parseDeviceFromUA(event.userAgent),
        success: event.action !== 'LOGIN_FAILED',
        reason: parsedMetadata.reason as string | undefined,
        createdAt: event.createdAt,
      };
    });

    // Get current session's token hash for "this device" identification
    let currentTokenHash: string | null = null;
    try {
      const refreshToken = await getRefreshTokenFromCookie();
      if (refreshToken) {
        currentTokenHash = hashRefreshToken(refreshToken);
      }
    } catch {
      // Non-critical — just won't show "this device" badge
    }

    return NextResponse.json({
      activity,
      currentTokenHash,
    });
  })
);

/**
 * Extracts a human-readable device description from a User-Agent string.
 */
function parseDeviceFromUA(ua: string | null): string {
  if (!ua) return 'Unknown Device';

  // Browser detection
  let browser = 'Unknown Browser';
  if (ua.includes('Firefox/')) browser = 'Firefox';
  else if (ua.includes('Edg/')) browser = 'Edge';
  else if (ua.includes('Chrome/') && !ua.includes('Edg/')) browser = 'Chrome';
  else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

  // OS detection
  let os = 'Unknown OS';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
  else if (ua.includes('Linux') && !ua.includes('Android')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

  return `${browser} on ${os}`;
}
