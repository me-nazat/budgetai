/**
 * @fileoverview Budget repository — data access layer for spending limits.
 *
 * @module repositories/budget.repository
 */

import { db } from '@/db/client';
import { budgets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Input data for creating or updating a budget.
 */
export interface CreateBudgetInput {
  userId: number;
  category: string;
  monthlyLimit: number;
  month: number;
  year: number;
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
   * @returns The created budget record.
   */
  static async create(
    data: CreateBudgetInput
  ): Promise<typeof budgets.$inferSelect> {
    const result = await db
      .insert(budgets)
      .values(data)
      .returning();

    return result[0];
  }

  /**
   * Updates a budget's monthly limit.
   *
   * @param userId - The user's ID.
   * @param id - The budget ID.
   * @param monthlyLimit - The new spending limit.
   * @returns The updated budget, or undefined.
   */
  static async update(
    userId: number,
    id: number,
    monthlyLimit: number
  ): Promise<typeof budgets.$inferSelect | undefined> {
    const result = await db
      .update(budgets)
      .set({ monthlyLimit })
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();

    return result[0];
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
