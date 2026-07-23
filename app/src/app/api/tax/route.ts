export const dynamic = 'force-dynamic';

/**
 * @fileoverview Tax tagging API.
 *
 * POST — Tag/untag a transaction as tax-relevant with a tax category.
 * GET  — Fetch all tax-tagged transactions grouped by category.
 *
 * @module api/tax
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { run, queryAll, queryOne } from '@/lib/db';

const TagSchema = z.object({
  transactionId: z.number().int().positive(),
  taxRelevant: z.number().int().min(0).max(1),
  taxCategory: z.string().max(50).optional(),
});

/**
 * GET /api/tax?year=2025
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;

    const transactions = await queryAll<{
      id: number;
      type: string;
      amount: number;
      category: string;
      description: string;
      date: string;
      tax_relevant: number;
      tax_category: string | null;
    }>(
      `SELECT id, type, amount, category, description, date, tax_relevant, tax_category
       FROM transactions
       WHERE user_id = ? AND date >= ? AND date <= ? AND tax_relevant = 1
       ORDER BY date DESC`,
      [userId, start, end]
    );

    // Group by tax category
    const grouped: Record<string, typeof transactions> = {};
    transactions.forEach(t => {
      const cat = t.tax_category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(t);
    });

    const totals: Record<string, number> = {};
    Object.entries(grouped).forEach(([cat, txs]) => {
      totals[cat] = txs.reduce((sum, t) => sum + t.amount, 0);
    });

    return NextResponse.json({
      year,
      transactions,
      grouped,
      totals,
      grandTotal: transactions.reduce((sum, t) => sum + t.amount, 0),
      count: transactions.length,
    });
  })
);

/**
 * POST /api/tax — Tag or untag a transaction
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const { transactionId, taxRelevant, taxCategory } = TagSchema.parse(body);

    // Verify ownership
    const tx = await queryOne<{ id: number }>(
      'SELECT id FROM transactions WHERE id = ? AND user_id = ?',
      [transactionId, userId]
    );

    if (!tx) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    await run(
      'UPDATE transactions SET tax_relevant = ?, tax_category = ? WHERE id = ? AND user_id = ?',
      [taxRelevant, taxRelevant === 1 ? (taxCategory || 'Other') : null, transactionId, userId]
    );

    return NextResponse.json({ success: true });
  }),
  { rateLimit: 'api' }
);
