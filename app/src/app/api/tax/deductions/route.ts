export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { db } from '@/db/client';
import { taxDeductions, taxCategories } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { encryptNumber, decryptNumber } from '@/lib/crypto/encryption';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const deductions = await db
      .select({
        id: taxDeductions.id,
        transactionId: taxDeductions.transactionId,
        taxCategoryId: taxDeductions.taxCategoryId,
        categoryName: taxCategories.name,
        eligibleAmount: taxDeductions.eligibleAmount,
        deductibleAmount: taxDeductions.deductibleAmount,
        encryptedEligibleAmount: taxDeductions.encryptedEligibleAmount,
        encryptedDeductibleAmount: taxDeductions.encryptedDeductibleAmount,
        status: taxDeductions.status,
        notes: taxDeductions.notes,
        createdAt: taxDeductions.createdAt,
      })
      .from(taxDeductions)
      .leftJoin(taxCategories, eq(taxDeductions.taxCategoryId, taxCategories.id))
      .where(eq(taxDeductions.userId, userId));

    const mapped = deductions.map((d) => {
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

      return {
        id: d.id,
        transactionId: d.transactionId,
        taxCategoryId: d.taxCategoryId,
        categoryName: d.categoryName,
        eligibleAmount: eligible,
        deductibleAmount: deductible,
        status: d.status,
        notes: d.notes,
        createdAt: d.createdAt,
      };
    });

    const totalDeductions = mapped.reduce((acc, item) => acc + item.deductibleAmount, 0);
    const estimatedTaxSavings = totalDeductions * 0.28; // Assumes 28% marginal tax bracket

    return apiSuccess({
      totalDeductions,
      estimatedTaxSavings,
      deductions: mapped,
    });
  }),
  { rateLimit: 'api' }
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { transactionId, taxCategoryId, eligibleAmount, notes } = body;

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
      status: 'VERIFIED',
      notes,
    });

    return apiSuccess({
      deductionId,
      transactionId,
      deductibleAmount,
      estimatedTaxSavings: deductibleAmount * 0.28,
    });
  }),
  { rateLimit: 'apiStrict' }
);
