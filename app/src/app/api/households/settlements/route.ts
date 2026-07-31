import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { calculateMinSettlements, BalanceNode } from '@/lib/algorithms/minSettlement';
import { db } from '@/db/client';
import { householdSettlements, householdSplits } from '@/db/schema';

export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const householdId = searchParams.get('householdId');

  if (!householdId) {
    return apiError(
      new ValidationError('householdId is required', ErrorCode.INVALID_INPUT)
    );
  }

  // Query raw splits to compute net balances
  const allSplits = await db.select().from(householdSplits);

  const balanceMap = new Map<number, number>();
  for (const s of allSplits) {
    const net = s.paidAmount - s.owedAmount;
    balanceMap.set(s.userId, (balanceMap.get(s.userId) || 0) + net);
  }

  const balanceNodes: BalanceNode[] = Array.from(balanceMap.entries()).map(
    ([userId, netBalance]) => ({
      userId,
      netBalance,
    })
  );

  const optimizedSettlements = calculateMinSettlements(balanceNodes);
  const totalUnsettledVolume = optimizedSettlements.reduce(
    (acc, item) => acc + item.amount,
    0
  );

  return apiSuccess({
    householdId,
    totalUnsettledVolume,
    optimizedSettlements: optimizedSettlements.map((s) => ({
      payerId: s.fromUserId,
      payerName: s.fromUserName || `User #${s.fromUserId}`,
      payeeId: s.toUserId,
      payeeName: s.toUserName || `User #${s.toUserId}`,
      amount: s.amount,
    })),
  });
});

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json().catch(() => ({}));
  const { householdId, payeeId, amount } = body;

  if (!householdId || !payeeId || typeof amount !== 'number' || amount <= 0) {
    return apiError(
      new ValidationError('Invalid settlement parameters', ErrorCode.INVALID_INPUT)
    );
  }

  const inserted = await db.insert(householdSettlements).values({
    householdId: Number(householdId),
    payerId: userId,
    payeeId: Number(payeeId),
    amount,
    status: 'settled',
    settledAt: new Date().toISOString(),
  }).returning({ id: householdSettlements.id });

  return apiSuccess({
    settlementId: inserted[0]?.id || 1,
    status: 'COMPLETED',
    settledAt: Date.now(),
  });
});
