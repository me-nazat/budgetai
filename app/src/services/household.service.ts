/**
 * @fileoverview Household Service — business logic & settlement engine.
 *
 * Implements net balance calculation and minimal cash-flow debt simplification
 * for household expenses, supporting auto-split recurring bills.
 *
 * @module services/household.service
 */

import { HouseholdRepository } from '@/repositories/household.repository';

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
   * Calculates net balances for all members in a household.
   */
  static async calculateBalances(householdId: number): Promise<{
    memberBalances: NetMemberBalance[];
    suggestedSettlements: SuggestedSettlement[];
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

      // Determine target participants
      let targetUserIds: number[] = [];
      if (exp.splitBetween === 'all' || !exp.splitBetween) {
        targetUserIds = members.map((m) => m.userId);
      } else {
        try {
          const parsed = JSON.parse(exp.splitBetween);
          if (Array.isArray(parsed) && parsed.length > 0) {
            targetUserIds = parsed;
          } else {
            targetUserIds = members.map((m) => m.userId);
          }
        } catch {
          targetUserIds = members.map((m) => m.userId);
        }
      }

      const sharePerPerson = totalAmount / targetUserIds.length;

      // Payer paid totalAmount
      balancesMap.set(payerId, (balancesMap.get(payerId) || 0) + totalAmount);

      // Each participant owes their share
      for (const targetId of targetUserIds) {
        balancesMap.set(targetId, (balancesMap.get(targetId) || 0) - sharePerPerson);
      }
    }

    // Process settled transfers
    for (const st of settlements) {
      if (st.status === 'settled') {
        // payerId paid payeeId
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

    // Compute min-cash-flow greedy settlements
    const suggestedSettlements = this.computeMinCashFlowSettlements(memberBalances);

    return { memberBalances, suggestedSettlements };
  }

  /**
   * Greedy min-cash-flow debt simplification algorithm.
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

    // Sort descending by amount
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
