/**
 * @fileoverview Budget repository — data access layer for spending limits.
 *
 * @module repositories/budget.repository
 */

import { db } from '@/db/client';
import { budgets } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

/**
 * Input data for creating or updating a budget.
 */
export interface CreateBudgetInput {
  userId: number;
  category: string;
  monthlyLimit: number;
  month: number;
  year: number;
  rolloverEnabled?: boolean | number;
  rolloverBalance?: number;
}

/**
 * BudgetRepository — data access for monthly spending limits.
 *
 * @example
 * ```ts
 * const budget = await BudgetRepository.findByCategory(userId, 'Food', 1, 2026);
 * ```
 */
export class BudgetRepository {
  /**
   * Retrieves all budgets for a user in a specific month.
   *
   * @param userId - The user's ID.
   * @param month - Month number (1–12).
   * @param year - Four-digit year.
   * @returns Array of budget records.
   */
  static async findByMonth(
    userId: number,
    month: number,
    year: number
  ): Promise<Array<typeof budgets.$inferSelect>> {
    return db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.month, month),
          eq(budgets.year, year)
        )
      );
  }

  /**
   * Finds a specific budget by category and month.
   *
   * @param userId - The user's ID.
   * @param category - The budget category.
   * @param month - Month number.
   * @param year - Year.
   * @returns The budget record, or undefined.
   */
  static async findByCategory(
    userId: number,
    category: string,
    month: number,
    year: number
  ): Promise<typeof budgets.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.category, category),
          eq(budgets.month, month),
          eq(budgets.year, year)
        )
      )
      .limit(1);

    return results[0];
  }

  /**
   * Finds a budget by its ID, scoped to a user.
   *
   * @param userId - The user's ID.
   * @param id - The budget ID.
   * @returns The budget record, or undefined.
   */
  static async findById(
    userId: number,
    id: number
  ): Promise<typeof budgets.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .limit(1);

    return results[0];
  }

  /**
   * Creates a new budget entry.
   *
   * @param data - Budget creation data.
   * @param txClient - Optional transaction client.
   * @returns The created budget record.
   */
  static async create(
    data: CreateBudgetInput,
    txClient?: any
  ): Promise<typeof budgets.$inferSelect> {
    const client = txClient || db;
    const rolloverEnabled = data.rolloverEnabled ? 1 : 0;
    const result = await client
      .insert(budgets)
      .values({
        userId: data.userId,
        category: data.category,
        monthlyLimit: data.monthlyLimit,
        month: data.month,
        year: data.year,
        rolloverEnabled,
        rolloverBalance: data.rolloverBalance ?? 0,
      })
      .returning();

    return result[0];
  }

  /**
   * Updates a budget's monthly limit, rollover status, or rollover balance.
   *
   * @param userId - The user's ID.
   * @param id - The budget ID.
   * @param data - The fields to update (or number for backwards compatibility).
   * @param txClient - Optional transaction client.
   * @returns The updated budget, or undefined.
   */
  static async update(
    userId: number,
    id: number,
    data: number | { monthlyLimit?: number; rolloverEnabled?: boolean | number; rolloverBalance?: number },
    txClient?: any
  ): Promise<typeof budgets.$inferSelect | undefined> {
    const client = txClient || db;
    const updateData: Record<string, any> = {};

    if (typeof data === 'number') {
      updateData.monthlyLimit = data;
    } else {
      if (data.monthlyLimit !== undefined) updateData.monthlyLimit = data.monthlyLimit;
      if (data.rolloverEnabled !== undefined) {
        updateData.rolloverEnabled = data.rolloverEnabled ? 1 : 0;
      }
      if (data.rolloverBalance !== undefined) updateData.rolloverBalance = data.rolloverBalance;
    }

    const result = await client
      .update(budgets)
      .set(updateData)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Rebalances funds between two budget envelopes atomically.
   */
  static async rebalance(
    userId: number,
    fromId: number,
    toId: number,
    amount: number
  ): Promise<{ from: typeof budgets.$inferSelect; to: typeof budgets.$inferSelect }> {
    return await db.transaction(async (tx) => {
      const fromBudget = await tx
        .select()
        .from(budgets)
        .where(and(eq(budgets.id, fromId), eq(budgets.userId, userId)))
        .limit(1);

      const toBudget = await tx
        .select()
        .from(budgets)
        .where(and(eq(budgets.id, toId), eq(budgets.userId, userId)))
        .limit(1);

      if (!fromBudget[0] || !toBudget[0]) {
        throw new Error('Budget envelope not found');
      }

      if (fromBudget[0].monthlyLimit < amount) {
        throw new Error(`Insufficient budget in ${fromBudget[0].category} to transfer ${amount}`);
      }

      const [updatedFrom] = await tx
        .update(budgets)
        .set({ monthlyLimit: sql`monthly_limit - ${amount}` })
        .where(eq(budgets.id, fromId))
        .returning();

      const [updatedTo] = await tx
        .update(budgets)
        .set({ monthlyLimit: sql`monthly_limit + ${amount}` })
        .where(eq(budgets.id, toId))
        .returning();

      return { from: updatedFrom, to: updatedTo };
    });
  }

  /**
   * Deletes a budget by ID.
   *
   * @param userId - The user's ID.
   * @param id - The budget ID.
   * @returns The deleted budget, or undefined.
   */
  static async delete(
    userId: number,
    id: number
  ): Promise<typeof budgets.$inferSelect | undefined> {
    const result = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();

    return result[0];
  }
}
