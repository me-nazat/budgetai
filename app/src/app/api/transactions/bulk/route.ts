export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { TransactionService } from '@/services/transaction.service';

/**
 * POST /api/transactions/bulk
 * Supports:
 * - { action: 'categorize', ids: number[], category: string }
 * - { action: 'move_account', ids: number[], targetAccountId: number }
 * - { action: 'delete', ids: number[] }
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    const action = body.action;
    const ids = Array.isArray(body.ids)
      ? body.ids.map(Number).filter((n: number) => !isNaN(n) && n > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No transaction IDs provided' }, { status: 400 });
    }

    if (action === 'categorize') {
      const category = (body.category || '').trim();
      if (!category) {
        return NextResponse.json({ error: 'Category is required' }, { status: 400 });
      }
      const result = await TransactionService.bulkCategorize(userId, ids, category, { ip, userAgent });
      return NextResponse.json({ success: true, count: result.count, action });
    }

    if (action === 'move_account') {
      const targetAccountId = Number(body.targetAccountId);
      if (!targetAccountId || isNaN(targetAccountId) || targetAccountId <= 0) {
        return NextResponse.json({ error: 'Valid targetAccountId is required' }, { status: 400 });
      }
      const result = await TransactionService.bulkMoveAccount(userId, ids, targetAccountId, { ip, userAgent });
      return NextResponse.json({ success: true, count: result.count, action });
    }

    if (action === 'delete') {
      const result = await TransactionService.deleteBulk(userId, ids, { ip, userAgent });
      return NextResponse.json({ success: true, count: result.count, action });
    }

    return NextResponse.json({ error: 'Invalid bulk action specified' }, { status: 400 });
  })
);
