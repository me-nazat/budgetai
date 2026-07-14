export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { UserRepository } from '@/repositories/user.repository';
import { AuditService } from '@/services/audit.service';
import { getClientIP } from '@/lib/security/rate-limiter';

/**
 * GET /api/auth/passkeys
 *
 * Lists all active passkeys for the current user.
 */
export const GET = apiHandler(
  withAuth(async (_request, { userId }) => {
    const passkeys = await UserRepository.listPasskeys(userId);

    // Sanitize passkeys (do not return the raw public keys to client)
    const sanitized = passkeys.map((p) => ({
      id: p.id,
      name: p.name,
      createdAt: p.createdAt,
      lastUsedAt: p.lastUsedAt,
    }));

    return NextResponse.json({ passkeys: sanitized });
  })
);

/**
 * DELETE /api/auth/passkeys
 *
 * Deactivates a passkey for the current user by database ID.
 */
export const DELETE = apiHandler(
  withAuth(async (request, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { passkeyId } = body;

    const id = parseInt(passkeyId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid passkey ID' }, { status: 400 });
    }

    await UserRepository.deletePasskey(id, userId);

    const ip = getClientIP(request);
    AuditService.logAction({
      userId,
      action: 'DELETE',
      entityType: 'user',
      entityId: String(id),
      ip,
    });

    return NextResponse.json({ message: 'Passkey deleted successfully' });
  })
);
