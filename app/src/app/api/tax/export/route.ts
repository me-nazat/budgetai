export const dynamic = 'force-dynamic';

/**
 * @fileoverview Tax export API — Generates CSV or formatted tax summaries for PDF/Excel download.
 *
 * GET /api/tax/export?format=pdf|excel&year=2025
 *
 * @module api/tax/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll } from '@/lib/db';

export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'pdf';
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
       ORDER BY tax_category ASC, date DESC`,
      [userId, start, end]
    );

    // Build CSV content suitable for tax accountants / Excel / PDF viewers
    const headers = ['ID', 'Date', 'Type', 'Category', 'Tax Category', 'Description', 'Amount'];
    const rows = transactions.map(t => [
      t.id,
      t.date,
      t.type,
      `"${(t.category || '').replace(/"/g, '""')}"`,
      `"${(t.tax_category || 'Other').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.amount.toFixed(2),
    ]);

    const csvLines = [
      `Tax Deductions Summary Report - Fiscal Year ${year}`,
      `Generated on ${new Date().toISOString().split('T')[0]}`,
      `Total Deductible Items: ${transactions.length}`,
      `Total Amount: ${transactions.reduce((sum, t) => sum + t.amount, 0).toFixed(2)}`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(',')),
    ];

    const csvContent = csvLines.join('\n');

    if (format === 'excel' || format === 'csv') {
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tax-report-${year}.csv"`,
        },
      });
    }

    // Default: Plain formatted text/CSV download as fallback for PDF/Excel client conversion
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="tax-report-${year}.txt"`,
      },
    });
  })
);
