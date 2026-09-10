export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { db } from '@/db/client';
import {
  householdExpenses,
  householdSettlements,
  householdSplitRules,
  householdMembers,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encryptNumber } from '@/lib/crypto/encryption';
import { broadcastHouseholdUpdate } from '@/lib/household-sync';

/**
 * POST /api/households/expenses
 * Reconciled write path:
 * 1. Insert householdExpenses
 * 2. Look up active householdSplitRules or fall back to equal split
 * 3. Fan-out insert into householdSettlements with encryptedAmount
 * 4. Broadcast SSE refresh
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
    } = body;

    if (!householdId || typeof amount !== 'number' || amount <= 0 || !description) {
      return apiError(
        new ValidationError('Invalid expense parameters: householdId, amount > 0, and description are required', ErrorCode.INVALID_INPUT)
      );
    }

    const hhId = Number(householdId);
    const payerId = paidByUserId ? Number(paidByUserId) : userId;

    // 1. Insert into canonical householdExpenses
    const inserted = await db
      .insert(householdExpenses)
      .values({
        householdId: hhId,
        userId: payerId,
        description,
        amount,
        category,
        splitBetween: splitMode === 'custom' && customRatios ? JSON.stringify(customRatios) : 'all',
      })
      .returning({ id: householdExpenses.id });

    const expenseId = inserted[0]?.id;

    // 2. Fetch all members of the household
    const members = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, hhId));

    const memberIds = members.map((m) => m.userId);
    if (!memberIds.includes(payerId)) {
      memberIds.push(payerId);
    }

    // 3. Look up active split rule for this household if not explicitly passed as custom
    let activeRule = null;
    if (splitMode === 'equal' || !customRatios) {
      const rules = await db
        .select()
        .from(householdSplitRules)
        .where(
          and(
            eq(householdSplitRules.householdId, hhId),
            eq(householdSplitRules.active, 1)
          )
        );

      if (rules.length > 0) {
        // Match by category or take first general rule
        activeRule = rules.find((r) => r.category === category) || rules[0];
      }
    }

    // 4. Calculate member owed shares and fan-out into householdSettlements
    const numMembers = memberIds.length || 1;
    const settlementsToInsert: Array<{
      householdId: number;
      payerId: number;
      payeeId: number;
      amount: number;
      encryptedAmount: string;
      sourceRuleId?: number | null;
      status: 'pending' | 'settled';
    }> = [];

    for (const memberId of memberIds) {
      // Payer does not owe themselves
      if (memberId === payerId) continue;

      let memberOwed = amount / numMembers; // Default equal

      if (customRatios && typeof customRatios === 'object' && customRatios[memberId] !== undefined) {
        const sharePct = customRatios[memberId];
        memberOwed = (amount * sharePct) / 100;
      } else if (activeRule) {
        if (activeRule.splitType === 'percentage' && activeRule.splitShares) {
          try {
            const shares = JSON.parse(activeRule.splitShares);
            const pct = shares[String(memberId)] ?? (100 / numMembers);
            memberOwed = (amount * pct) / 100;
          } catch {
            memberOwed = amount / numMembers;
          }
        } else if (activeRule.splitType === 'fixed' && activeRule.splitShares) {
          try {
            const shares = JSON.parse(activeRule.splitShares);
            memberOwed = shares[String(memberId)] ?? (amount / numMembers);
          } catch {
            memberOwed = amount / numMembers;
          }
        }
      }

      if (memberOwed > 0) {
        settlementsToInsert.push({
          householdId: hhId,
          payerId: memberId, // The member who owes money
          payeeId: payerId,  // The member who paid the expense
          amount: Math.round(memberOwed * 100) / 100,
          encryptedAmount: encryptNumber(Math.round(memberOwed * 100) / 100, 'household-settlement'),
          sourceRuleId: activeRule?.id || null,
          status: 'pending',
        });
      }
    }

    if (settlementsToInsert.length > 0) {
      await db.insert(householdSettlements).values(settlementsToInsert);
    }

    // 5. Broadcast real-time SSE update to connected household members
    broadcastHouseholdUpdate(hhId, {
      type: 'EXPENSE_ADDED',
      data: {
        expenseId,
        amount,
        payerId,
        description,
        settlementsCount: settlementsToInsert.length,
      },
    });

    return apiSuccess({
      expenseId,
      totalAmount: amount,
      payerId,
      settlementsCreated: settlementsToInsert.length,
      settlements: settlementsToInsert.map((s) => ({
        payerId: s.payerId,
        payeeId: s.payeeId,
        amount: s.amount,
        status: s.status,
      })),
    });
  }),
  { rateLimit: 'api' }
);
