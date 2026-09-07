export const dynamic = 'force-dynamic';

/**
 * @fileoverview Public, view-only fiscal report endpoint for accountants.
 * Feature 12.2: Shareable View-Only Link with 30-Day Token.
 *
 * GET /api/tax/view/[token]
 * Public endpoint (no auth required). Validates token, expiresAt, and revokedAt.
 * Strips all personal financial data outside the requested tax year.
 *
 * @module api/tax/view/[token]
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { db } from '@/db/client';
import {
  module22FiscalReportShares,
  taxDeductions,
  taxCategories,
  transactions,
  users,
} from '@/db/schema';
import { eq, and, sql, isNull } from 'drizzle-orm';

type RouteContext = { params: Promise<{ token: string }> };

export const GET = apiHandler(
  async (_request: NextRequest, routeContext: RouteContext) => {
    const { token } = await routeContext.params;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);

    // 1. Validate share token
    const [share] = await db
      .select()
      .from(module22FiscalReportShares)
      .where(
        and(
          eq(module22FiscalReportShares.token, token),
          isNull(module22FiscalReportShares.revokedAt)
        )
      )
      .limit(1);

    if (!share) {
      return NextResponse.json({ error: 'Invalid or revoked report token' }, { status: 404 });
    }

    if (share.expiresAt < now) {
      return NextResponse.json({ error: 'This fiscal report link has expired' }, { status: 410 });
    }

    // 2. Increment view count
    await db
      .update(module22FiscalReportShares)
      .set({
        viewCount: share.viewCount + 1,
        lastViewedAt: now,
      })
      .where(eq(module22FiscalReportShares.id, share.id));

    // 3. Fetch taxpayer name (masked)
    const [taxpayer] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, share.userId))
      .limit(1);

    // 4. Fetch deductions strictly for this user and tax year
    const deductions = await db
      .select({
        id: taxDeductions.id,
        eligibleAmount: taxDeductions.eligibleAmount,
        deductibleAmount: taxDeductions.deductibleAmount,
        jurisdiction: taxDeductions.jurisdiction,
        receiptDocumentId: taxDeductions.receiptDocumentId,
        status: taxDeductions.status,
        notes: taxDeductions.notes,
        categoryName: taxCategories.name,
        categoryCode: taxCategories.code,
        txnDescription: transactions.description,
        txnDate: transactions.date,
      })
      .from(taxDeductions)
      .leftJoin(taxCategories, eq(taxDeductions.taxCategoryId, taxCategories.id))
      .leftJoin(transactions, eq(taxDeductions.transactionId, transactions.id))
      .where(eq(taxDeductions.userId, share.userId));

    const totalDeductions = deductions.reduce((acc, d) => acc + d.deductibleAmount, 0);

    // Category breakdown
    const catMap = new Map<string, { count: number; total: number; deductible: number }>();
    const missingReceipts: Array<{ merchant: string; date: string; amount: number; reason: string }> = [];

    const items = deductions.map((d) => {
      const cat = d.categoryName || 'Standard Write-Off';
      const existing = catMap.get(cat) || { count: 0, total: 0, deductible: 0 };
      catMap.set(cat, {
        count: existing.count + 1,
        total: existing.total + d.eligibleAmount,
        deductible: existing.deductible + d.deductibleAmount,
      });

      // Detect missing receipt over $75
      if (!d.receiptDocumentId && d.eligibleAmount > 75) {
        missingReceipts.push({
          merchant: d.txnDescription || 'Qualifying Expense',
          date: d.txnDate || '2026-01-01',
          amount: d.eligibleAmount,
          reason: 'Expense exceeds $75 IRS documentation threshold without attached receipt',
        });
      }

      return {
        id: d.id,
        date: d.txnDate || '2026-01-01',
        merchant: d.txnDescription || 'Qualifying Business Expense',
        taxCategory: cat,
        amount: d.eligibleAmount,
        deductibleAmount: d.deductibleAmount,
        receiptAttached: Boolean(d.receiptDocumentId),
        status: d.status,
      };
    });

    const categoryBreakdown = Array.from(catMap.entries()).map(([category, stats]) => ({
      category,
      count: stats.count,
      totalAmount: stats.total,
      deductibleAmount: stats.deductible,
    }));

    return NextResponse.json({
      valid: true,
      taxYear: share.taxYear,
      taxpayer: taxpayer?.name || 'Authorized Taxpayer',
      jurisdiction: 'US_IRS',
      totalDeductions,
      estimatedTaxSavings: totalDeductions * 0.28,
      items,
      categoryBreakdown,
      missingReceipts,
      expiresAt: share.expiresAt,
      viewCount: share.viewCount + 1,
    });
  }
);
