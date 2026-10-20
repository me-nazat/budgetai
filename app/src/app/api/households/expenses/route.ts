export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { HouseholdService } from '@/services/household.service';

/**
 * POST /api/households/expenses
 * Reconciled write path:
 * 1. Checks category spending caps and flags capWarning
 * 2. Determines split percentages via strict priority (custom -> category rule -> allocation weights -> equal fallback)
 * 3. Inserts householdExpenses with personalShareAmount
 * 4. Deducts full amount from personal bank account (fundingAccountId) if provided
 * 5. Fans out insert into householdSettlements
 * 6. Broadcasts SSE refresh
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const {
      householdId,
      amount,
      description,
      category = 'Other',
      paidByUserId,
      splitMode = 'equal',
      customRatios,
      fundingAccountId,
      accountId,
      date,
    } = body;

    if (!householdId || typeof amount !== 'number' || amount <= 0 || !description) {
      return apiError(
        new ValidationError('Invalid expense parameters: householdId, amount > 0, and description are required', ErrorCode.INVALID_INPUT)
      );
    }

    const hhId = Number(householdId);
    const payerId = paidByUserId ? Number(paidByUserId) : userId;
    const effectiveFundingAccountId = fundingAccountId ?? accountId ?? null;

    const result = await HouseholdService.createHouseholdExpense({
      householdId: hhId,
      userId: payerId,
      description,
      amount,
      category,
      fundingAccountId: effectiveFundingAccountId,
      customSplits: splitMode === 'custom' ? customRatios : undefined,
      date,
    });

    return apiSuccess({
      expenseId: result.expense.id,
      totalAmount: amount,
      payerId,
      personalShareAmount: result.expense.personalShareAmount,
      linkedTransactionId: result.expense.linkedTransactionId,
      capWarning: result.capWarning,
      capDetails: result.capDetails,
      strategy: result.strategy,
      settlementsCreated: result.settlementsCreated,
      splitBreakdown: result.splitBreakdown,
    });
  }),
  { rateLimit: 'api' }
);
