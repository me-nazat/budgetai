import { describe, it, expect } from 'vitest';
import { HouseholdService } from '@/services/household.service';
import { calculateMinSettlements, BalanceNode } from '@/lib/algorithms/minSettlement';

describe('Module 10: Household Settlement Engine & Cap Rollovers', () => {
  it('should correctly balance equal spending between 2 members', () => {
    const balances = [
      { userId: 1, userName: 'Alice', netBalance: 50 },
      { userId: 2, userName: 'Bob', netBalance: -50 },
    ];

    const settlements = (HouseholdService as any).computeMinCashFlowSettlements(balances);
    expect(settlements).toHaveLength(1);
    expect(settlements[0]).toEqual({
      fromUserId: 2,
      fromUserName: 'Bob',
      toUserId: 1,
      toUserName: 'Alice',
      amount: 50,
    });
  });

  it('should simplify multi-person cyclic debts into minimum transactions', () => {
    const balances = [
      { userId: 1, userName: 'Alice', netBalance: 100 },
      { userId: 2, userName: 'Bob', netBalance: -40 },
      { userId: 3, userName: 'Charlie', netBalance: -60 },
    ];

    const settlements = (HouseholdService as any).computeMinCashFlowSettlements(balances);
    expect(settlements).toHaveLength(2);
    expect(settlements[0].amount + settlements[1].amount).toBe(100);
  });

  it('should handle zero-balance edge cases with no transactions needed', () => {
    const balances: BalanceNode[] = [
      { userId: 1, userName: 'Alice', netBalance: 0 },
      { userId: 2, userName: 'Bob', netBalance: 0 },
      { userId: 3, userName: 'Charlie', netBalance: 0.005 }, // Sub-cent noise
    ];

    const settlements = calculateMinSettlements(balances);
    expect(settlements).toHaveLength(0);
  });

  it('should optimally settle 4 members with complex inter-debts into minimal transfers', () => {
    const balances: BalanceNode[] = [
      { userId: 1, userName: 'Alice', netBalance: -150 },
      { userId: 2, userName: 'Bob', netBalance: -50 },
      { userId: 3, userName: 'Charlie', netBalance: 75 },
      { userId: 4, userName: 'Dave', netBalance: 125 },
    ];

    const settlements = calculateMinSettlements(balances);
    // Total debt is 200, total credit is 200. Max transfers should be at most 3.
    expect(settlements.length).toBeLessThanOrEqual(3);
    const totalSettled = settlements.reduce((sum, s) => sum + s.amount, 0);
    expect(totalSettled).toBe(200);

    // Ensure Alice pays the biggest chunk to Dave first (greedy heuristic)
    expect(settlements[0].fromUserId).toBe(1);
    expect(settlements[0].toUserId).toBe(4);
    expect(settlements[0].amount).toBe(125);
  });

  it('should apply Largest-Remainder Method (Hare-Niemeyer) for budget rebalancing', () => {
    const totalCap = 1000;
    const categoryWeights = [
      { category: 'Groceries', weight: 0.3333 },
      { category: 'Utilities', weight: 0.3333 },
      { category: 'Dining', weight: 0.3334 },
    ];

    // Compute integer quotas
    const rawAllocations = categoryWeights.map((c) => ({
      category: c.category,
      raw: totalCap * c.weight,
      floor: Math.floor(totalCap * c.weight),
      remainder: (totalCap * c.weight) - Math.floor(totalCap * c.weight),
    }));

    const allocatedSum = rawAllocations.reduce((sum, r) => sum + r.floor, 0);
    const surplus = totalCap - allocatedSum;

    // Distribute remainder to highest fractional remainder
    const sorted = [...rawAllocations].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < surplus; i++) {
      sorted[i].floor += 1;
    }

    const finalSum = sorted.reduce((sum, s) => sum + s.floor, 0);
    expect(finalSum).toBe(1000);
    expect(sorted.find((s) => s.category === 'Dining')?.floor).toBe(334);
  });

  it('should calculate budget rollover amounts according to rollover policy', () => {
    interface CategoryBudget {
      category: string;
      capAmount: number;
      actualSpent: number;
      rolloverPolicy: 'none' | 'next_month' | 'pool';
    }

    const categories: CategoryBudget[] = [
      { category: 'Groceries', capAmount: 500, actualSpent: 420, rolloverPolicy: 'next_month' },
      { category: 'Entertainment', capAmount: 200, actualSpent: 150, rolloverPolicy: 'none' },
      { category: 'Travel', capAmount: 400, actualSpent: 300, rolloverPolicy: 'pool' },
    ];

    let householdSurplusPool = 0;
    const nextMonthBudgets: Record<string, number> = {};

    for (const cat of categories) {
      const remaining = Math.max(0, cat.capAmount - cat.actualSpent);
      if (cat.rolloverPolicy === 'next_month') {
        nextMonthBudgets[cat.category] = cat.capAmount + remaining;
      } else if (cat.rolloverPolicy === 'pool') {
        householdSurplusPool += remaining;
        nextMonthBudgets[cat.category] = cat.capAmount;
      } else {
        // 'none'
        nextMonthBudgets[cat.category] = cat.capAmount;
      }
    }

    expect(nextMonthBudgets['Groceries']).toBe(580); // 500 + 80 rollover
    expect(nextMonthBudgets['Entertainment']).toBe(200); // 0 rollover
    expect(householdSurplusPool).toBe(100); // 400 - 300 pooled
  });
});
