export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { TransactionService } from '@/services/transaction.service';
import { clampPaginationLimit, clampPaginationOffset } from '@/lib/validation';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const start = searchParams.get('start') || undefined;
    const end = searchParams.get('end') || undefined;
    const category = searchParams.get('category') || undefined;
    const type = searchParams.get('type') as any || undefined;
    const limit = clampPaginationLimit(searchParams.get('limit') || '100');
    const offset = clampPaginationOffset(searchParams.get('offset') || '0');
    const accountId = searchParams.get('accountId') ? parseInt(searchParams.get('accountId')!, 10) : undefined;

    const result = await TransactionService.getAll(userId, {
      start,
      end,
      category,
      type,
      limit,
      offset,
      accountId,
    });

    return NextResponse.json(result);
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    const newTx = await TransactionService.create(userId, body, { ip, userAgent });
    return NextResponse.json(newTx, { status: 201 });
  })
);

export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    const updatedTx = await TransactionService.update(userId, body, { ip, userAgent });
    return NextResponse.json(updatedTx);
  })
);

export const DELETE = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    await TransactionService.delete(userId, numId, { ip, userAgent });
    return NextResponse.json({ success: true });
  })
);
