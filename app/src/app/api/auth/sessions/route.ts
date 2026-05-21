/**
 * @fileoverview Session management endpoint.
 *
 * Lists active sessions and allows revoking individual sessions
 * or all sessions at once.
 *
 * @module api/auth/sessions
 */

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { apiSuccess } from '@/lib/types/api';
import { withAuth } from '@/lib/middleware/with-auth';
import { UserRepository } from '@/repositories/user.repository';
import { AuditService } from '@/services/audit.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * GET /api/auth/sessions
 *
 * Lists all active sessions for the current user.
 * Useful for "active devices" UI.
 */
export const GET = apiHandler(
  withAuth(async (_request, { userId }) => {
    const sessions = await UserRepository.listActiveSessions(userId);

    // Strip sensitive token hashes from the response
    const sanitized = sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName || 'Unknown Device',
      ipAddress: s.ipAddress,
      lastUsedAt: s.lastUsedAt,
      createdAt: s.createdAt,
    }));

    return apiSuccess({ sessions: sanitized });
  })
);

/**
 * DELETE /api/auth/sessions
 *
 * Revokes all sessions for the current user (except the current one).
 * Used for "sign out everywhere" functionality.
 *
 * @security Audit-logged as a security event.
 */
export const DELETE = apiHandler(
  withAuth(async (request, { userId }) => {
    await UserRepository.revokeAllSessions(userId);

    const ip = getClientIP(request);
    AuditService.logAction({
      userId,
      action: 'LOGOUT',
      entityType: 'session',
      metadata: { scope: 'all_sessions' },
      ip,
    });

    return apiSuccess({ message: 'All sessions revoked' });
  })
);
