import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { db } from '@/db/client';
import { taxDeductions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const deductions = await db
    .select()
    .from(taxDeductions)
    .where(eq(taxDeductions.userId, userId));

  const totalDeductions = deductions.reduce((acc, item) => acc + item.deductibleAmount, 0);
  const estimatedTaxSavings = totalDeductions * 0.28; // Assumes 28% marginal tax bracket

  return apiSuccess({
    totalDeductions,
    estimatedTaxSavings,
    deductions: deductions.map((d) => ({
      id: d.id,
      transactionId: d.transactionId,
      taxCategoryId: d.taxCategoryId,
      eligibleAmount: d.eligibleAmount,
      deductibleAmount: d.deductibleAmount,
      status: d.status,
      notes: d.notes,
    })),
  });
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json().catch(() => ({}));
  const { transactionId, taxCategoryId, eligibleAmount, notes } = body;

  if (!taxCategoryId || typeof eligibleAmount !== 'number' || eligibleAmount <= 0) {
    return apiError(
      new ValidationError('Invalid tax deduction inputs', ErrorCode.INVALID_INPUT)
    );
  }

  const deductionId = uuidv4();
  const deductibleAmount = eligibleAmount;

  await db.insert(taxDeductions).values({
    id: deductionId,
    userId,
    transactionId: transactionId ? Number(transactionId) : null,
    taxCategoryId,
    eligibleAmount,
    deductibleAmount,
    status: 'VERIFIED',
    notes,
  });

  return apiSuccess({
    deductionId,
    transactionId,
    deductibleAmount,
    estimatedTaxSavings: deductibleAmount * 0.28,
  });
});
