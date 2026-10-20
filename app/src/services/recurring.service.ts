/**
 * @fileoverview Recurring transaction service — business logic for scheduled entries.
 *
 * @module services/recurring.service
 */

import { RecurringRepository, type CreateRecurringInput } from '@/repositories/recurring.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AuditService } from '@/services/audit.service';
import { TransactionService } from '@/services/transaction.service';
import { AccountService } from '@/services/account.service';
import { validateInput } from '@/lib/types/api';
import { CreateRecurringDTO, type RecurringResponseDTO } from '@/lib/types/dto';
import { NotFoundError, ErrorCode } from '@/lib/types/errors';

/**
 * RecurringService — business logic for scheduled recurring transactions.
 */
export class RecurringService {
  /**
   * Retrieves all recurring transactions for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of recurring transaction DTOs.
   */
  static async getAll(userId: number): Promise<RecurringResponseDTO[]> {
    const records = await RecurringRepository.findAll(userId);

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      amount: r.amount,
      category: r.category,
      frequency: r.frequency,
      nextDate: r.nextDate,
      active: r.active ?? 1,
      createdAt: r.createdAt ?? undefined,
    }));
  }

  /**
   * Creates a new recurring transaction.
   *
   * @param userId - The user's ID.
   * @param data - Raw input data.
   * @param ctx - Request context.
   * @returns The created recurring transaction.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<RecurringResponseDTO> {
    const validated = validateInput(CreateRecurringDTO, data);

    const record = await RecurringRepository.create({
      userId,
      name: validated.name,
      type: validated.type,
      amount: validated.amount,
      category: validated.category,
      frequency: validated.frequency,
      nextDate: validated.nextDate,
    });

    AuditService.logCreate(
      userId,
      'recurring',
      record.id,
      { name: validated.name, amount: validated.amount, frequency: validated.frequency },
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: record.id,
      name: record.name,
      type: record.type,
      amount: record.amount,
      category: record.category,
      frequency: record.frequency,
      nextDate: record.nextDate,
      active: record.active ?? 1,
      createdAt: record.createdAt ?? undefined,
    };
  }

  /**
   * Deletes a recurring transaction.
   *
   * @param userId - The user's ID.
   * @param id - The record ID.
   * @param ctx - Request context.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const deleted = await RecurringRepository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError('Recurring transaction not found');
    }

    AuditService.logDelete(
      userId,
      'recurring',
      id,
      { name: deleted.name, amount: deleted.amount },
      ctx.ip,
      ctx.userAgent
    );
  }

  /**
   * Toggles the active/paused state of a recurring transaction.
   *
   * @param userId - The user's ID.
   * @param id - The record ID.
   * @param active - New active state.
   * @returns The updated record.
   */
  static async toggleActive(
    userId: number,
    id: number,
    active: boolean
  ): Promise<RecurringResponseDTO | undefined> {
    const result = await RecurringRepository.toggleActive(userId, id, active ? 1 : 0);
    if (!result) {
      throw new NotFoundError('Recurring transaction not found');
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type,
      amount: result.amount,
      category: result.category,
      frequency: result.frequency,
      nextDate: result.nextDate,
      active: result.active ?? 1,
      createdAt: result.createdAt ?? undefined,
    };
  }

  /**
   * Processes all due recurring transactions.
   *
   * Called by a cron job or scheduled function. Creates actual
   * transactions for each due recurring entry and advances
   * the next execution date.
   *
   * @returns Number of transactions processed.
   */
  static async processDue(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const dueRecords = await RecurringRepository.findDue(today);
    let processed = 0;

    for (const record of dueRecords) {
      try {
        // Resolve primary account if available
        const userAccounts = await AccountService.list(record.userId);
        const accountId = userAccounts.length > 0 ? userAccounts[0].id : undefined;

        // Create the actual transaction through the service layer
        await TransactionService.create(record.userId, {
          type: record.type as 'expense' | 'earning',
          amount: record.amount,
          category: record.category,
          description: `[Auto] ${record.name}`,
          date: today,
          accountId,
        });

        // Auto-split household recurring bills if householdId is assigned
        if (record.householdId && record.type === 'expense') {
          try {
            const { db } = await import('@/db/client');
            const { householdExpenses, householdSettlements, householdMembers } = await import('@/db/schema');
            const { eq } = await import('drizzle-orm');
            const { encryptNumber } = await import('@/lib/crypto/encryption');
            const { broadcastHouseholdUpdate } = await import('@/lib/household-sync');

            const hhId = record.householdId;
            const [insertedExp] = await db
              .insert(householdExpenses)
              .values({
                householdId: hhId,
                userId: record.userId,
                description: `[Auto Recurring] ${record.name}`,
                amount: record.amount,
                category: record.category,
                splitBetween: 'all',
              })
              .returning({ id: householdExpenses.id });

            const members = await db
              .select({ userId: householdMembers.userId })
              .from(householdMembers)
              .where(eq(householdMembers.householdId, hhId));

            const memberIds = members.map((m) => m.userId);
            if (memberIds.length > 1) {
              const splitAmount = Math.round((record.amount / memberIds.length) * 100) / 100;
              const settlementRows = memberIds
                .filter((mId) => mId !== record.userId)
                .map((mId) => ({
                  householdId: hhId,
                  payerId: mId,
                  payeeId: record.userId,
                  amount: splitAmount,
                  encryptedAmount: encryptNumber(splitAmount, 'household-settlement'),
                  status: 'pending' as const,
                }));

              if (settlementRows.length > 0) {
                await db.insert(householdSettlements).values(settlementRows);
              }

              broadcastHouseholdUpdate(hhId, {
                type: 'EXPENSE_ADDED',
                data: {
                  expenseId: insertedExp?.id,
                  amount: record.amount,
                  payerId: record.userId,
                  description: `[Auto Recurring] ${record.name}`,
                },
              });
            }
          } catch (hhError) {
            console.error(`[recurring] Failed to auto-split household bill for ID ${record.id}:`, hhError);
          }
        }

        // Calculate next execution date
        const nextDate = RecurringService.calculateNextDate(
          record.nextDate,
          record.frequency as 'weekly' | 'monthly' | 'yearly'
        );

        await RecurringRepository.updateNextDate(record.id, nextDate);
        processed++;
      } catch (error) {
        console.error(`[recurring] Failed to process ID ${record.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Calculates the next execution date based on frequency.
   *
   * @param currentDate - Current execution date (YYYY-MM-DD).
   * @param frequency - Recurrence frequency.
   * @returns Next execution date in YYYY-MM-DD format.
   *
   * @internal
   */
  public static calculateNextDate(
    currentDate: string,
    frequency: 'weekly' | 'monthly' | 'yearly'
  ): string {
    const d = new Date(currentDate + 'T00:00:00Z');

    switch (frequency) {
      case 'weekly':
        d.setUTCDate(d.getUTCDate() + 7);
        break;
      case 'monthly':
        d.setUTCMonth(d.getUTCMonth() + 1);
        break;
      case 'yearly':
        d.setUTCFullYear(d.getUTCFullYear() + 1);
        break;
    }

    return d.toISOString().split('T')[0];
  }
}

import { SubscriptionRepository } from '@/repositories/subscription.repository';
import { CreateSubscriptionDTO, UpdateSubscriptionDTO, type SubscriptionResponseDTO } from '@/lib/types/dto';

/**
 * SubscriptionService — subscription intelligence suite with price-hike detection,
 * free-trial expiration counters, and renewal calendar calculations.
 */
export class SubscriptionService {
  /**
   * Retrieves all active and past subscriptions enriched with price-hike alerts,
   * trial expiration countdowns, and renewal metrics.
   *
   * @param userId - The user's ID.
   * @returns Array of enriched subscription DTOs.
   */
  static async getAll(userId: number): Promise<SubscriptionResponseDTO[]> {
    const records = await SubscriptionRepository.findAll(userId);

    // Retrieve historical expense transactions to detect anomalous price hikes
    const pastTransactions = await TransactionRepository.findAll(userId, {
      type: 'expense',
      limit: 250,
    }).catch(() => []);

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    return records.map((sub) => {
      const subNameLower = sub.name.toLowerCase().trim();

      // Find matching transactions for this subscription merchant
      const matchingTxs = pastTransactions
        .filter((tx) => {
          const descLower = (tx.description || '').toLowerCase();
          return descLower.includes(subNameLower) || subNameLower.includes(descLower);
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let priceHikeAlert: SubscriptionResponseDTO['priceHikeAlert'] | undefined = undefined;

      // 1. Check transaction historical price divergence
      if (matchingTxs.length >= 2) {
        const latestCharge = matchingTxs[0].amount;
        const previousCharge = matchingTxs[1].amount;
        if (latestCharge > previousCharge) {
          const delta = Math.round((latestCharge - previousCharge) * 100) / 100;
          const percentageIncrease = Math.round((delta / previousCharge) * 100);
          priceHikeAlert = {
            detected: true,
            previousAmount: previousCharge,
            currentAmount: latestCharge,
            delta,
            percentageIncrease,
            lastChargedDate: matchingTxs[0].date,
          };
        }
      }

      // 2. Check previousAmount recorded on the subscription record itself
      if (!priceHikeAlert && sub.previousAmount && sub.amount > sub.previousAmount) {
        const delta = Math.round((sub.amount - sub.previousAmount) * 100) / 100;
        const percentageIncrease = Math.round((delta / sub.previousAmount) * 100);
        priceHikeAlert = {
          detected: true,
          previousAmount: sub.previousAmount,
          currentAmount: sub.amount,
          delta,
          percentageIncrease,
          lastChargedDate: matchingTxs[0]?.date,
        };
      }

      // Compute days until renewal
      let daysUntilRenewal = 0;
      if (sub.nextRenewalDate) {
        const renewalDate = new Date(sub.nextRenewalDate + 'T00:00:00Z');
        daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Compute free-trial countdown
      let trialCountdownDays: number | null = null;
      if (sub.trialEndsAt) {
        const trialDate = new Date(sub.trialEndsAt + 'T00:00:00Z');
        trialCountdownDays = Math.ceil((trialDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Monthly and annual normalized costs
      let monthlyNormalizedAmount = sub.amount;
      if (sub.billingCycle === 'weekly') {
        monthlyNormalizedAmount = Math.round(sub.amount * 4.33 * 100) / 100;
      } else if (sub.billingCycle === 'yearly') {
        monthlyNormalizedAmount = Math.round((sub.amount / 12) * 100) / 100;
      }
      const annualNormalizedAmount = Math.round(monthlyNormalizedAmount * 12 * 100) / 100;

      return {
        id: sub.id,
        name: sub.name,
        amount: sub.amount,
        currency: sub.currency || 'BDT',
        billingCycle: sub.billingCycle as 'weekly' | 'monthly' | 'yearly',
        nextRenewalDate: sub.nextRenewalDate,
        category: sub.category,
        logoUrl: sub.logoUrl ?? undefined,
        isActive: sub.isActive ?? 1,
        trialEndsAt: sub.trialEndsAt ?? undefined,
        previousAmount: sub.previousAmount ?? undefined,
        accountId: sub.accountId ?? undefined,
        cancelReminderDays: sub.cancelReminderDays ?? 3,
        createdAt: sub.createdAt ?? undefined,
        priceHikeAlert,
        daysUntilRenewal,
        trialCountdownDays,
        monthlyNormalizedAmount,
        annualNormalizedAmount,
      };
    });
  }

  /**
   * Scans historical transactions and flags anomalous price increases for recurring merchants.
   */
  static async detectPriceHikes(userId: number) {
    const subscriptionsList = await this.getAll(userId);
    return subscriptionsList
      .filter((s) => s.priceHikeAlert?.detected)
      .map((s) => ({
        subscriptionId: s.id,
        name: s.name,
        ...s.priceHikeAlert!,
      }));
  }

  /**
   * Creates a new subscription.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<SubscriptionResponseDTO> {
    const validated = validateInput(CreateSubscriptionDTO, data);

    const record = await SubscriptionRepository.create({
      userId,
      name: validated.name,
      amount: validated.amount,
      currency: validated.currency,
      billingCycle: validated.billingCycle,
      nextRenewalDate: validated.nextRenewalDate,
      category: validated.category,
      logoUrl: validated.logoUrl,
      isActive: validated.isActive ? 1 : 0,
      trialEndsAt: validated.trialEndsAt,
      previousAmount: validated.previousAmount,
      accountId: validated.accountId,
      cancelReminderDays: validated.cancelReminderDays,
    });

    AuditService.logCreate(
      userId,
      'recurring',
      record.id,
      { name: validated.name, amount: validated.amount, billingCycle: validated.billingCycle },
      ctx.ip,
      ctx.userAgent
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const renewalDate = new Date(record.nextRenewalDate + 'T00:00:00Z');
    const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let monthlyNormalizedAmount = record.amount;
    if (record.billingCycle === 'weekly') monthlyNormalizedAmount = Math.round(record.amount * 4.33 * 100) / 100;
    else if (record.billingCycle === 'yearly') monthlyNormalizedAmount = Math.round((record.amount / 12) * 100) / 100;

    return {
      id: record.id,
      name: record.name,
      amount: record.amount,
      currency: record.currency || 'BDT',
      billingCycle: record.billingCycle as 'weekly' | 'monthly' | 'yearly',
      nextRenewalDate: record.nextRenewalDate,
      category: record.category,
      logoUrl: record.logoUrl ?? undefined,
      isActive: record.isActive ?? 1,
      trialEndsAt: record.trialEndsAt ?? undefined,
      previousAmount: record.previousAmount ?? undefined,
      accountId: record.accountId ?? undefined,
      cancelReminderDays: record.cancelReminderDays ?? 3,
      createdAt: record.createdAt ?? undefined,
      daysUntilRenewal,
      monthlyNormalizedAmount,
      annualNormalizedAmount: Math.round(monthlyNormalizedAmount * 12 * 100) / 100,
    };
  }

  /**
   * Updates an existing subscription.
   */
  static async update(
    userId: number,
    id: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<SubscriptionResponseDTO> {
    const validated = validateInput(UpdateSubscriptionDTO, data);

    const existing = await SubscriptionRepository.findById(userId, id);
    if (!existing) {
      throw new NotFoundError('Subscription not found');
    }

    const updated = await SubscriptionRepository.update(userId, id, {
      ...validated,
      isActive: validated.isActive !== undefined ? (validated.isActive ? 1 : 0) : undefined,
    });

    AuditService.logUpdate(
      userId,
      'recurring',
      id,
      { amount: existing.amount, nextRenewalDate: existing.nextRenewalDate },
      { amount: updated?.amount, nextRenewalDate: updated?.nextRenewalDate },
      ctx.ip,
      ctx.userAgent
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const renewalDate = new Date(updated!.nextRenewalDate + 'T00:00:00Z');
    const daysUntilRenewal = Math.ceil((renewalDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let monthlyNormalizedAmount = updated!.amount;
    if (updated!.billingCycle === 'weekly') monthlyNormalizedAmount = Math.round(updated!.amount * 4.33 * 100) / 100;
    else if (updated!.billingCycle === 'yearly') monthlyNormalizedAmount = Math.round((updated!.amount / 12) * 100) / 100;

    return {
      id: updated!.id,
      name: updated!.name,
      amount: updated!.amount,
      currency: updated!.currency || 'BDT',
      billingCycle: updated!.billingCycle as 'weekly' | 'monthly' | 'yearly',
      nextRenewalDate: updated!.nextRenewalDate,
      category: updated!.category,
      logoUrl: updated!.logoUrl ?? undefined,
      isActive: updated!.isActive ?? 1,
      trialEndsAt: updated!.trialEndsAt ?? undefined,
      previousAmount: updated!.previousAmount ?? undefined,
      accountId: updated!.accountId ?? undefined,
      cancelReminderDays: updated!.cancelReminderDays ?? 3,
      createdAt: updated!.createdAt ?? undefined,
      daysUntilRenewal,
      monthlyNormalizedAmount,
      annualNormalizedAmount: Math.round(monthlyNormalizedAmount * 12 * 100) / 100,
    };
  }

  /**
   * Quick Action: Advances the renewal date by 1 billing cycle and updates previousAmount.
   */
  static async markRenewed(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<SubscriptionResponseDTO> {
    const existing = await SubscriptionRepository.findById(userId, id);
    if (!existing) {
      throw new NotFoundError('Subscription not found');
    }

    const nextDate = RecurringService.calculateNextDate(
      existing.nextRenewalDate,
      existing.billingCycle as 'weekly' | 'monthly' | 'yearly'
    );

    const updated = await SubscriptionRepository.markRenewed(userId, id, nextDate, existing.amount);

    AuditService.logUpdate(
      userId,
      'recurring',
      id,
      { action: 'mark_renewed', previousDate: existing.nextRenewalDate },
      { nextRenewalDate: nextDate },
      ctx.ip,
      ctx.userAgent
    );

    return (await this.getAll(userId)).find((s) => s.id === id)!;
  }

  /**
   * Quick Action: Updates the cancel reminder days.
   */
  static async updateCancelReminder(
    userId: number,
    id: number,
    days: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<SubscriptionResponseDTO> {
    const existing = await SubscriptionRepository.findById(userId, id);
    if (!existing) {
      throw new NotFoundError('Subscription not found');
    }

    await SubscriptionRepository.update(userId, id, { cancelReminderDays: days });

    AuditService.logUpdate(
      userId,
      'recurring',
      id,
      { cancelReminderDays: existing.cancelReminderDays },
      { cancelReminderDays: days },
      ctx.ip,
      ctx.userAgent
    );

    return (await this.getAll(userId)).find((s) => s.id === id)!;
  }

  /**
   * Quick Action: Updates the linked payment account.
   */
  static async updateBillingAccount(
    userId: number,
    id: number,
    accountId: number | null,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<SubscriptionResponseDTO> {
    const existing = await SubscriptionRepository.findById(userId, id);
    if (!existing) {
      throw new NotFoundError('Subscription not found');
    }

    await SubscriptionRepository.update(userId, id, { accountId });

    AuditService.logUpdate(
      userId,
      'recurring',
      id,
      { accountId: existing.accountId },
      { accountId },
      ctx.ip,
      ctx.userAgent
    );

    return (await this.getAll(userId)).find((s) => s.id === id)!;
  }

  /**
   * Deletes a subscription.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const deleted = await SubscriptionRepository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError('Subscription not found');
    }

    AuditService.logDelete(
      userId,
      'recurring',
      id,
      { name: deleted.name, amount: deleted.amount },
      ctx.ip,
      ctx.userAgent
    );
  }
}

