/**
 * @fileoverview Subscription repository — data access for recurring subscriptions and intelligence.
 *
 * @module repositories/subscription.repository
 */

import { db } from '@/db/client';
import { subscriptions } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';

export interface CreateSubscriptionInput {
  userId: number;
  name: string;
  amount: number;
  currency?: string;
  billingCycle: 'weekly' | 'monthly' | 'yearly';
  nextRenewalDate: string;
  category?: string;
  logoUrl?: string | null;
  isActive?: number | boolean;
  trialEndsAt?: string | null;
  previousAmount?: number | null;
  accountId?: number | null;
  cancelReminderDays?: number;
}

export class SubscriptionRepository {
  /**
   * Retrieves all subscriptions for a user ordered by upcoming renewal date.
   */
  static async findAll(userId: number): Promise<Array<typeof subscriptions.$inferSelect>> {
    return db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(asc(subscriptions.nextRenewalDate));
  }

  /**
   * Finds a subscription by ID for a user.
   */
  static async findById(
    userId: number,
    id: number
  ): Promise<typeof subscriptions.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .limit(1);

    return results[0];
  }

  /**
   * Creates a new subscription.
   */
  static async create(
    data: CreateSubscriptionInput
  ): Promise<typeof subscriptions.$inferSelect> {
    const result = await db
      .insert(subscriptions)
      .values({
        userId: data.userId,
        name: data.name,
        amount: data.amount,
        currency: data.currency || 'BDT',
        billingCycle: data.billingCycle,
        nextRenewalDate: data.nextRenewalDate,
        category: data.category || 'Other',
        logoUrl: data.logoUrl || null,
        isActive: data.isActive === undefined ? 1 : data.isActive ? 1 : 0,
        trialEndsAt: data.trialEndsAt || null,
        previousAmount: data.previousAmount || null,
        accountId: data.accountId || null,
        cancelReminderDays: data.cancelReminderDays ?? 3,
      })
      .returning();

    return result[0];
  }

  /**
   * Updates an existing subscription.
   */
  static async update(
    userId: number,
    id: number,
    data: Partial<CreateSubscriptionInput>
  ): Promise<typeof subscriptions.$inferSelect | undefined> {
    const updateData: Record<string, any> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.billingCycle !== undefined) updateData.billingCycle = data.billingCycle;
    if (data.nextRenewalDate !== undefined) updateData.nextRenewalDate = data.nextRenewalDate;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.isActive !== undefined) {
      updateData.isActive = typeof data.isActive === 'boolean' ? (data.isActive ? 1 : 0) : data.isActive;
    }
    if (data.trialEndsAt !== undefined) updateData.trialEndsAt = data.trialEndsAt;
    if (data.previousAmount !== undefined) updateData.previousAmount = data.previousAmount;
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.cancelReminderDays !== undefined) updateData.cancelReminderDays = data.cancelReminderDays;

    const result = await db
      .update(subscriptions)
      .set(updateData)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Advances renewal date and marks subscription renewed.
   */
  static async markRenewed(
    userId: number,
    id: number,
    nextRenewalDate: string,
    currentAmount: number
  ): Promise<typeof subscriptions.$inferSelect | undefined> {
    const result = await db
      .update(subscriptions)
      .set({
        nextRenewalDate,
        previousAmount: currentAmount,
      })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Deletes a subscription.
   */
  static async delete(
    userId: number,
    id: number
  ): Promise<typeof subscriptions.$inferSelect | undefined> {
    const result = await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();

    return result[0];
  }
}
