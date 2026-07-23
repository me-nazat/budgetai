export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { bankImportReviewQueue, transactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const items = await db
      .select()
      .from(bankImportReviewQueue)
      .where(and(eq(bankImportReviewQueue.userId, userId), eq(bankImportReviewQueue.resolution, 'pending')));

    return NextResponse.json({ items });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { reviewItemId, resolution } = body;

    if (!reviewItemId || !resolution || !['kept_both', 'merged', 'discarded'].includes(resolution)) {
      return NextResponse.json({ error: 'Valid reviewItemId and resolution are required' }, { status: 400 });
    }

    const [item] = await db
      .select()
      .from(bankImportReviewQueue)
      .where(and(eq(bankImportReviewQueue.id, reviewItemId), eq(bankImportReviewQueue.userId, userId)));

    if (!item) {
      return NextResponse.json({ error: 'Review item not found' }, { status: 404 });
    }

    if (resolution === 'kept_both') {
      try {
        const parsed = JSON.parse(item.parsedRowData);
        await db.insert(transactions).values({
          userId,
          type: parsed.type || 'expense',
          amount: parseFloat(parsed.amount),
          category: parsed.category || 'Other',
          description: parsed.description || 'Imported Transaction',
          date: parsed.date || new Date().toISOString().split('T')[0],
        });
      } catch (err) {
        console.error('[bank-import-review] Failed to parse row data:', err);
      }
    }

    const [updated] = await db
      .update(bankImportReviewQueue)
      .set({
        resolution,
        resolvedAt: new Date().toISOString(),
      })
      .where(eq(bankImportReviewQueue.id, item.id))
      .returning();

    return NextResponse.json(updated);
  })
);
