import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const goalId = searchParams.get('goalId') || 'g_101';

  const targetAmount = 5000.0;
  const currentAmount = 2150.0;
  const remaining = targetAmount - currentAmount;

  const manualVelocity = 250.0; // $250/mo manual
  const roundUp1x = 45.0; // $45/mo round-ups at 1x

  const now = new Date();
  
  const months1x = Math.ceil(remaining / (manualVelocity + roundUp1x));
  const date1x = new Date(now.getFullYear(), now.getMonth() + months1x, 15).toISOString().split('T')[0];

  const months2x = Math.ceil(remaining / (manualVelocity + roundUp1x * 2));
  const date2x = new Date(now.getFullYear(), now.getMonth() + months2x, 15).toISOString().split('T')[0];

  const months5x = Math.ceil(remaining / (manualVelocity + roundUp1x * 5));
  const date5x = new Date(now.getFullYear(), now.getMonth() + months5x, 15).toISOString().split('T')[0];

  return apiSuccess({
    goalId,
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
