export const dynamic = 'force-dynamic';

/**
 * @fileoverview Bank Statement Batch Commit API.
 *
 * POST /api/bank-import/commit
 * Batch-inserts approved transactions into DB with duplicate prevention.
 *
 * @module api/bank-import/commit
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { run, queryOne } from '@/lib/db';

const CommitSchema = z.object({
  transactions: z.array(z.object({
    date: z.string(),
    description: z.string(),
    amount: z.number().positive(),
    category: z.string().default('Other'),
    type: z.enum(['expense', 'earning']).default('expense'),
  })),
});

export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const { transactions } = CommitSchema.parse(body);

    let inserted = 0;
    let duplicates = 0;

    for (const tx of transactions) {
      // Check for exact match duplicate (date + amount + description)
      const dup = await queryOne<{ id: number }>(
        'SELECT id FROM transactions WHERE user_id = ? AND date = ? AND amount = ? AND description = ?',
        [userId, tx.date, tx.amount, tx.description]
      );

      if (dup) {
        duplicates++;
        continue;
      }

      await run(
        'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, tx.type, tx.amount, tx.category, tx.description, tx.date]
      );
      inserted++;
    }

    return NextResponse.json({
      success: true,
      inserted,
      duplicates,
      message: `Committed ${inserted} transactions (${duplicates} duplicates skipped)`,
    });
  }),
  { rateLimit: 'api' }
);
