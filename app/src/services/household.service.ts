/**
 * @fileoverview Household Service — business logic & settlement engine.
 *
 * Implements net balance calculation and minimal cash-flow debt simplification
 * for household expenses, supporting auto-split recurring bills, proportional split rules,
 * category spending cap enforcement, and personal bank account ledger synchronization.
 *
 * @module services/household.service
 */

import { db } from '@/db/client';
import {
  householdMembers,
  householdExpenses,
  householdSettlements,
  householdSplitRules,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { HouseholdRepository } from '@/repositories/household.repository';
import {
  allocatePennyShares,
  calculateMinSettlements,
  type BalanceNode,
  type ParticipantShareInput,
} from '@/lib/algorithms/minSettlement';
import {
  syncHouseholdExpenseToPersonalLedger,
  broadcastHouseholdUpdate,
} from '@/lib/household-sync';
import { encryptNumber } from '@/lib/crypto/encryption';

export interface NetMemberBalance {
  userId: number;
  userName: string;
  netBalance: number; // positive = owed money, negative = owes money
}

export interface SuggestedSettlement {
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  amount: number;
}

export class HouseholdService {
  /**
   * Automatically determines split percentages using strict priority order:
   * 1. Explicit custom split passed in payload.
   * 2. Category-specific rule configured in householdSplitRules.
   * 3. Household member allocation weights (defaultAllocationPercentage or incomeWeight).
   * 4. Equal split fallback (100 / memberCount).
   */
  static async determineSplitShares(
    householdId: number,
    amount: number,
    category: string,
    customSplits?: Record<string | number, number> | Array<{ userId: number; percentage?: number; amount?: number; weight?: number }>
  ): Promise<{
    splitBreakdown: Array<{
      userId: number;
      userName: string;
      shareAmount: number;
      sharePercentage: number;
      shareWeight: number;
    }>;
    strategy: 'custom' | 'category_rule' | 'allocation_weight' | 'equal_fallback';
  }> {
    const members = await HouseholdRepository.findMembers(householdId);
    const membersWithWeights = await db
      .select({
        userId: householdMembers.userId,
        incomeWeight: householdMembers.incomeWeight,
        defaultAllocationPercentage: householdMembers.defaultAllocationPercentage,
      })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));

    const weightMap = new Map(membersWithWeights.map((m) => [m.userId, m]));
    const nameMap = new Map(members.map((m) => [m.userId, m.userName || `User #${m.userId}`]));

    if (members.length === 0) {
      return { splitBreakdown: [], strategy: 'equal_fallback' };
    }

    // Priority 1: Explicit custom split
    if (customSplits) {
      const inputs: ParticipantShareInput[] = [];
      if (Array.isArray(customSplits) && customSplits.length > 0) {
        customSplits.forEach((cs) => {
          const w = cs.percentage ?? cs.amount ?? cs.weight ?? 1.0;
          inputs.push({
            id: cs.userId,
            name: nameMap.get(cs.userId),
            weight: w,
          });
        });
      } else if (typeof customSplits === 'object' && Object.keys(customSplits).length > 0) {
        for (const [key, val] of Object.entries(customSplits)) {
          const uId = Number(key);
          inputs.push({
            id: uId,
            name: nameMap.get(uId),
            weight: Number(val),
          });
        }
      }

      if (inputs.length > 0) {
        const allocated = allocatePennyShares(amount, inputs);
        return {
          splitBreakdown: allocated.map((a) => ({
            userId: Number(a.id),
            userName: a.name || nameMap.get(Number(a.id)) || `User #${a.id}`,
            shareAmount: a.shareAmount,
            sharePercentage: a.sharePercentage,
            shareWeight: inputs.find((i) => i.id === a.id)?.weight ?? 1,
          })),
          strategy: 'custom',
        };
      }
    }

    // Priority 2: Category-specific rule
    const rules = await db
      .select()
      .from(householdSplitRules)
      .where(
        and(
          eq(householdSplitRules.householdId, householdId),
          eq(householdSplitRules.active, 1)
        )
      );

    const categoryRule =
      rules.find((r) => r.category.toLowerCase() === category.toLowerCase()) ||
      rules.find((r) => r.category === 'All');

    if (categoryRule && categoryRule.splitShares) {
      try {
        const parsed = JSON.parse(categoryRule.splitShares);
        const inputs: ParticipantShareInput[] = [];
        for (const [key, val] of Object.entries(parsed)) {
          const uId = Number(key);
          inputs.push({
            id: uId,
            name: nameMap.get(uId),
            weight: Number(val),
          });
        }
        if (inputs.length > 0) {
          const allocated = allocatePennyShares(amount, inputs);
          return {
            splitBreakdown: allocated.map((a) => ({
              userId: Number(a.id),
              userName: a.name || nameMap.get(Number(a.id)) || `User #${a.id}`,
              shareAmount: a.shareAmount,
              sharePercentage: a.sharePercentage,
              shareWeight: inputs.find((i) => i.id === a.id)?.weight ?? 1,
            })),
            strategy: 'category_rule',
          };
        }
      } catch {
        // Fall through to priority 3
      }
    }

    // Priority 3: Household member allocation weights (HouseholdAllocationWheel)
    const hasCustomAllocations = membersWithWeights.some(
      (m) =>
        (typeof m.defaultAllocationPercentage === 'number' && m.defaultAllocationPercentage > 0) ||
        (typeof m.incomeWeight === 'number' && m.incomeWeight !== 1.0)
    );

    if (hasCustomAllocations) {
      const inputs: ParticipantShareInput[] = members.map((m) => {
        const mw = weightMap.get(m.userId);
        const weight = mw?.defaultAllocationPercentage ?? mw?.incomeWeight ?? 1.0;
        return {
          id: m.userId,
          name: m.userName,
          weight: Number(weight),
        };
      });

      const allocated = allocatePennyShares(amount, inputs);
      return {
        splitBreakdown: allocated.map((a) => ({
          userId: Number(a.id),
          userName: a.name || nameMap.get(Number(a.id)) || `User #${a.id}`,
          shareAmount: a.shareAmount,
          sharePercentage: a.sharePercentage,
          shareWeight: inputs.find((i) => i.id === a.id)?.weight ?? 1,
        })),
        strategy: 'allocation_weight',
      };
    }

    // Priority 4: Equal split fallback
    const inputs: ParticipantShareInput[] = members.map((m) => ({
      id: m.userId,
      name: m.userName,
      weight: 1.0,
    }));

    const allocated = allocatePennyShares(amount, inputs);
    return {
      splitBreakdown: allocated.map((a) => ({
        userId: Number(a.id),
        userName: a.name || nameMap.get(Number(a.id)) || `User #${a.id}`,
        shareAmount: a.shareAmount,
        sharePercentage: a.sharePercentage,
        shareWeight: 1,
      })),
      strategy: 'equal_fallback',
    };
  }

  /**
   * Creates a household expense using strict split priority, checks spending caps,
   * updates the personal ledger, and fans out pending settlements.
   */
  static async createHouseholdExpense(params: {
    householdId: number;
    userId: number;
    description: string;
    amount: number;
    category?: string;
    fundingAccountId?: number | null;
    customSplits?: Record<string | number, number> | Array<{ userId: number; percentage?: number; amount?: number; weight?: number }>;
    date?: string;
  }) {
    const {
      householdId,
      userId,
      description,
      amount,
      category = 'Other',
      fundingAccountId,
      customSplits,
      date = new Date().toISOString().split('T')[0],
    } = params;

    // 1. Check category cap
    const capCheck = await HouseholdRepository.checkCategoryCap(householdId, category, amount);
    const capWarning = capCheck.capExceeded;

    // 2. Determine split shares
    const { splitBreakdown, strategy } = await this.determineSplitShares(
      householdId,
      amount,
      category,
      customSplits
    );

    const payerShare = splitBreakdown.find((s) => s.userId === userId)?.shareAmount || 0;
    const splitBreakdownJson = JSON.stringify(splitBreakdown);

    // 3. Insert into householdExpenses
    const [expense] = await db
      .insert(householdExpenses)
      .values({
        householdId,
        userId,
        payerUserId: userId,
        description,
        amount,
        category,
        fundingAccountId: fundingAccountId || null,
        personalShareAmount: payerShare,
        splitBreakdownJson,
        splitBetween: splitBreakdownJson,
      })
      .returning();

    let linkedTransactionId: number | undefined;

    // 4. Sync to personal ledger if funding account provided
    if (fundingAccountId) {
      const syncRes = await syncHouseholdExpenseToPersonalLedger({
        householdId,
        expenseId: expense.id,
        totalAmount: amount,
        category,
        description,
        payerUserId: userId,
        fundingAccountId,
        personalShareAmount: payerShare,
        currentUserId: userId,
        date,
      });
      linkedTransactionId = syncRes.linkedTransactionId;
      if (linkedTransactionId) {
        await db
          .update(householdExpenses)
          .set({ linkedTransactionId })
          .where(eq(householdExpenses.id, expense.id));
      }
    }

    // 5. Fan-out insert pending settlement records for other members
    const settlementsToInsert = splitBreakdown
      .filter((s) => s.userId !== userId && s.shareAmount > 0)
      .map((s) => ({
        householdId,
        payerId: s.userId, // debtor
        payeeId: userId,   // creditor
        amount: s.shareAmount,
        encryptedAmount: encryptNumber(s.shareAmount, 'household-settlement'),
        status: 'pending' as const,
      }));

    if (settlementsToInsert.length > 0) {
      await db.insert(householdSettlements).values(settlementsToInsert);
    }

    // 6. Broadcast SSE
    broadcastHouseholdUpdate(householdId, {
      type: 'EXPENSE_ADDED',
      data: {
        expenseId: expense.id,
        amount,
        payerId: userId,
        description,
        capWarning,
      },
    });

    return {
      expense: {
        ...expense,
        linkedTransactionId: linkedTransactionId ?? expense.linkedTransactionId,
      },
      splitBreakdown,
      strategy,
      capWarning,
      capDetails: capCheck,
      settlementsCreated: settlementsToInsert.length,
    };
  }

  /**
   * Calculates net balances for all members in a household using minSettlement debt simplification.
   */
  static async calculateBalances(householdId: number): Promise<{
    memberBalances: NetMemberBalance[];
    suggestedSettlements: SuggestedSettlement[];
    metrics?: {
      rawTransactionsCount: number;
      simplifiedTransfers: any[];
      transfersSavedCount: number;
    };
  }> {
    const members = await HouseholdRepository.findMembers(householdId);
    const expenses = await HouseholdRepository.findExpenses(householdId);
    const settlements = await HouseholdRepository.findSettlements(householdId);

    if (members.length === 0) {
      return { memberBalances: [], suggestedSettlements: [] };
    }

    // Map member balances: userId -> net amount
    const balancesMap = new Map<number, number>();
    members.forEach((m) => balancesMap.set(m.userId, 0));

    // Process expenses
    for (const exp of expenses) {
      const payerId = exp.userId;
      const totalAmount = exp.amount;

      let hasCustomBreakdown = false;
      const rawBreakdown = (exp as any).splitBreakdownJson || exp.splitBetween;
      if (rawBreakdown && rawBreakdown !== 'all') {
        try {
          const parsed = JSON.parse(rawBreakdown);
          if (Array.isArray(parsed) && parsed.length > 0) {
            hasCustomBreakdown = true;
            balancesMap.set(payerId, (balancesMap.get(payerId) || 0) + totalAmount);
            for (const item of parsed) {
              const uId = Number(item.userId ?? item.id);
              const share = Number(item.shareAmount ?? item.amount ?? 0);
              balancesMap.set(uId, (balancesMap.get(uId) || 0) - share);
            }
          }
        } catch {
          hasCustomBreakdown = false;
        }
      }

      if (!hasCustomBreakdown) {
        const sharePerPerson = totalAmount / members.length;
        balancesMap.set(payerId, (balancesMap.get(payerId) || 0) + totalAmount);
        for (const m of members) {
          balancesMap.set(m.userId, (balancesMap.get(m.userId) || 0) - sharePerPerson);
        }
      }
    }

    // Process settled transfers
    for (const st of settlements) {
      if (st.status === 'settled') {
        balancesMap.set(st.payerId, (balancesMap.get(st.payerId) || 0) + st.amount);
        balancesMap.set(st.payeeId, (balancesMap.get(st.payeeId) || 0) - st.amount);
      }
    }

    // Build member balances array
    const memberBalances: NetMemberBalance[] = members.map((m) => ({
      userId: m.userId,
      userName: m.userName || `User #${m.userId}`,
      netBalance: Math.round((balancesMap.get(m.userId) || 0) * 100) / 100,
    }));

    const balanceNodes: BalanceNode[] = memberBalances.map((m) => ({
      userId: m.userId,
      userName: m.userName,
      netBalance: m.netBalance,
    }));

    const minTransfers = calculateMinSettlements(balanceNodes);
    const suggestedSettlements: SuggestedSettlement[] = minTransfers.map((p) => ({
      fromUserId: Number(p.fromUserId),
      fromUserName: p.fromUserName || `User #${p.fromUserId}`,
      toUserId: Number(p.toUserId),
      toUserName: p.toUserName || `User #${p.toUserId}`,
      amount: p.amount,
    }));

    return {
      memberBalances,
      suggestedSettlements,
      metrics: {
        rawTransactionsCount: minTransfers.rawTransactionsCount,
        simplifiedTransfers: minTransfers.simplifiedTransfers,
        transfersSavedCount: minTransfers.transfersSavedCount,
      },
    };
  }

  /**
   * Greedy min-cash-flow debt simplification algorithm (maintained for direct unit test calls).
   */
  private static computeMinCashFlowSettlements(balances: NetMemberBalance[]): SuggestedSettlement[] {
    const debtors: { userId: number; name: string; amount: number }[] = [];
    const creditors: { userId: number; name: string; amount: number }[] = [];

    for (const b of balances) {
      if (b.netBalance < -0.01) {
        debtors.push({ userId: b.userId, name: b.userName, amount: Math.abs(b.netBalance) });
      } else if (b.netBalance > 0.01) {
        creditors.push({ userId: b.userId, name: b.userName, amount: b.netBalance });
      }
    }

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const result: SuggestedSettlement[] = [];
    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const settlementAmount = Math.min(debtor.amount, creditor.amount);
      if (settlementAmount > 0.01) {
        result.push({
          fromUserId: debtor.userId,
          fromUserName: debtor.name,
          toUserId: creditor.userId,
          toUserName: creditor.name,
          amount: Math.round(settlementAmount * 100) / 100,
        });
      }

      debtor.amount -= settlementAmount;
      creditor.amount -= settlementAmount;

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return result;
  }

  static async getHouseholdDetails(householdId: number) {
    const household = await HouseholdRepository.findById(householdId);
    if (!household) return null;

    const members = await HouseholdRepository.findMembers(householdId);
    const expenses = await HouseholdRepository.findExpenses(householdId);
    const caps = await HouseholdRepository.findCategoryCaps(householdId);
    const { memberBalances, suggestedSettlements } = await this.calculateBalances(householdId);

    return {
      household,
      members,
      expenses,
      categoryCaps: caps,
      memberBalances,
      suggestedSettlements,
    };
  }

  static async createHousehold(name: string, createdBy: number) {
    const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    return HouseholdRepository.createHousehold(name, inviteCode, createdBy);
  }

  static async joinHousehold(inviteCode: string, userId: number) {
    const household = await HouseholdRepository.findByInviteCode(inviteCode);
    if (!household) throw new Error('Invalid invite code');

    const existingMembers = await HouseholdRepository.findMembers(household.id);
    const isMember = existingMembers.some((m) => m.userId === userId);
    if (isMember) return household;

    await HouseholdRepository.addMember(household.id, userId, 'member');
    return household;
  }

  static async logExpense(
    householdId: number,
    userId: number,
    description: string,
    amount: number,
    category: string = 'Other',
    splitBetween: string = 'all'
  ) {
    return HouseholdRepository.createExpense(householdId, userId, description, amount, category, splitBetween);
  }

  static async settleUp(householdId: number, payerId: number, payeeId: number, amount: number) {
    return HouseholdRepository.createSettlement(householdId, payerId, payeeId, amount, 'settled');
  }
}
