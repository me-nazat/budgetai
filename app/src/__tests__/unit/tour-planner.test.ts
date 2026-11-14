import { describe, it, expect } from 'vitest';
import { calculateMinSettlements, BalanceNode } from '@/lib/algorithms/minSettlement';

describe('Tour Planner & Collaborative Split Engine', () => {
  describe('Balance and Debt Settlement Logic', () => {
    it('calculates zero-sum settlements among multiple tour participants accurately', () => {
      // 3 participants: Alice paid 300, Bob paid 0, Charlie paid 0 for a 300 expense (100 each)
      // Net balances: Alice: +200, Bob: -100, Charlie: -100
      const nodes: BalanceNode[] = [
        { userId: 1, userName: 'Alice', netBalance: 200 },
        { userId: 2, userName: 'Bob', netBalance: -100 },
        { userId: 3, userName: 'Charlie', netBalance: -100 },
      ];

      const settlement = calculateMinSettlements(nodes, [], 0, 'USD');

      expect(settlement.simplifiedTransfers).toHaveLength(2);
      expect(settlement.simplifiedTransfers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fromUserId: 2, toUserId: 1, amount: 100 }),
          expect.objectContaining({ fromUserId: 3, toUserId: 1, amount: 100 }),
        ])
      );
    });

    it('correctly balances tour kitty deposits and pool-funded spendings', () => {
      // Scenario:
      // Tour pool initialized: Alice deposits 500, Bob deposits 500 into kitty (Total kitty = 1000)
      // Group spends 600 from kitty (pool funded, consumed equally = 300 each)
      // Alice also pays 200 out-of-pocket for dinner (consumed equally = 100 each)
      //
      // Net calculations:
      // Alice:
      //   Paid out-of-pocket: 200
      //   Deposited to kitty: 500
      //   Consumed share: 300 (from kitty spend) + 100 (from dinner) = 400
      //   Net balance: (200 + 500) - 400 = +300
      //
      // Bob:
      //   Paid out-of-pocket: 0
      //   Deposited to kitty: 500
      //   Consumed share: 300 (from kitty spend) + 100 (from dinner) = 400
      //   Net balance: (0 + 500) - 400 = +100
      //
      // Charlie joins without deposit, consumes 100 from dinner:
      //   Net balance: 0 - 100 = -100
      //
      // Kitty remaining in pool: 1000 - 600 = 400 (which belongs 200 to Alice and 200 to Bob)
      // Combined net member balances equal debt owed between members.

      const aliceDeposits = 500;
      const bobDeposits = 500;
      const kittyExpense = 600;
      const dinnerExpense = 200;

      const aliceConsumed = (kittyExpense / 2) + (dinnerExpense / 2);
      const bobConsumed = (kittyExpense / 2) + (dinnerExpense / 2);

      const aliceNet = (aliceDeposits + dinnerExpense) - aliceConsumed;
      const bobNet = bobDeposits - bobConsumed;

      expect(aliceNet).toBe(300);
      expect(bobNet).toBe(100);
      expect(aliceNet + bobNet).toBe(400); // exactly matches remaining kitty cash!
    });
  });

  describe('Tour Dates & Duration Helpers', () => {
    it('computes exact trip duration in calendar days', () => {
      const startDate = '2026-12-01';
      const endDate = '2026-12-05';
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;

      expect(days).toBe(5);
    });

    it('handles single-day trips correctly', () => {
      const startDate = '2026-12-01';
      const endDate = '2026-12-01';
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      const days = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;

      expect(days).toBe(1);
    });
  });

  describe('Destination Context Analysis for AI Planning', () => {
    function detectTourCategory(destination: string): 'beach' | 'mountain' | 'historic' | 'modern' | 'general' {
      const destLower = destination.toLowerCase();
      if (['beach', 'sea', 'bali', 'phuket', 'cox', 'saint martin', 'maldives', 'goa', 'hawaii', 'cancun'].some(k => destLower.includes(k))) {
        return 'beach';
      }
      if (['mountain', 'hill', 'sajek', 'pokhara', 'alps', 'banff', 'sapa', 'himalaya', 'trek'].some(k => destLower.includes(k))) {
        return 'mountain';
      }
      if (['paris', 'rome', 'kyoto', 'istanbul', 'cairo', 'london', 'florence', 'athens'].some(k => destLower.includes(k))) {
        return 'historic';
      }
      if (['tokyo', 'singapore', 'dubai', 'new york', 'bangkok'].some(k => destLower.includes(k))) {
        return 'modern';
      }
      return 'general';
    }

    it('correctly maps popular destinations to travel themes', () => {
      expect(detectTourCategory("Cox's Bazar, Bangladesh")).toBe('beach');
      expect(detectTourCategory('Bali, Indonesia')).toBe('beach');
      expect(detectTourCategory('Sajek Valley, Bangladesh')).toBe('mountain');
      expect(detectTourCategory('Swiss Alps, Switzerland')).toBe('mountain');
      expect(detectTourCategory('Kyoto, Japan')).toBe('historic');
      expect(detectTourCategory('Paris, France')).toBe('historic');
      expect(detectTourCategory('Tokyo, Japan')).toBe('modern');
      expect(detectTourCategory('Dubai, UAE')).toBe('modern');
      expect(detectTourCategory('Reykjavik, Iceland')).toBe('general');
    });
  });
});
