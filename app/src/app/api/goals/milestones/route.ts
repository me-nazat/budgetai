import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';

import { db } from '@/db/client';
import { savingsGoals } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET = withAuth(async (request: NextRequest, { userId }) => {
  const { searchParams } = new URL(request.url);
  const goalIdParam = searchParams.get('goalId');
  const numericId = goalIdParam ? parseInt(goalIdParam, 10) : NaN;

  let targetAmount = 5000.0;
  let currentAmount = 2150.0;

  if (!isNaN(numericId) && userId) {
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, numericId), eq(savingsGoals.userId, userId)))
      .limit(1);

    if (goal) {
      targetAmount = goal.targetAmount;
      currentAmount = goal.savedAmount || 0;
    }
  }

  const remaining = Math.max(0, targetAmount - currentAmount);
  const manualVelocity = 250.0;
  const roundUp1x = 45.0;

  const now = new Date();
  const months1x = Math.max(1, Math.ceil(remaining / (manualVelocity + roundUp1x)));
  const date1x = new Date(now.getFullYear(), now.getMonth() + months1x, 15).toISOString().split('T')[0];

  const months2x = Math.max(1, Math.ceil(remaining / (manualVelocity + roundUp1x * 2)));
  const date2x = new Date(now.getFullYear(), now.getMonth() + months2x, 15).toISOString().split('T')[0];

  const months5x = Math.max(1, Math.ceil(remaining / (manualVelocity + roundUp1x * 5)));
  const date5x = new Date(now.getFullYear(), now.getMonth() + months5x, 15).toISOString().split('T')[0];

  return apiSuccess({
    goalId: goalIdParam || 'g_101',
    targetAmount,
    currentAmount,
    monthlyVelocity: {
      manualContributions: manualVelocity,
      roundUpContributions: roundUp1x,
      totalMonthlyRate: manualVelocity + roundUp1x,
    },
    predictions: {
      atCurrentRate: date1x,
      with2xMultiplier: date2x,
      with5xMultiplier: date5x,
    },
  });
});
