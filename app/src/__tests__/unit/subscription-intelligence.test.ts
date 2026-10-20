import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionService } from '@/services/recurring.service';
import { SubscriptionRepository } from '@/repositories/subscription.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AuditService } from '@/services/audit.service';

describe('Subscription Intelligence Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(AuditService, 'logUpdate').mockImplementation(() => {});
    vi.spyOn(AuditService, 'logCreate').mockImplementation(() => {});
    vi.spyOn(AuditService, 'logDelete').mockImplementation(() => {});
  });

  describe('Price-Hike Detection & Renewal Tracking', () => {
    it('detects price increases from historical transactions for matching merchants', async () => {
      vi.spyOn(SubscriptionRepository, 'findAll').mockResolvedValueOnce([
        {
          id: 1,
          userId: 1,
          name: 'Netflix Premium',
          amount: 22.99,
          currency: 'USD',
          billingCycle: 'monthly',
          nextRenewalDate: '2026-11-05',
          category: 'Entertainment',
          logoUrl: null,
          isActive: 1,
          trialEndsAt: null,
          previousAmount: null,
          accountId: null,
          cancelReminderDays: 3,
          createdAt: '2026-01-01',
        },
      ]);

      // Return past transactions showing Netflix price hike: older was 19.99, newest is 22.99
      vi.spyOn(TransactionRepository, 'findAll').mockResolvedValueOnce([
        {
          id: 101,
          userId: 1,
          type: 'expense',
          amount: 22.99,
          category: 'Entertainment',
          description: 'Netflix Premium Monthly',
          date: '2026-10-05',
        } as any,
        {
          id: 100,
          userId: 1,
          type: 'expense',
          amount: 19.99,
          category: 'Entertainment',
          description: 'Netflix Premium Monthly',
          date: '2026-09-05',
        } as any,
      ]);

      const subs = await SubscriptionService.getAll(1);
      expect(subs).toHaveLength(1);
      const sub = subs[0];

      expect(sub.priceHikeAlert).toBeDefined();
      expect(sub.priceHikeAlert?.detected).toBe(true);
      expect(sub.priceHikeAlert?.previousAmount).toBe(19.99);
      expect(sub.priceHikeAlert?.currentAmount).toBe(22.99);
      expect(sub.priceHikeAlert?.delta).toBe(3);
      expect(sub.priceHikeAlert?.percentageIncrease).toBe(15);
    });

    it('computes free-trial countdown days when trialEndsAt is set', async () => {
      const futureTrialDate = new Date();
      futureTrialDate.setDate(futureTrialDate.getDate() + 5);
      const trialDateStr = futureTrialDate.toISOString().split('T')[0];

      vi.spyOn(SubscriptionRepository, 'findAll').mockResolvedValueOnce([
        {
          id: 2,
          userId: 1,
          name: 'Audible Pro',
          amount: 14.95,
          currency: 'USD',
          billingCycle: 'monthly',
          nextRenewalDate: trialDateStr,
          category: 'Education',
          logoUrl: null,
          isActive: 1,
          trialEndsAt: trialDateStr,
          previousAmount: null,
          accountId: null,
          cancelReminderDays: 3,
          createdAt: '2026-01-01',
        },
      ]);

      vi.spyOn(TransactionRepository, 'findAll').mockResolvedValueOnce([]);

      const subs = await SubscriptionService.getAll(1);
      const sub = subs[0];

      expect(sub.trialCountdownDays).toBe(5);
      expect(sub.daysUntilRenewal).toBe(5);
    });

    it('normalizes weekly and yearly billing cycles into monthly and annual amounts', async () => {
      vi.spyOn(SubscriptionRepository, 'findAll').mockResolvedValueOnce([
        {
          id: 3,
          userId: 1,
          name: 'Annual JetBrains',
          amount: 120,
          currency: 'USD',
          billingCycle: 'yearly',
          nextRenewalDate: '2027-01-15',
          category: 'Software',
          logoUrl: null,
          isActive: 1,
          trialEndsAt: null,
          previousAmount: null,
          accountId: null,
          cancelReminderDays: 3,
          createdAt: '2026-01-01',
        },
      ]);

      vi.spyOn(TransactionRepository, 'findAll').mockResolvedValueOnce([]);

      const subs = await SubscriptionService.getAll(1);
      const sub = subs[0];

      expect(sub.monthlyNormalizedAmount).toBe(10); // 120 / 12
      expect(sub.annualNormalizedAmount).toBe(120);
    });
  });

  describe('Quick Actions', () => {
    it('markRenewed advances the next renewal date and updates previousAmount', async () => {
      const mockSub = {
        id: 10,
        userId: 1,
        name: 'GitHub Copilot',
        amount: 10,
        currency: 'USD',
        billingCycle: 'monthly' as const,
        nextRenewalDate: '2026-10-15',
        category: 'Software',
        logoUrl: null,
        isActive: 1,
        trialEndsAt: null,
        previousAmount: null,
        accountId: null,
        cancelReminderDays: 3,
        createdAt: '2026-01-01',
      };

      vi.spyOn(SubscriptionRepository, 'findById').mockResolvedValueOnce(mockSub);
      vi.spyOn(SubscriptionRepository, 'markRenewed').mockResolvedValueOnce({
        ...mockSub,
        nextRenewalDate: '2026-11-15',
        previousAmount: 10,
      });

      vi.spyOn(SubscriptionRepository, 'findAll').mockResolvedValueOnce([
        {
          ...mockSub,
          nextRenewalDate: '2026-11-15',
          previousAmount: 10,
        },
      ]);

      vi.spyOn(TransactionRepository, 'findAll').mockResolvedValueOnce([]);

      const renewed = await SubscriptionService.markRenewed(1, 10);
      expect(renewed.nextRenewalDate).toBe('2026-11-15');
      expect(renewed.previousAmount).toBe(10);
    });
  });
});
