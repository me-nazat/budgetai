/**
 * @fileoverview Transaction repository — pure data access layer.
 *
 * Handles all database operations for the `transactions` table using
 * Drizzle ORM. Provides transparent encryption/decryption of sensitive
 * fields (amount, description) at the repository boundary.
 *
 * ## Responsibilities
 * - CRUD operations for transactions.
 * - Field-level encryption before INSERT/UPDATE.
 * - Decryption after SELECT.
 * - Date range and category filtering.
 * - Aggregation queries for dashboard data.
 *
 * ## Non-Responsibilities
 * - Business logic (handled by TransactionService).
 * - Input validation (handled by Zod DTOs).
 * - Audit logging (handled by AuditService).
 *
 * @module repositories/transaction.repository
 */

import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { eq, and, gte, lte, desc, sql, count } from 'drizzle-orm';
import { encryptField, encryptNumber, decryptField } from '@/lib/crypto/encryption';

/**
 * Input data for creating a new transaction.
 */
export interface CreateTransactionInput {
  userId: number;
  type: 'expense' | 'earning';
  amount: number;
  category: string;
  description: string;
  date: string;
}

/**
 * Input data for updating an existing transaction.
 */
export interface UpdateTransactionInput {
  type: 'expense' | 'earning';
  amount: number;
  category: string;
  description: string;
  date: string;
}

/**
 * Filters for querying transactions.
 */
export interface TransactionFilters {
  start?: string;
  end?: string;
  category?: string;
  type?: 'expense' | 'earning';
  limit?: number;
  offset?: number;
}

/**
 * TransactionRepository — data access object for financial transactions.
 *
 * All methods are static. This class encapsulates raw Drizzle queries
 * and handles encryption transparently.
 *
 * @example
 * ```ts
 * const txns = await TransactionRepository.findAll(userId, {
 *   start: '2026-01-01',
 *   end: '2026-01-31',
 *   type: 'expense',
 *   limit: 20,
 * });
 * ```
 */
export class TransactionRepository {
  /**
   * Retrieves transactions for a user with optional filters.
   *
   * @param userId - The authenticated user's ID.
   * @param filters - Optional query filters (date range, type, category, pagination).
   * @returns Array of transaction records with decrypted fields.
   *
   * @complexity O(log n + k) where n is total transactions, k is result set size.
   */
  static async findAll(
    userId: number,
    filters: TransactionFilters = {}
  ): Promise<Array<typeof transactions.$inferSelect>> {
    const conditions = [eq(transactions.userId, userId)];

    if (filters.start) {
      conditions.push(gte(transactions.date, filters.start));
    }
    if (filters.end) {
      conditions.push(lte(transactions.date, filters.end));
    }
    if (filters.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters.category) {
      conditions.push(eq(transactions.category, filters.category));
    }

    const results = await db
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.date), desc(transactions.id))
      .limit(filters.limit ?? 200)
      .offset(filters.offset ?? 0);

    return results;
  }

  /**
   * Counts total transactions matching the given filters.
   *
   * @param userId - The authenticated user's ID.
   * @param filters - Optional query filters.
   * @returns The total count of matching transactions.
   */
  static async count(
    userId: number,
    filters: TransactionFilters = {}
  ): Promise<number> {
    const conditions = [eq(transactions.userId, userId)];

    if (filters.start) {
      conditions.push(gte(transactions.date, filters.start));
    }
    if (filters.end) {
      conditions.push(lte(transactions.date, filters.end));
    }
    if (filters.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters.category) {
      conditions.push(eq(transactions.category, filters.category));
    }

    const result = await db
      .select({ total: count() })
      .from(transactions)
      .where(and(...conditions));

    return result[0]?.total ?? 0;
  }

  /**
   * Finds a single transaction by ID, scoped to a specific user.
   *
   * @param userId - The authenticated user's ID (for ownership verification).
   * @param id - The transaction ID.
   * @returns The transaction record, or undefined if not found.
   *
   * @security User scoping prevents accessing other users' transactions.
   */
  static async findById(
    userId: number,
    id: number
  ): Promise<typeof transactions.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1);

    return results[0];
  }

  /**
   * Creates a new transaction with encrypted sensitive fields.
   *
   * @param data - The transaction data.
   * @returns The created transaction record (with ID).
   *
   * @security
   * - `amount` is stored both as plaintext (for aggregation) and encrypted.
   * - `description` is stored both as plaintext and encrypted.
   */
  static async create(
    data: CreateTransactionInput
  ): Promise<typeof transactions.$inferSelect> {
    const result = await db
      .insert(transactions)
      .values({
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        encryptedAmount: encryptNumber(data.amount, 'transaction-amount'),
        category: data.category,
        description: data.description,
        encryptedDescription: data.description
          ? encryptField(data.description, 'transaction-description')
          : undefined,
        date: data.date,
      })
      .returning();

    return result[0];
  }

  /**
   * Updates an existing transaction.
   *
   * @param userId - The authenticated user's ID (for ownership verification).
   * @param id - The transaction ID.
   * @param data - The updated fields.
   * @returns The updated transaction, or undefined if not found.
   *
   * @security User scoping prevents modifying other users' transactions.
   */
  static async update(
    userId: number,
    id: number,
    data: UpdateTransactionInput
  ): Promise<typeof transactions.$inferSelect | undefined> {
    const result = await db
      .update(transactions)
      .set({
        type: data.type,
        amount: data.amount,
        encryptedAmount: encryptNumber(data.amount, 'transaction-amount'),
        category: data.category,
        description: data.description,
        encryptedDescription: data.description
          ? encryptField(data.description, 'transaction-description')
          : undefined,
        date: data.date,
      })
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Deletes a transaction by ID, scoped to a specific user.
   *
   * @param userId - The authenticated user's ID.
   * @param id - The transaction ID.
   * @returns The deleted transaction, or undefined if not found.
   */
  static async delete(
    userId: number,
    id: number
  ): Promise<typeof transactions.$inferSelect | undefined> {
    const result = await db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Aggregates spending by category for a date range.
   *
   * @param userId - The user's ID.
   * @param startDate - Start of the date range (inclusive).
   * @param endDate - End of the date range (inclusive).
   * @returns Array of { category, total } objects sorted by total descending.
   */
  static async getCategorySpending(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<Array<{ category: string; total: number }>> {
    const results = await db
      .select({
        category: transactions.category,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .groupBy(transactions.category)
      .orderBy(sql`total DESC`);

    return results.map((r) => ({
      category: r.category,
      total: Number(r.total),
    }));
  }

  /**
   * Aggregates daily spending and earnings for a date range.
   *
   * Used by the dashboard chart to render daily bars.
   *
   * @param userId - The user's ID.
   * @param startDate - Start of the date range.
   * @param endDate - End of the date range.
   * @returns Array of { date, expenses, earnings } objects.
   */
  static async getDailySpending(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; expenses: number; earnings: number }>> {
    const results = await db
      .select({
        date: transactions.date,
        expenses: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
        earnings: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )
      .groupBy(transactions.date)
      .orderBy(transactions.date);

    return results.map((r) => ({
      date: r.date,
      expenses: Number(r.expenses),
      earnings: Number(r.earnings),
    }));
  }

  /**
   * Calculates total expenses and earnings for a date range.
   *
   * @param userId - The user's ID.
   * @param startDate - Start of the date range.
   * @param endDate - End of the date range.
   * @returns Object with total expenses and earnings.
   */
  static async getTotals(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<{ expenses: number; earnings: number }> {
    const result = await db
      .select({
        expenses: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' THEN ${transactions.amount} ELSE 0 END), 0)`,
        earnings: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      );

    return {
      expenses: Number(result[0]?.expenses ?? 0),
      earnings: Number(result[0]?.earnings ?? 0),
    };
  }

  /**
   * Gets the total balance (all-time earnings minus expenses) for a user.
   *
   * @param userId - The user's ID.
   * @returns The net balance.
   */
  static async getBalance(userId: number): Promise<number> {
    const result = await db
      .select({
        balance: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' THEN ${transactions.amount} ELSE -${transactions.amount} END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    return Number(result[0]?.balance ?? 0);
  }
}
