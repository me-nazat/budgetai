export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { calculateMinSettlements, BalanceNode } from '@/lib/algorithms/minSettlement';
import { db } from '@/db/client';
import {
  householdSettlements,
  householdMembers,
  transactions,
  users,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { encryptNumber } from '@/lib/crypto/encryption';
import { broadcastHouseholdUpdate } from '@/lib/household-sync';

/**
 * GET /api/households/settlements?householdId=123
 * Computes net balances, pairwise who-owes-whom matrix, and minimal debt settlements
 * strictly from canonical household tables.
 */
export const GET = apiHandler(
  withAuth(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const householdIdParam = searchParams.get('householdId');

    if (!householdIdParam) {
      return apiError(
        new ValidationError('householdId is required', ErrorCode.INVALID_INPUT)
      );
    }

    const hhId = Number(householdIdParam);

    // 1. Fetch household members with profiles
    const members = await db
      .select({
        userId: householdMembers.userId,
        role: householdMembers.role,
        userName: users.name,
        userEmail: users.email,
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(eq(householdMembers.householdId, hhId));

    const memberMap = new Map<number, string>();
    members.forEach((m) => {
      memberMap.set(m.userId, m.userName || `User #${m.userId}`);
    });

    // 2. Fetch all pending settlements for this household
    const pendingSettlements = await db
      .select()
      .from(householdSettlements)
      .where(
        and(
          eq(householdSettlements.householdId, hhId),
          eq(householdSettlements.status, 'pending')
        )
      );

    // 3. Compute net balance per member
    const balanceMap = new Map<number, number>();
    members.forEach((m) => balanceMap.set(m.userId, 0));

    // Pairwise matrix: matrix[payerId][payeeId] = amount owed
    const matrix: Record<string, Record<string, number>> = {};
    members.forEach((m1) => {
      matrix[m1.userId] = {};
      members.forEach((m2) => {
        matrix[m1.userId][m2.userId] = 0;
      });
    });

    for (const s of pendingSettlements) {
      // Payer owes payee
      const currentPayerBal = balanceMap.get(s.payerId) || 0;
      const currentPayeeBal = balanceMap.get(s.payeeId) || 0;

      balanceMap.set(s.payerId, currentPayerBal - s.amount);
      balanceMap.set(s.payeeId, currentPayeeBal + s.amount);

      if (matrix[s.payerId] && matrix[s.payerId][s.payeeId] !== undefined) {
        matrix[s.payerId][s.payeeId] += s.amount;
      }
    }

    // 4. Calculate minimal settlement paths
    const balanceNodes: BalanceNode[] = Array.from(balanceMap.entries()).map(
      ([userId, netBalance]) => ({
        userId,
        netBalance: Math.round(netBalance * 100) / 100,
      })
    );

    const optimizedSettlements = calculateMinSettlements(balanceNodes);
    const totalUnsettledVolume = optimizedSettlements.reduce(
      (acc, item) => acc + item.amount,
      0
    );

    return apiSuccess({
      householdId: hhId,
      totalUnsettledVolume: Math.round(totalUnsettledVolume * 100) / 100,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.userName,
        role: m.role,
        balance: Math.round((balanceMap.get(m.userId) || 0) * 100) / 100,
      })),
      matrix,
      optimizedSettlements: optimizedSettlements.map((s) => ({
        payerId: Number(s.fromUserId),
        payerName: memberMap.get(Number(s.fromUserId)) || `User #${s.fromUserId}`,
        payeeId: Number(s.toUserId),
        payeeName: memberMap.get(Number(s.toUserId)) || `User #${s.toUserId}`,
        amount: Math.round(s.amount * 100) / 100,
      })),
    });
  }),
  { rateLimit: 'api' }
);

/**
 * POST /api/households/settlements
 * One-tap Settle Up:
 * 1. Mark matching pending householdSettlements rows as settled
 * 2. Create a standard transactions row for the payer (category "Household Settlement")
 * 3. Store encrypted amounts
 * 4. Broadcast real-time SSE update
 */
export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { householdId, payeeId, amount, notes } = body;

    if (!householdId || !payeeId || typeof amount !== 'number' || amount <= 0) {
      return apiError(
        new ValidationError('Invalid settlement parameters: householdId, payeeId, and amount > 0 are required', ErrorCode.INVALID_INPUT)
      );
    }

    const hhId = Number(householdId);
    const targetPayeeId = Number(payeeId);

    // Fetch payee name for transaction record
    const [payee] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, targetPayeeId))
      .limit(1);

    const payeeName = payee?.name || `Member #${targetPayeeId}`;
    const today = new Date().toISOString().split('T')[0];

    // 1. Mark pending settlements as settled between userId and targetPayeeId up to amount
    const pendingBetween = await db
      .select()
      .from(householdSettlements)
      .where(
        and(
          eq(householdSettlements.householdId, hhId),
          eq(householdSettlements.payerId, userId),
          eq(householdSettlements.payeeId, targetPayeeId),
          eq(householdSettlements.status, 'pending')
        )
      );

    let remainingToSettle = amount;
    for (const pending of pendingBetween) {
      if (remainingToSettle <= 0) break;

      if (pending.amount <= remainingToSettle) {
        await db
          .update(householdSettlements)
          .set({
            status: 'settled',
            settledAt: new Date().toISOString(),
          })
          .where(eq(householdSettlements.id, pending.id));
        remainingToSettle -= pending.amount;
      } else {
        // Partially settle this row: update this row with reduced amount, insert settled row for settled portion
        const settledPortion = remainingToSettle;
        const newRemaining = Math.round((pending.amount - settledPortion) * 100) / 100;

        await db
          .update(householdSettlements)
          .set({
            amount: newRemaining,
            encryptedAmount: encryptNumber(newRemaining, 'household-settlement'),
          })
          .where(eq(householdSettlements.id, pending.id));

        await db.insert(householdSettlements).values({
          householdId: hhId,
          payerId: userId,
          payeeId: targetPayeeId,
          amount: settledPortion,
          encryptedAmount: encryptNumber(settledPortion, 'household-settlement'),
          status: 'settled',
          settledAt: new Date().toISOString(),
        });

        remainingToSettle = 0;
      }
    }

    // If there were no prior pending rows or amount exceeded them, record the settlement entry
    const insertedSettlement = await db
      .insert(householdSettlements)
      .values({
        householdId: hhId,
        payerId: userId,
        payeeId: targetPayeeId,
        amount,
        encryptedAmount: encryptNumber(amount, 'household-settlement'),
        status: 'settled',
        settledAt: new Date().toISOString(),
      })
      .returning({ id: householdSettlements.id });

    // 2. Insert standard transaction row for the payer (Household Settlement category)
    await db.insert(transactions).values({
      userId,
      type: 'expense',
      amount,
      encryptedAmount: encryptNumber(amount, 'transaction-amount'),
      category: 'Household Settlement',
      description: `Household Settlement to ${payeeName}`,
      date: today,
    });

    // 3. Broadcast real-time SSE update
    broadcastHouseholdUpdate(hhId, {
      type: 'SETTLEMENT_RECORDED',
      data: {
        householdId: hhId,
        payerId: userId,
        payeeId: targetPayeeId,
        amount,
        settledAt: today,
      },
    });

    return apiSuccess({
      settlementId: insertedSettlement[0]?.id || 1,
      status: 'COMPLETED',
      amount,
      payerId: userId,
      payeeId: targetPayeeId,
      settledAt: Date.now(),
    });
  }),
  { rateLimit: 'apiStrict' }
);
