/**
 * @fileoverview Goal repository — data access for savings goals.
 *
 * @security Encrypted amount fields for data-at-rest compliance.
 * @module repositories/goal.repository
 */

import { db } from '@/db/client';
import { savingsGoals } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { encryptNumber } from '@/lib/crypto/encryption';

/**
 * Input data for creating a savings goal.
 */
export interface CreateGoalInput {
  userId: number;
  name: string;
  targetAmount: number;
  savedAmount?: number;
  deadline?: string;
}

/**
 * Input data for updating a savings goal.
 */
export interface UpdateGoalInput {
  name?: string;
  targetAmount?: number;
  savedAmount?: number;
  deadline?: string | null;
}

/**
 * GoalRepository — data access for savings goals.
 */
export class GoalRepository {
  /**
   * Retrieves all savings goals for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of savings goal records.
   */
  static async findAll(
    userId: number
  ): Promise<Array<typeof savingsGoals.$inferSelect>> {
    return db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId))
      .orderBy(desc(savingsGoals.createdAt));
  }

  /**
   * Finds a savings goal by ID, scoped to a user.
   *
   * @param userId - The user's ID.
   * @param id - The goal ID.
   * @returns The goal record, or undefined.
   */
  static async findById(
    userId: number,
    id: number
  ): Promise<typeof savingsGoals.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .limit(1);

    return results[0];
  }

  /**
   * Creates a new savings goal with encrypted amount fields.
   *
   * @param data - Goal creation data.
   * @returns The created goal record.
   */
  static async create(
    data: CreateGoalInput
  ): Promise<typeof savingsGoals.$inferSelect> {
    const savedAmount = data.savedAmount ?? 0;

    const result = await db
      .insert(savingsGoals)
      .values({
        userId: data.userId,
        name: data.name,
        targetAmount: data.targetAmount,
        savedAmount,
        encryptedTargetAmount: encryptNumber(data.targetAmount, 'goal-target'),
        encryptedSavedAmount: encryptNumber(savedAmount, 'goal-saved'),
        deadline: data.deadline,
      })
      .returning();

    return result[0];
  }

  /**
   * Updates a savings goal.
   *
   * @param userId - The user's ID.
   * @param id - The goal ID.
   * @param data - Fields to update.
   * @returns The updated goal, or undefined.
   */
  static async update(
    userId: number,
    id: number,
    data: UpdateGoalInput
  ): Promise<typeof savingsGoals.$inferSelect | undefined> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.deadline !== undefined) updateData.deadline = data.deadline;

    if (data.targetAmount !== undefined) {
      updateData.targetAmount = data.targetAmount;
      updateData.encryptedTargetAmount = encryptNumber(data.targetAmount, 'goal-target');
    }

    if (data.savedAmount !== undefined) {
      updateData.savedAmount = data.savedAmount;
      updateData.encryptedSavedAmount = encryptNumber(data.savedAmount, 'goal-saved');
    }

    if (Object.keys(updateData).length === 0) return undefined;

    const result = await db
      .update(savingsGoals)
      .set(updateData)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Deletes a savings goal.
   *
   * @param userId - The user's ID.
   * @param id - The goal ID.
   * @returns The deleted goal, or undefined.
   */
  static async delete(
    userId: number,
    id: number
  ): Promise<typeof savingsGoals.$inferSelect | undefined> {
    const result = await db
      .delete(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.userId, userId)))
      .returning();

    return result[0];
  }
}
