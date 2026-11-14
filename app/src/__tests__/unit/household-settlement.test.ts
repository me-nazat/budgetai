import { describe, it, expect } from 'vitest';
import { HouseholdService } from '@/services/household.service';

describe('Module 10: Household Settlement Engine', () => {
  it('should correctly balance equal spending between 2 members', () => {
    const balances = [
      { userId: 1, userName: 'Alice', netBalance: 50 },
      { userId: 2, userName: 'Bob', netBalance: -50 },
    ];

    // Access private static method for testing
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
});
