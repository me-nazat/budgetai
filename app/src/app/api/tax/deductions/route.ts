export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { db } from '@/db/client';
import { taxDeductions, taxCategories, transactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { encryptNumber, decryptNumber } from '@/lib/crypto/encryption';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');

    const query = db
      .select({
        id: taxDeductions.id,
        transactionId: taxDeductions.transactionId,
        taxCategoryId: taxDeductions.taxCategoryId,
        categoryName: taxCategories.name,
        categoryCode: taxCategories.code,
        deductiblePercentage: taxCategories.deductiblePercentage,
        eligibleAmount: taxDeductions.eligibleAmount,
        deductibleAmount: taxDeductions.deductibleAmount,
        encryptedEligibleAmount: taxDeductions.encryptedEligibleAmount,
        encryptedDeductibleAmount: taxDeductions.encryptedDeductibleAmount,
        receiptDocumentId: taxDeductions.receiptDocumentId,
        status: taxDeductions.status,
        notes: taxDeductions.notes,
        createdAt: taxDeductions.createdAt,
        txnDescription: transactions.description,
        txnDate: transactions.date,
        txnAttachments: transactions.attachments,
      })
      .from(taxDeductions)
      .leftJoin(taxCategories, eq(taxDeductions.taxCategoryId, taxCategories.id))
      .leftJoin(transactions, eq(taxDeductions.transactionId, transactions.id))
      .where(eq(taxDeductions.userId, userId));

    let rows = await query;
    if (year) {
      const yearStr = String(year);
      rows = rows.filter((r) => !r.txnDate || r.txnDate.startsWith(yearStr));
    }

    const mapped = rows.map((d) => {
      let eligible = d.eligibleAmount;
      let deductible = d.deductibleAmount;

      if (d.encryptedEligibleAmount) {
        try {
          eligible = decryptNumber(d.encryptedEligibleAmount, 'amount');
        } catch {
          // Fallback to unencrypted column
        }
      }

      if (d.encryptedDeductibleAmount) {
        try {
          deductible = decryptNumber(d.encryptedDeductibleAmount, 'amount');
        } catch {
          // Fallback to unencrypted column
        }
      }

      let hasReceiptProof = Boolean(d.receiptDocumentId);
      if (!hasReceiptProof && d.txnAttachments) {
        try {
          const parsed = JSON.parse(d.txnAttachments);
          if (Array.isArray(parsed) && parsed.length > 0) hasReceiptProof = true;
        } catch {}
      }

      return {
        id: d.id,
        transactionId: d.transactionId,
        taxCategoryId: d.taxCategoryId,
        categoryName: d.categoryName || 'General Deduction',
        categoryCode: d.categoryCode || 'OTHER',
        deductiblePercentage: d.deductiblePercentage ?? 1.0,
        eligibleAmount: eligible,
        deductibleAmount: deductible,
        receiptDocumentId: d.receiptDocumentId,
        hasReceiptProof,
        status: d.status,
        notes: d.notes,
        createdAt: d.createdAt,
        transactionName: d.txnDescription,
        transactionDate: d.txnDate,
      };
    });

    const totalDeductions = mapped.reduce((acc, item) => acc + item.deductibleAmount, 0);
    const estimatedTaxSavings = totalDeductions * 0.20; // Default 20% effective tax rate

    const approved = mapped.filter((m) => m.status === 'VERIFIED');
    const approvedWithProof = approved.filter((m) => m.hasReceiptProof).length;
    const auditReadinessPercent = approved.length > 0 ? Math.round((approvedWithProof / approved.length) * 100) : 100;

    return apiSuccess({
      totalDeductions,
      estimatedTaxSavings,
      auditReadinessPercent,
      approvedWithProof,
      totalApproved: approved.length,
      deductions: mapped,
    });
  }),
  { rateLimit: 'api' }
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { transactionId, taxCategoryId, eligibleAmount, receiptDocumentId, notes } = body;

    if (!taxCategoryId || typeof eligibleAmount !== 'number' || eligibleAmount <= 0) {
      return apiError(
        new ValidationError('Invalid tax deduction inputs', ErrorCode.INVALID_INPUT)
      );
    }

    const deductionId = uuidv4();
    const deductibleAmount = eligibleAmount;

    let encryptedEligibleAmount: string | null = null;
    let encryptedDeductibleAmount: string | null = null;

    try {
      encryptedEligibleAmount = encryptNumber(eligibleAmount, 'amount');
      encryptedDeductibleAmount = encryptNumber(deductibleAmount, 'amount');
    } catch {
      // Key may not be configured in test environments
    }

    await db.insert(taxDeductions).values({
      id: deductionId,
      userId,
      transactionId: transactionId ? Number(transactionId) : null,
      taxCategoryId,
      eligibleAmount,
      deductibleAmount,
      encryptedEligibleAmount,
      encryptedDeductibleAmount,
      receiptDocumentId: receiptDocumentId ? Number(receiptDocumentId) : null,
      status: 'VERIFIED',
      notes,
    }).onConflictDoUpdate({
      target: taxDeductions.transactionId,
      set: {
        taxCategoryId,
        eligibleAmount,
        deductibleAmount,
        receiptDocumentId: receiptDocumentId ? Number(receiptDocumentId) : undefined,
        status: 'VERIFIED',
        notes: notes || undefined,
      },
    });

    return apiSuccess({
      deductionId,
      transactionId,
      deductibleAmount,
      estimatedTaxSavings: deductibleAmount * 0.20,
    });
  }),
  { rateLimit: 'apiStrict' }
);
