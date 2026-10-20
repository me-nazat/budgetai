export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { TransactionService } from '@/services/transaction.service';
import { clampPaginationLimit, clampPaginationOffset } from '@/lib/validation';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);

    // Multi-facet filter parameters
    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const month = searchParams.get('month') || undefined;
    const startDate = searchParams.get('startDate') || searchParams.get('start') || undefined;
    const endDate = searchParams.get('endDate') || searchParams.get('end') || undefined;
    const category = searchParams.get('category') || undefined;
    const categories = searchParams.get('categories') || undefined;
    const type = (searchParams.get('type') as any) || undefined;
    const accountId = searchParams.get('accountId')
      ? parseInt(searchParams.get('accountId')!, 10)
      : undefined;
    const accountIds = searchParams.get('accountIds') || undefined;

    const minAmount = searchParams.get('minAmount')
      ? parseFloat(searchParams.get('minAmount')!)
      : undefined;
    const maxAmount = searchParams.get('maxAmount')
      ? parseFloat(searchParams.get('maxAmount')!)
      : undefined;

    const taxDeductible = searchParams.get('taxDeductible') as 'true' | 'false' | undefined;
    const hasAttachment = (searchParams.get('hasAttachment') || searchParams.get('hasAttachments')) as 'true' | 'false' | undefined;
    const status = searchParams.get('status') as any;
    const sort = searchParams.get('sort') || searchParams.get('sortBy') || undefined;

    const pageParam = searchParams.get('page');
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : undefined;
    const limit = clampPaginationLimit(searchParams.get('limit') || '200');
    const offset = searchParams.get('offset')
      ? clampPaginationOffset(searchParams.get('offset')!)
      : (page ? (page - 1) * limit : 0);

    const result = await TransactionService.getAll(userId, {
      search: q,
      q,
      month,
      startDate,
      endDate,
      start: startDate,
      end: endDate,
      category,
      categories,
      type,
      accountId: isNaN(accountId!) ? undefined : accountId,
      accountIds,
      minAmount: isNaN(minAmount!) ? undefined : minAmount,
      maxAmount: isNaN(maxAmount!) ? undefined : maxAmount,
      taxDeductible,
      hasAttachment,
      hasAttachments: hasAttachment,
      status,
      sort,
      sortBy: sort as any,
      limit,
      offset,
      page,
    });

    const summary = {
      totalCount: result.filterSummary.totalCount,
      totalInflow: result.filterSummary.totalInflow ?? result.filterSummary.totalInflows,
      totalOutflow: result.filterSummary.totalOutflow ?? result.filterSummary.totalOutflows,
      netCashflow: result.filterSummary.netCashflow,
      averageTransactionAmount: result.filterSummary.averageTransactionAmount,
    };

    return NextResponse.json({
      transactions: result.transactions,
      total: result.total,
      summary,
      filterSummary: result.filterSummary,
    });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    const newTx = await TransactionService.create(userId, body, { ip, userAgent });

    // Module 15: Real-Time Micro-Savings Round-Up Processing
    if (newTx && newTx.amount > 0 && newTx.type === 'expense') {
      try {
        const { db } = await import('@/db/client');
        const { roundUpRules, roundUpTransfers } = await import('@/db/schema');
        const { eq, and } = await import('drizzle-orm');
        const { calculateRoundUp } = await import('@/lib/finance/roundUpEngine');

        const [activeRule] = await db
          .select()
          .from(roundUpRules)
          .where(and(eq(roundUpRules.userId, userId), eq(roundUpRules.isActive, 1)))
          .limit(1);

        if (activeRule) {
          const { rawDelta, multipliedAmount } = calculateRoundUp(newTx.amount, activeRule.multiplier);
          if (multipliedAmount > 0) {
            await db.insert(roundUpTransfers).values({
              id: `rut_${crypto.randomUUID()}`,
              ruleId: activeRule.id,
              transactionId: newTx.id,
              rawDelta,
              multipliedAmount,
              status: 'PENDING',
            });
          }
        }
      } catch (err) {
        console.warn('Micro-savings round-up calculation skipped:', err);
      }
    }

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

export const PATCH = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;

    // Bulk actions: { ids: string[] | number[], action: 'categorize' | 'mark_cleared' | 'mark_tax_deductible' | 'delete', payload?: any }
    if (Array.isArray(body.ids) && body.ids.length > 0 && body.action) {
      const ids = body.ids.map(Number).filter((n: number) => !isNaN(n) && n > 0);
      if (body.action === 'categorize') {
        const category = typeof body.payload === 'string' ? body.payload : (body.category || body.payload?.category);
        if (!category) return NextResponse.json({ error: 'Category required' }, { status: 400 });
        const res = await TransactionService.bulkCategorize(userId, ids, category, { ip, userAgent });
        return NextResponse.json({ success: true, count: res.count });
      } else if (body.action === 'mark_cleared') {
        const { db } = await import('@/db/client');
        const { transactions } = await import('@/db/schema');
        const { inArray, and, eq } = await import('drizzle-orm');
        const updated = await db
          .update(transactions)
          .set({ status: 'cleared' })
          .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
          .returning();
        return NextResponse.json({ success: true, count: updated.length });
      } else if (body.action === 'mark_tax_deductible') {
        const isTax = body.payload !== undefined ? (body.payload ? 1 : 0) : 1;
        const { db } = await import('@/db/client');
        const { transactions } = await import('@/db/schema');
        const { inArray, and, eq } = await import('drizzle-orm');
        const updated = await db
          .update(transactions)
          .set({ taxDeductible: isTax })
          .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
          .returning();
        return NextResponse.json({ success: true, count: updated.length });
      } else if (body.action === 'delete') {
        const res = await TransactionService.deleteBulk(userId, ids, { ip, userAgent });
        return NextResponse.json({ success: true, count: res.count });
      }
    }

    // Single item update: { id, ...updates }
    const updatedTx = await TransactionService.patch(userId, body, { ip, userAgent });
    return NextResponse.json(updatedTx);
  })
);

export const DELETE = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;
    const { searchParams } = new URL(request.url);

    // 1. Check for bulk ids in query (?ids=1,2,3)
    const idsParam = searchParams.get('ids');
    if (idsParam) {
      const ids = idsParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      if (ids.length > 0) {
        const result = await TransactionService.deleteBulk(userId, ids, { ip, userAgent });
        return NextResponse.json({ success: true, count: result.count });
      }
    }

    // 2. Check for optional JSON body with { ids: number[] }
    if (request.headers.get('content-type')?.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      if (Array.isArray(body.ids) && body.ids.length > 0) {
        const ids = body.ids.map(Number).filter((n: number) => !isNaN(n) && n > 0);
        const result = await TransactionService.deleteBulk(userId, ids, { ip, userAgent });
        return NextResponse.json({ success: true, count: result.count });
      }
      if (body.id) {
        await TransactionService.delete(userId, Number(body.id), { ip, userAgent });
        return NextResponse.json({ success: true, count: 1 });
      }
    }

    // 3. Single id query (?id=123)
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID or IDs required' }, { status: 400 });

    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await TransactionService.delete(userId, numId, { ip, userAgent });
    return NextResponse.json({ success: true, count: 1 });
  })
);
