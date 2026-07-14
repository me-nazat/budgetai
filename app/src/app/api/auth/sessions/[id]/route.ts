export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { UserRepository } from '@/repositories/user.repository';
import { AuditService } from '@/services/audit.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * DELETE /api/auth/sessions/[id]
 *
 * Revokes a specific session by its database ID.
 *
 * @security Requires authentication.
 */
export const DELETE = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const sessionId = parseInt(id, 10);

    if (isNaN(sessionId)) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
    }

    await UserRepository.revokeSessionById(sessionId, userId);

    const ip = getClientIP(request);
    AuditService.logAction({
      userId,
      action: 'SESSION_REVOKE',
      entityType: 'session',
      entityId: String(sessionId),
      ip,
    });

    return NextResponse.json({ message: 'Session revoked successfully' });
  })
);
