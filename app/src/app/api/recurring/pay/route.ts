export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { recurringTransactions, accounts } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { TransactionService } from '@/services/transaction.service';

function calculateNextDate(currentDate: string, frequency: string): string {
  const d = new Date(currentDate + 'T00:00:00Z');
  switch (frequency) {
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    case 'monthly':
    default:
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
  }
  return d.toISOString().split('T')[0];
}

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    try {
      const body = await request.json();
      const id = typeof body.id === 'string' ? parseInt(body.id, 10) : body.id;
      let accountId = body.accountId ? (typeof body.accountId === 'string' ? parseInt(body.accountId, 10) : body.accountId) : undefined;

      if (!id || isNaN(id)) {
        return NextResponse.json({ error: 'Valid recurring bill ID is required' }, { status: 400 });
      }

      // 1. Fetch the recurring transaction
      const [record] = await db
        .select()
        .from(recurringTransactions)
        .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
        .limit(1);

      if (!record) {
        return NextResponse.json({ error: 'Recurring bill not found' }, { status: 404 });
      }

      // 2. Resolve default account if accountId not provided
      if (!accountId) {
        const userAccounts = await db
          .select({ id: accounts.id })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.isArchived, 0)))
          .limit(1);

        if (userAccounts.length > 0) {
          accountId = userAccounts[0].id;
        }
      }

      // 3. Create actual ledger transaction for the payment
      const today = new Date().toISOString().split('T')[0];
      const createdTx = await TransactionService.create(userId, {
        type: record.type as 'expense' | 'earning',
        amount: record.amount,
        category: record.category,
        description: `[Paid Bill] ${record.name}`,
        date: today,
        accountId: accountId || undefined,
      });

      // 4. Advance next due date
      const nextDate = calculateNextDate(record.nextDate, record.frequency);
      await db
        .update(recurringTransactions)
        .set({ nextDate })
        .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));

      return NextResponse.json({
        success: true,
        message: `Marked "${record.name}" as paid. Next due date: ${nextDate}`,
        transaction: createdTx,
        nextDate,
      });
    } catch (err: any) {
      console.error('Error processing recurring bill payment:', err);
      return NextResponse.json(
        { error: err.message || 'Failed to record bill payment' },
        { status: 500 }
      );
    }
  })
);
