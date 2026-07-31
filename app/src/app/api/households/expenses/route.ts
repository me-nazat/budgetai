import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { db } from '@/db/client';
import { householdExpenses, householdSplits } from '@/db/schema';
import { v4 as uuidv4 } from 'uuid';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json().catch(() => ({}));
  const { householdId, amount, description, paidByUserId, splitMode = 'EQUAL', customRatios } = body;

  if (!householdId || typeof amount !== 'number' || amount <= 0 || !description) {
    return apiError(
      new ValidationError('Invalid expense parameters', ErrorCode.INVALID_INPUT)
    );
  }

  const payerId = paidByUserId || userId;

  const inserted = await db.insert(householdExpenses).values({
    householdId: Number(householdId),
    userId: payerId,
    description,
    amount,
    splitBetween: splitMode === 'CUSTOM' ? JSON.stringify(customRatios || {}) : 'all',
  }).returning({ id: householdExpenses.id });

  const expenseId = inserted[0]?.id ? String(inserted[0].id) : uuidv4();

  // Calculate splits
  let memberUserIds = [payerId];
  if (customRatios && typeof customRatios === 'object') {
    memberUserIds = Object.keys(customRatios).map((k) => Number(k));
  }

  const numMembers = memberUserIds.length || 1;
  const equalShare = amount / numMembers;

  const splitsData = [];
  for (const memberId of memberUserIds) {
    const percentageShare = customRatios?.[memberId] ?? 100 / numMembers;
    const owedAmount = splitMode === 'CUSTOM' ? (amount * percentageShare) / 100 : equalShare;

    const splitId = uuidv4();
    splitsData.push({
      id: splitId,
      expenseId,
      userId: memberId,
      owedAmount,
      paidAmount: memberId === payerId ? amount : 0,
      percentageShare,
      isSettled: memberId === payerId ? 1 : 0,
    });
  }

  if (splitsData.length > 0) {
    await db.insert(householdSplits).values(splitsData);
  }

  return apiSuccess({
    expenseId,
    totalAmount: amount,
    splits: splitsData.map((s) => ({
      userId: s.userId,
      owedAmount: s.owedAmount,
      percentageShare: s.percentageShare,
    })),
  });
});
