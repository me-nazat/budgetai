import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BudgetService } from '@/services/budget.service';
import { BudgetRepository } from '@/repositories/budget.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AuditService } from '@/services/audit.service';

describe('Budget Envelope & Auto-Pacing Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditService, 'logUpdate').mockImplementation(() => {});
    vi.spyOn(AuditService, 'logCreate').mockImplementation(() => {});
    vi.spyOn(AuditService, 'logDelete').mockImplementation(() => {});
  });

  describe('Auto-pacing calculations and rollover metrics', () => {
    it('calculates on-track status when spend rate is below ideal burn rate', async () => {
      vi.spyOn(BudgetRepository, 'findByMonth').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          category: 'Groceries',
          monthlyLimit: 600,
          month: 10,
          year: 2026,
          rolloverEnabled: 0,
          rolloverBalance: 0,
          createdAt: '2026-10-01',
        },
      ]);

      vi.spyOn(TransactionRepository, 'getCategorySpending').mockResolvedValueOnce([
        { category: 'Groceries', total: 100 },
      ]);

      const results = await BudgetService.getByMonth(1, 10, 2026);
      expect(results).toHaveLength(1);
      const envelope = results[0];

      expect(envelope.monthlyLimit).toBe(600);
      expect(envelope.effectiveLimit).toBe(600);
      expect(envelope.spent).toBe(100);
      expect(envelope.remaining).toBe(500);
      expect(envelope.pacingStatus).toBe('on_track');
      expect(envelope.idealDailyBurn).toBeGreaterThan(0);
      expect(envelope.actualDailyBurn).toBeGreaterThan(0);
      expect(envelope.actualDailyBurn).toBeLessThanOrEqual(envelope.idealDailyBurn! * 1.15);
    });

    it('calculates pacing_fast status when daily burn significantly exceeds ideal burn', async () => {
      vi.spyOn(BudgetRepository, 'findByMonth').mockResolvedValueOnce([
        {
          id: 2,
          userId: 1,
          category: 'Dining Out',
          monthlyLimit: 300,
          month: 10,
          year: 2026,
          rolloverEnabled: 0,
          rolloverBalance: 0,
          createdAt: '2026-10-01',
        },
      ]);

      // Suppose spending is 280 on day 10 (burn = 28/day vs ideal = 300/31 = 9.67/day)
      vi.spyOn(TransactionRepository, 'getCategorySpending').mockResolvedValueOnce([
        { category: 'Dining Out', total: 280 },
      ]);

      const results = await BudgetService.getByMonth(1, 10, 2026);
      const envelope = results[0];

      expect(envelope.pacingStatus).toBe('pacing_fast');
      expect(envelope.pacingDeltaPercent).toBeGreaterThan(15);
    });

    it('calculates exhausted status when spend meets or exceeds effective limit', async () => {
      vi.spyOn(BudgetRepository, 'findByMonth').mockResolvedValueOnce([
        {
          id: 3,
          userId: 1,
          category: 'Shopping',
          monthlyLimit: 200,
          month: 10,
          year: 2026,
          rolloverEnabled: 0,
          rolloverBalance: 0,
          createdAt: '2026-10-01',
        },
      ]);

      vi.spyOn(TransactionRepository, 'getCategorySpending').mockResolvedValueOnce([
        { category: 'Shopping', total: 220 },
      ]);

      const results = await BudgetService.getByMonth(1, 10, 2026);
      const envelope = results[0];

      expect(envelope.pacingStatus).toBe('exhausted');
      expect(envelope.remaining).toBe(0);
    });

    it('incorporates rolloverBalance into effectiveLimit when rollover is enabled', async () => {
      vi.spyOn(BudgetRepository, 'findByMonth').mockResolvedValueOnce([
        {
          id: 4,
          userId: 1,
          category: 'Utilities',
          monthlyLimit: 150,
          month: 10,
          year: 2026,
          rolloverEnabled: 1,
          rolloverBalance: 50,
          createdAt: '2026-10-01',
        },
      ]);

      // Previous month mock
      vi.spyOn(BudgetRepository, 'findByMonth').mockResolvedValueOnce([
        {
          id: 99,
          userId: 1,
          category: 'Utilities',
          monthlyLimit: 150,
          month: 9,
          year: 2026,
          rolloverEnabled: 1,
          rolloverBalance: 0,
          createdAt: '2026-09-01',
        },
      ]);

      vi.spyOn(TransactionRepository, 'getCategorySpending')
        .mockResolvedValueOnce([{ category: 'Utilities', total: 80 }]) // Current month
        .mockResolvedValueOnce([{ category: 'Utilities', total: 100 }]); // Previous month surplus = 50

      const results = await BudgetService.getByMonth(1, 10, 2026);
      const envelope = results[0];

      expect(envelope.rolloverEnabled).toBe(true);
      expect(envelope.rolloverBalance).toBe(50);
      expect(envelope.effectiveLimit).toBe(200); // 150 + 50
      expect(envelope.spent).toBe(80);
      expect(envelope.remaining).toBe(120);
    });
  });

  describe('Envelope Rebalancing (Zero-Based Invariant)', () => {
    it('transfers surplus from one envelope to another without altering total budget', async () => {
      const mockFrom = {
        id: 1,
        userId: 1,
        category: 'Utilities',
        monthlyLimit: 150,
        month: 10,
        year: 2026,
        rolloverEnabled: 0,
        rolloverBalance: 0,
        createdAt: '2026-10-01',
      };

      const mockTo = {
        id: 2,
        userId: 1,
        category: 'Dining Out',
        monthlyLimit: 250,
        month: 10,
        year: 2026,
        rolloverEnabled: 0,
        rolloverBalance: 0,
        createdAt: '2026-10-01',
      };

      vi.spyOn(BudgetRepository, 'rebalance').mockResolvedValueOnce({
        from: { ...mockFrom, monthlyLimit: 100 },
        to: { ...mockTo, monthlyLimit: 300 },
      });

      const result = await BudgetService.rebalance(1, {
        fromBudgetId: 1,
        toBudgetId: 2,
        amount: 50,
        month: 10,
        year: 2026,
      });

      expect(result.from.monthlyLimit).toBe(100);
      expect(result.to.monthlyLimit).toBe(300);
      // Invariant: sum before (150 + 250 = 400) === sum after (100 + 300 = 400)
      expect(result.from.monthlyLimit + result.to.monthlyLimit).toBe(400);
    });
  });
});
