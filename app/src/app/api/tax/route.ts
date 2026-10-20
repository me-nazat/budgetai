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

    const rawTransactions = await queryAll<{
      id: number;
      type: string;
      amount: number;
      category: string;
      description: string;
      date: string;
      tax_relevant: number;
      tax_category: string | null;
      attachments: string | null;
      receipt_document_id: number | null;
    }>(
      `SELECT t.id, t.type, t.amount, t.category, t.description, t.date, t.tax_relevant, t.tax_category, t.attachments, td.receipt_document_id
       FROM transactions t
       LEFT JOIN tax_deductions td ON td.transaction_id = t.id
       WHERE t.user_id = ? AND t.date >= ? AND t.date <= ? AND t.tax_relevant = 1
       ORDER BY t.date DESC`,
      [userId, start, end]
    );

    let withReceiptProof = 0;
    const transactions = rawTransactions.map((t) => {
      let hasReceiptProof = Boolean(t.receipt_document_id);
      if (!hasReceiptProof && t.attachments) {
        try {
          const parsed = JSON.parse(t.attachments);
          if (Array.isArray(parsed) && parsed.length > 0) hasReceiptProof = true;
        } catch {}
      }
      if (hasReceiptProof) withReceiptProof++;
      return {
        ...t,
        hasReceiptProof,
      };
    });

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

    const auditReadinessPercent = transactions.length > 0
      ? Math.round((withReceiptProof / transactions.length) * 100)
      : 100;

    return NextResponse.json({
      year,
      transactions,
      grouped,
      totals,
      grandTotal: transactions.reduce((sum, t) => sum + t.amount, 0),
      count: transactions.length,
      auditReadinessPercent,
      withReceiptProof,
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
