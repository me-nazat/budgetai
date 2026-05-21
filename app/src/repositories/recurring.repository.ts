/**
 * @fileoverview Recurring transaction repository — data access for scheduled entries.
 *
 * @module repositories/recurring.repository
 */

import { db } from '@/db/client';
import { recurringTransactions } from '@/db/schema';
import { eq, and, lte, desc } from 'drizzle-orm';

/**
 * Input data for creating a recurring transaction.
 */
export interface CreateRecurringInput {
  userId: number;
  name: string;
  type: 'expense' | 'earning';
  amount: number;
  category: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  nextDate: string;
}

/**
 * RecurringRepository — data access for scheduled recurring transactions.
 */
export class RecurringRepository {
  /**
   * Retrieves all recurring transactions for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of recurring transaction records.
   */
  static async findAll(
    userId: number
  ): Promise<Array<typeof recurringTransactions.$inferSelect>> {
    return db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.userId, userId))
      .orderBy(desc(recurringTransactions.createdAt));
  }

  /**
   * Finds a recurring transaction by ID, scoped to a user.
   *
   * @param userId - The user's ID.
   * @param id - The recurring transaction ID.
   * @returns The record, or undefined.
   */
  static async findById(
    userId: number,
    id: number
  ): Promise<typeof recurringTransactions.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId)
        )
      )
      .limit(1);

    return results[0];
  }

  /**
   * Finds all recurring transactions that are due (nextDate <= today).
   *
   * Used by the scheduler to process pending entries.
   *
   * @param today - Today's date in YYYY-MM-DD format.
   * @returns Array of due recurring transactions across all users.
   */
  static async findDue(
    today: string
  ): Promise<Array<typeof recurringTransactions.$inferSelect>> {
    return db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.active, 1),
          lte(recurringTransactions.nextDate, today)
        )
      );
  }

  /**
   * Creates a new recurring transaction.
   *
   * @param data - Creation data.
   * @returns The created record.
   */
  static async create(
    data: CreateRecurringInput
  ): Promise<typeof recurringTransactions.$inferSelect> {
    const result = await db
      .insert(recurringTransactions)
      .values(data)
      .returning();

    return result[0];
  }

  /**
   * Updates a recurring transaction.
   *
   * @param userId - The user's ID.
   * @param id - The recurring transaction ID.
   * @param data - Fields to update.
   * @returns The updated record, or undefined.
   */
  static async update(
    userId: number,
    id: number,
    data: Partial<CreateRecurringInput>
  ): Promise<typeof recurringTransactions.$inferSelect | undefined> {
    const result = await db
      .update(recurringTransactions)
      .set(data)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId)
        )
      )
      .returning();

    return result[0];
  }

  /**
   * Updates the next execution date for a recurring transaction.
   *
   * @param id - The recurring transaction ID.
   * @param nextDate - The new next execution date.
   */
  static async updateNextDate(
    id: number,
    nextDate: string
  ): Promise<void> {
    await db
      .update(recurringTransactions)
      .set({ nextDate })
      .where(eq(recurringTransactions.id, id));
  }

  /**
   * Toggles the active status of a recurring transaction.
   *
   * @param userId - The user's ID.
   * @param id - The recurring transaction ID.
   * @param active - New active status (1 = active, 0 = paused).
   * @returns The updated record, or undefined.
   */
  static async toggleActive(
    userId: number,
    id: number,
    active: number
  ): Promise<typeof recurringTransactions.$inferSelect | undefined> {
    const result = await db
      .update(recurringTransactions)
      .set({ active })
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId)
        )
      )
      .returning();

    return result[0];
  }

  /**
   * Deletes a recurring transaction.
   *
   * @param userId - The user's ID.
   * @param id - The recurring transaction ID.
   * @returns The deleted record, or undefined.
   */
  static async delete(
    userId: number,
    id: number
  ): Promise<typeof recurringTransactions.$inferSelect | undefined> {
    const result = await db
      .delete(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.userId, userId)
        )
      )
      .returning();

    return result[0];
  }
}
