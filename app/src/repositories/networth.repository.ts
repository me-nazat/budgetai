/**
 * @fileoverview Net worth repository — data access for net worth snapshots.
 *
 * @security
 * - Amount values have encrypted counterparts stored alongside for data-at-rest compliance.
 *
 * @module repositories/networth.repository
 */

import { db } from '@/db/client';
import { netWorth } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { encryptNumber } from '@/lib/crypto/encryption';

/**
 * Input data for creating a net worth entry.
 */
export interface CreateNetWorthInput {
  userId: number;
  amount: number;
  note?: string;
}

/**
 * NetWorthRepository — data access for net worth historical snapshots.
 */
export class NetWorthRepository {
  /**
   * Retrieves all net worth entries for a user, newest first.
   *
   * @param userId - The user's ID.
   * @returns Array of net worth records.
   */
  static async findAll(
    userId: number
  ): Promise<Array<typeof netWorth.$inferSelect>> {
    return db
      .select()
      .from(netWorth)
      .where(eq(netWorth.userId, userId))
      .orderBy(desc(netWorth.createdAt));
  }

  /**
   * Gets the latest net worth entry for a user.
   *
   * @param userId - The user's ID.
   * @returns The most recent net worth record, or undefined.
   */
  static async findLatest(
    userId: number
  ): Promise<typeof netWorth.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(netWorth)
      .where(eq(netWorth.userId, userId))
      .orderBy(desc(netWorth.createdAt))
      .limit(1);

    return results[0];
  }

  /**
   * Finds a net worth entry by ID, scoped to a user.
   *
   * @param userId - The user's ID.
   * @param id - The entry ID.
   * @returns The net worth record, or undefined.
   */
  static async findById(
    userId: number,
    id: number
  ): Promise<typeof netWorth.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(netWorth)
      .where(and(eq(netWorth.id, id), eq(netWorth.userId, userId)))
      .limit(1);

    return results[0];
  }

  /**
   * Creates a new net worth snapshot with encrypted amount.
   *
   * @param data - The net worth data.
   * @returns The created record.
   */
  static async create(
    data: CreateNetWorthInput
  ): Promise<typeof netWorth.$inferSelect> {
    const result = await db
      .insert(netWorth)
      .values({
        userId: data.userId,
        amount: data.amount,
        encryptedAmount: encryptNumber(data.amount, 'networth-amount'),
        note: data.note || '',
      })
      .returning();

    return result[0];
  }

  /**
   * Deletes a net worth entry.
   *
   * @param userId - The user's ID.
   * @param id - The entry ID.
   * @returns The deleted record, or undefined.
   */
  static async delete(
    userId: number,
    id: number
  ): Promise<typeof netWorth.$inferSelect | undefined> {
    const result = await db
      .delete(netWorth)
      .where(and(eq(netWorth.id, id), eq(netWorth.userId, userId)))
      .returning();

    return result[0];
  }
}
