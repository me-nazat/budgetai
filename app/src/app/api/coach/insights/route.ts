import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  return apiSuccess({
    insights: [
      {
        id: 'ins_101',
        type: 'SPENDING_SPIKE',
        severity: 'WARNING',
        title: 'Dining Out Expense Spike',
        message: 'Your dining out expenses are 45% higher than your 3-month average ($420 vs $290).',
        actionLink: '/analytics',
      },
      {
        id: 'ins_102',
        type: 'SUBSCRIPTION_LEAK',
        severity: 'INFO',
        title: 'Unused Streaming Subscription',
        message: 'You have not logged any activity linked to Netflix ($19.99/mo) in 45 days.',
        actionLink: '/recurring-subscriptions',
      },
      {
        id: 'ins_103',
        type: 'SAVINGS_OPPORTUNITY',
        severity: 'CRITICAL',
        title: 'Cashflow Runaway Alert',
        message: 'Predicted bill payments ($620.00) will lower checking balance below $100 before payday.',
        actionLink: '/budget',
      },
    ],
  });
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json().catch(() => ({}));
  const { insightId, action } = body;

  if (!insightId || action !== 'dismiss') {
    return apiError(
      new ValidationError('Invalid insight action', ErrorCode.INVALID_INPUT)
    );
  }

  return apiSuccess({
    success: true,
    dismissedInsightId: insightId,
  });
});
