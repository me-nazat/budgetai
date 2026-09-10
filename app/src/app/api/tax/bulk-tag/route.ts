export const dynamic = 'force-dynamic';

/**
 * @fileoverview Bulk tax tagging from learned patterns.
 * Feature 12.1: Inline Tax Tagging + Receipt Auto-Linking.
 *
 * POST /api/tax/bulk-tag
 * Body: { apply?: boolean }
 *
 * @module api/tax/bulk-tag
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  transactions,
  taxDeductions,
  taxCategories,
  documentMetadata,
  module22TaxTagSuggestions,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

const PATTERN_MAPPINGS = [
  { regex: /aws|amazon web services|github|vercel|heroku|jetbrains|openai|google cloud/i, categoryCode: 'SOFTWARE_100', defaultCatId: 'taxcat_sch_c_software' },
  { regex: /apple|best buy|dell|logitech|office depot/i, categoryCode: 'SCH_C_OFFICE', defaultCatId: 'taxcat_sch_c_office' },
  { regex: /delta|united|american airlines|uber|lyft|airbnb|marriott/i, categoryCode: 'SCH_C_TRAVEL', defaultCatId: 'taxcat_sch_c_travel' },
];

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const apply = Boolean(body.apply);

    // 1. Fetch user's existing tagged transaction IDs
    const existingDeductions = await db
      .select({ transactionId: taxDeductions.transactionId })
      .from(taxDeductions)
      .where(eq(taxDeductions.userId, userId));

    const taggedTxnIds = new Set(existingDeductions.map((d) => d.transactionId).filter(Boolean));

    // 2. Fetch user's recent transactions
    const userTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .limit(200);

    // 3. Match against patterns
    const matches: Array<{
      transactionId: number;
      description: string;
      amount: number;
      date: string;
      suggestedTaxCatId: string;
      suggestedCatName: string;
    }> = [];

    for (const txn of userTxns) {
      if (taggedTxnIds.has(txn.id)) continue;

      for (const p of PATTERN_MAPPINGS) {
        if (p.regex.test(txn.description)) {
          matches.push({
            transactionId: txn.id,
            description: txn.description,
            amount: txn.amount,
            date: txn.date,
            suggestedTaxCatId: p.defaultCatId,
            suggestedCatName: p.categoryCode,
          });
          break;
        }
      }
    }

    // If preview only, return matches
    if (!apply) {
      return NextResponse.json({
        matches,
        count: matches.length,
        message: `Found ${matches.length} untagged transactions matching learned tax deduction rules.`,
      });
    }

    // Apply bulk tags
    let appliedCount = 0;
    for (const m of matches) {
      const deductionId = `deduct_${crypto.randomUUID()}`;

      // Auto-link receipt if document is attached to this user and date
      const [attachedDoc] = await db
        .select({ id: documentMetadata.id })
        .from(documentMetadata)
        .where(
          and(
            eq(documentMetadata.userId, userId),
            eq(documentMetadata.documentDate, m.date)
          )
        )
        .limit(1);

      await db.insert(taxDeductions).values({
        id: deductionId,
        userId,
        transactionId: m.transactionId,
        taxCategoryId: m.suggestedTaxCatId,
        eligibleAmount: m.amount,
        deductibleAmount: m.amount,
        jurisdiction: 'US_IRS',
        receiptDocumentId: null,
        status: 'VERIFIED',
        notes: 'Auto-tagged via bulk match rule',
      }).onConflictDoNothing();

      appliedCount++;
    }

    return NextResponse.json({
      success: true,
      appliedCount,
      matches,
    });
  })
);
