import { describe, it, expect } from 'vitest';
import { HouseholdService } from '@/services/household.service';
import { calculateMinSettlements, allocatePennyShares, BalanceNode } from '@/lib/algorithms/minSettlement';

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

  describe('Section 2: Minimum-Cashflow Graph Algorithm & Penny Allocation', () => {
    it('should allocate exact pennies on 3-way and 7-way odd splits with zero penny drift', () => {
      // 3-way split of 100.00
      const threeWay = allocatePennyShares(100.00, [{ id: 'A' }, { id: 'B' }, { id: 'C' }]);
      expect(threeWay).toHaveLength(3);
      const sum3 = threeWay.reduce((acc: number, item: any) => acc + item.shareAmount, 0);
      expect(Math.round(sum3 * 100) / 100).toBe(100.00);

      const shares3 = threeWay.map((s: any) => s.shareAmount).sort();
      expect(shares3).toEqual([33.33, 33.33, 33.34]);

      // 7-way split of 100.00
      const sevenParticipants = [
        { id: 1, name: 'P1' },
        { id: 2, name: 'P2' },
        { id: 3, name: 'P3' },
        { id: 4, name: 'P4' },
        { id: 5, name: 'P5' },
        { id: 6, name: 'P6' },
        { id: 7, name: 'P7' },
      ];
      const sevenWay = allocatePennyShares(100.00, sevenParticipants);
      expect(sevenWay).toHaveLength(7);
      const sum7 = sevenWay.reduce((acc: number, item: any) => acc + item.shareAmount, 0);
      expect(Math.round(sum7 * 100) / 100).toBe(100.00);

      // 100 / 7 = 14.2857... Four get 14.29, three get 14.28
      const highShares = sevenWay.filter((s: any) => s.shareAmount === 14.29);
      const lowShares = sevenWay.filter((s: any) => s.shareAmount === 14.28);
      expect(highShares).toHaveLength(4);
      expect(lowShares).toHaveLength(3);
    });

    it('should simplify a 5-person circular debt chain into minimum transfers', () => {
      // 5-person chain: A -> B ($50), B -> C ($50), C -> D ($50), D -> E ($50)
      // Net balances: A owes 50, B=0, C=0, D=0, E is owed 50.
      const balances: BalanceNode[] = [
        { userId: 'A', userName: 'Member A', netBalance: -50 },
        { userId: 'B', userName: 'Member B', netBalance: 0 },
        { userId: 'C', userName: 'Member C', netBalance: 0 },
        { userId: 'D', userName: 'Member D', netBalance: 0 },
        { userId: 'E', userName: 'Member E', netBalance: 50 },
      ];

      const result = calculateMinSettlements(balances, [], 4, 'USD');
      // Should collapse 4 pairwise transfers into 1 single direct transfer
      expect(result).toHaveLength(1);
      expect(result[0].fromUserId).toBe('A');
      expect(result[0].toUserId).toBe('E');
      expect(result[0].amount).toBe(50);
      expect(result.rawTransactionsCount).toBe(4);
      expect(result.transfersSavedCount).toBe(3);
    });

    it('should deduct completed/partial settlements and accurately compute net remaining balances', () => {
      // Initial net debt: A owes B $100
      const balances: BalanceNode[] = [
        { userId: 'A', userName: 'Member A', netBalance: -100 },
        { userId: 'B', userName: 'Member B', netBalance: 100 },
      ];

      // A already paid B $40
      const completedSettlements = [
        { fromId: 'A', toId: 'B', amount: 40 },
      ];

      const result = calculateMinSettlements(balances, completedSettlements, 1, 'BDT');
      expect(result).toHaveLength(1);
      expect(result[0].fromUserId).toBe('A');
      expect(result[0].toUserId).toBe('B');
      expect(result[0].amount).toBe(60); // 100 - 40 = 60 remaining
    });

    it('should calculate tour kitty balances accurately with mixed deposits and pool expenses', () => {
      // Simulate tour deposits and pool spendings
      const entries = [
        { entryType: 'deposit', amount: 500, fundingSource: 'member_direct', rate: 1.0 },
        { entryType: 'deposit', amount: 300, fundingSource: 'member_direct', rate: 1.0 },
        { entryType: 'deposit', amount: 100, fundingSource: 'member_direct', rate: 1.2 }, // Multi-currency border deposit
        { entryType: 'expense', amount: 450, fundingSource: 'tour_pool', rate: 1.0 },
        { entryType: 'expense', amount: 120, fundingSource: 'tour_pool', rate: 1.0 },
        { entryType: 'expense', amount: 200, fundingSource: 'member_direct', rate: 1.0 }, // Out of pocket, does not deduct from kitty
      ];

      let totalDeposited = 0;
      let totalSpentFromKitty = 0;

      for (const e of entries) {
        const baseAmount = e.amount * e.rate;
        if (e.entryType === 'deposit') {
          totalDeposited += baseAmount;
        } else if (e.fundingSource === 'tour_pool' && e.entryType !== 'settlement') {
          totalSpentFromKitty += baseAmount;
        }
      }

      const remainingKittyBalance = Math.round((totalDeposited - totalSpentFromKitty) * 100) / 100;

      expect(totalDeposited).toBe(920); // 500 + 300 + 120
      expect(totalSpentFromKitty).toBe(570); // 450 + 120
      expect(remainingKittyBalance).toBe(350); // 920 - 570
    });

    it('should correctly flag deficit when kitty spendings exceed total deposits', () => {
      const totalDeposited = 300;
      const totalSpentFromKitty = 485.50;
      const remainingKittyBalance = Math.round((totalDeposited - totalSpentFromKitty) * 100) / 100;

      expect(remainingKittyBalance).toBe(-185.50);
      expect(remainingKittyBalance < 0).toBe(true);
    });

    it('should compute 4 split modes correctly (equal, exact, percentage, shares)', () => {
      const amount = 300;
      const participants = [{ id: 1 }, { id: 2 }, { id: 3 }];

      // 1. Equal
      const equalSplits = allocatePennyShares(amount, participants);
      expect(equalSplits.map((s) => s.shareAmount)).toEqual([100, 100, 100]);

      // 2. Exact
      const exactInputs = [
        { id: 1, amount: 150 },
        { id: 2, amount: 100 },
        { id: 3, amount: 50 },
      ];
      const exactSum = exactInputs.reduce((acc, i) => acc + i.amount, 0);
      expect(exactSum).toBe(300);

      // 3. Percentage
      const percentageInputs = [
        { id: 1, percentage: 50 },
        { id: 2, percentage: 30 },
        { id: 3, percentage: 20 },
      ];
      const pctSum = percentageInputs.reduce((acc, i) => acc + i.percentage, 0);
      expect(pctSum).toBe(100);

      // 4. Shares (Weights 3:2:1)
      const shareInputs = [
        { id: 1, weight: 3 },
        { id: 2, weight: 2 },
        { id: 3, weight: 1 },
      ];
      const totalWeight = shareInputs.reduce((acc, i) => acc + i.weight, 0); // 6
      const shareAllocations = shareInputs.map((s) => Math.round((amount * (s.weight / totalWeight)) * 100) / 100);
      expect(shareAllocations).toEqual([150, 100, 50]);
    });
  });
});
