/**
 * @fileoverview Account repository — pure data access layer.
 *
 * Handles database operations for the `accounts` table.
 *
 * @module repositories/account.repository
 */

import { db } from '@/db/client';
import { accounts, type Account, type NewAccount } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class AccountRepository {
  /**
   * Retrieves all active accounts for a user.
   */
  static async findAllByUserId(userId: number, includeArchived = false): Promise<Account[]> {
    const query = db
      .select()
      .from(accounts)
      .where(
        includeArchived
          ? eq(accounts.userId, userId)
          : and(eq(accounts.userId, userId), eq(accounts.isArchived, 0))
      )
      .orderBy(accounts.name);
    return query;
  }

  /**
   * Finds a single account by ID.
   */
  static async findById(id: number, userId: number): Promise<Account | null> {
    const [account] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .limit(1);
    return account || null;
  }

  /**
   * Creates a new account.
   */
  static async create(data: Omit<NewAccount, 'id' | 'createdAt'>): Promise<Account> {
    const [inserted] = await db
      .insert(accounts)
      .values({
        ...data,
        currentBalance: data.openingBalance ?? 0,
      })
      .returning();
    return inserted;
  }

  /**
   * Updates an existing account.
   */
  static async update(
    id: number,
    userId: number,
    data: Partial<NewAccount>
  ): Promise<Account | null> {
    const [updated] = await db
      .update(accounts)
      .set(data)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    return updated || null;
  }

  /**
   * Safely increments or decrements an account balance transactionally.
   */
  static async updateBalance(id: number, amountDiff: number): Promise<void> {
    await db
      .update(accounts)
      .set({
        currentBalance: sql`current_balance + ${amountDiff}`,
      })
      .where(eq(accounts.id, id));
  }
}
