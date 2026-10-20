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
 * - Multi-facet filtering and summary aggregation.
 * - Atomic database transaction support via `txClient`.
 *
 * @module repositories/transaction.repository
 */

import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { eq, and, gte, lte, desc, asc, sql, count, inArray } from 'drizzle-orm';
import { encryptField, encryptNumber } from '@/lib/crypto/encryption';
import { normalizeMerchant } from '@/lib/categoryUtils';

/**
 * Input data for creating a new transaction.
 */
export interface CreateTransactionInput {
  userId: number;
  type: 'expense' | 'earning' | 'transfer';
  amount: number;
  category: string;
  description: string;
  date: string;
  accountId?: number | null;
  toAccountId?: number | null;
  transferGroupId?: string | null;
  taxSuggested?: number | null;
  splits?: Array<{ id: string; category: string; amount: number; note?: string; isTaxDeductible?: boolean }> | string | null;
  splitItemsJson?: Array<{ id: string; category: string; amount: number; note?: string; isTaxDeductible?: boolean }> | string | null;
  isSplit?: number | boolean | null;
  merchantNormalized?: string | null;
  status?: 'cleared' | 'pending' | 'reconciled' | null;
  clientMutationId?: string | null;
  notes?: string | null;
  taxDeductible?: number | boolean | null;
  attachments?: string | null;
  personalShareAmount?: number | null;
  reimbursementStatus?: 'none' | 'receivable' | 'payable' | 'settled' | null;
  collaborativeSourceType?: 'tour' | 'household' | 'bill_split' | null;
  collaborativeSourceId?: string | null;
  collaborativeExpenseId?: string | null;
  isSettlementTransfer?: number | boolean | null;
}

/**
 * Input data for updating an existing transaction.
 */
export interface UpdateTransactionInput {
  type?: 'expense' | 'earning' | 'transfer';
  amount?: number;
  category?: string;
  description?: string;
  date?: string;
  accountId?: number | null;
  toAccountId?: number | null;
  transferGroupId?: string | null;
  taxSuggested?: number | null;
  splits?: Array<{ id: string; category: string; amount: number; note?: string; isTaxDeductible?: boolean }> | string | null;
  splitItemsJson?: Array<{ id: string; category: string; amount: number; note?: string; isTaxDeductible?: boolean }> | string | null;
  isSplit?: number | boolean | null;
  merchantNormalized?: string | null;
  status?: 'cleared' | 'pending' | 'reconciled' | null;
  clientMutationId?: string | null;
  notes?: string | null;
  taxDeductible?: number | boolean | null;
  attachments?: string | null;
  personalShareAmount?: number | null;
  reimbursementStatus?: 'none' | 'receivable' | 'payable' | 'settled' | null;
  collaborativeSourceType?: 'tour' | 'household' | 'bill_split' | null;
  collaborativeSourceId?: string | null;
  collaborativeExpenseId?: string | null;
  isSettlementTransfer?: number | boolean | null;
}

/**
 * Filters for querying transactions.
 */
export interface TransactionFilters {
  start?: string;
  end?: string;
  month?: string; // YYYY-MM
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  category?: string;
  categories?: string[] | string;
  type?: 'all' | 'expense' | 'earning' | 'income' | 'transfer';
  limit?: number;
  offset?: number;
  page?: number;
  accountId?: number;
  accountIds?: number[] | string;
  search?: string;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  taxDeductible?: 'true' | 'false' | boolean;
  hasAttachment?: 'true' | 'false' | boolean;
  hasAttachments?: 'true' | 'false' | boolean;
  status?: 'cleared' | 'pending' | 'reconciled';
  sortBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  sort?: string;
}

/**
 * Summary computed across the entire filtered transaction set.
 */
export interface FilterSummary {
  totalCount: number;
  totalInflows: number;
  totalOutflows: number;
  totalInflow?: number;
  totalOutflow?: number;
  netCashflow: number;
  averageTransactionAmount: number;
}

/**
 * TransactionRepository — data access object for financial transactions.
 */
export class TransactionRepository {
  /**
   * Helper to construct all SQL WHERE clauses for multi-facet filtering.
   */
  private static buildFilterConditions(userId: number, filters: TransactionFilters = {}) {
    const conditions = [eq(transactions.userId, userId)];

    // Month filter: YYYY-MM
    if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
      const [year, m] = filters.month.split('-').map(Number);
      const lastDay = new Date(year, m, 0).getDate();
      const mStart = `${filters.month}-01`;
      const mEnd = `${filters.month}-${String(lastDay).padStart(2, '0')}`;
      conditions.push(gte(sql`DATE(${transactions.date})`, mStart));
      conditions.push(lte(sql`DATE(${transactions.date})`, mEnd));
    } else {
      const startDate = filters.startDate || filters.start;
      if (startDate) {
        conditions.push(gte(sql`DATE(${transactions.date})`, startDate));
      }
      const endDate = filters.endDate || filters.end;
      if (endDate) {
        conditions.push(lte(sql`DATE(${transactions.date})`, endDate));
      }
    }

    // Type filter
    if (filters.type && filters.type !== 'all') {
      const normalizedType = filters.type === 'income' ? 'earning' : filters.type;
      conditions.push(eq(transactions.type, normalizedType as 'expense' | 'earning' | 'transfer'));
    }

    // Categories filter (multi or single, supporting split transactions matching)
    if (filters.categories) {
      const catList = Array.isArray(filters.categories)
        ? filters.categories
        : filters.categories.split(',').map((c) => c.trim()).filter(Boolean);
      if (catList.length > 0) {
        const catClauses = catList.map((cat) => {
          const pattern = `%"category":"${cat}"%`;
          return sql`(${transactions.category} = ${cat} OR (COALESCE(${transactions.isSplit}, 0) = 1 AND (${transactions.splitItemsJson} LIKE ${pattern} OR ${transactions.splits} LIKE ${pattern})))`;
        });
        conditions.push(sql`(${sql.join(catClauses, sql` OR `)})`);
      }
    } else if (filters.category) {
      const cat = filters.category;
      const pattern = `%"category":"${cat}"%`;
      conditions.push(
        sql`(${transactions.category} = ${cat} OR (COALESCE(${transactions.isSplit}, 0) = 1 AND (${transactions.splitItemsJson} LIKE ${pattern} OR ${transactions.splits} LIKE ${pattern})))`
      );
    }

    // Account IDs filter (multi or single)
    if (filters.accountIds) {
      const rawIds = Array.isArray(filters.accountIds)
        ? filters.accountIds
        : filters.accountIds
            .split(',')
            .map((id) => parseInt(id.trim(), 10))
            .filter((n) => !isNaN(n));
      if (rawIds.length > 0) {
        const idList = rawIds.map((id) => sql`${id}`);
        conditions.push(
          sql`(${transactions.accountId} IN (${sql.join(idList, sql`, `)}) OR ${transactions.toAccountId} IN (${sql.join(idList, sql`, `)}))`
        );
      }
    } else if (filters.accountId) {
      conditions.push(
        sql`(${transactions.accountId} = ${filters.accountId} OR ${transactions.toAccountId} = ${filters.accountId})`
      );
    }

    // Status filter
    if (filters.status) {
      conditions.push(eq(transactions.status, filters.status));
    }

    // Amount bounds
    if (typeof filters.minAmount === 'number' && !isNaN(filters.minAmount)) {
      conditions.push(gte(transactions.amount, filters.minAmount));
    }
    if (typeof filters.maxAmount === 'number' && !isNaN(filters.maxAmount)) {
      conditions.push(lte(transactions.amount, filters.maxAmount));
    }

    // Free text search (description, merchantNormalized, notes, category, amount)
    const searchTerm = (filters.q || filters.search || '').trim();
    if (searchTerm) {
      const term = `%${searchTerm.toLowerCase()}%`;
      conditions.push(
        sql`(LOWER(${transactions.description}) LIKE ${term} OR LOWER(COALESCE(${transactions.merchantNormalized}, '')) LIKE ${term} OR LOWER(${transactions.category}) LIKE ${term} OR LOWER(COALESCE(${transactions.notes}, '')) LIKE ${term} OR CAST(${transactions.amount} AS TEXT) LIKE ${term})`
      );
    }

    // Tax deductible
    if (filters.taxDeductible !== undefined) {
      const isTax = filters.taxDeductible === 'true' || filters.taxDeductible === true;
      if (isTax) {
        conditions.push(
          sql`(${transactions.taxSuggested} = 1 OR ${transactions.taxDeductible} = 1 OR EXISTS (SELECT 1 FROM tax_deductions td WHERE td.transaction_id = ${transactions.id}))`
        );
      } else {
        conditions.push(
          sql`(${transactions.taxSuggested} = 0 OR ${transactions.taxSuggested} IS NULL) AND (${transactions.taxDeductible} = 0 OR ${transactions.taxDeductible} IS NULL) AND NOT EXISTS (SELECT 1 FROM tax_deductions td WHERE td.transaction_id = ${transactions.id})`
        );
      }
    }

    // Has attachments
    const hasAttParam = filters.hasAttachment !== undefined ? filters.hasAttachment : filters.hasAttachments;
    if (hasAttParam !== undefined) {
      const hasAtt = hasAttParam === 'true' || hasAttParam === true;
      if (hasAtt) {
        conditions.push(
          sql`(${transactions.attachments} IS NOT NULL AND length(${transactions.attachments}) > 0 OR EXISTS (SELECT 1 FROM tax_deductions td WHERE td.transaction_id = ${transactions.id} AND td.receipt_document_id IS NOT NULL))`
        );
      } else {
        conditions.push(
          sql`(${transactions.attachments} IS NULL OR length(${transactions.attachments}) = 0) AND NOT EXISTS (SELECT 1 FROM tax_deductions td WHERE td.transaction_id = ${transactions.id} AND td.receipt_document_id IS NOT NULL)`
        );
      }
    }

    return conditions;
  }

  /**
   * Retrieves transactions for a user with optional filters and sorting.
   */
  static async findAll(
    userId: number,
    filters: TransactionFilters = {},
    txClient?: any
  ): Promise<Array<typeof transactions.$inferSelect>> {
    const client = txClient || db;
    const conditions = this.buildFilterConditions(userId, filters);

    const effectiveSort = filters.sort || filters.sortBy || 'date_desc';
    const sortOrders = [];
    if (effectiveSort === 'date_asc') {
      sortOrders.push(asc(transactions.date), asc(transactions.id));
    } else if (effectiveSort === 'amount_desc') {
      sortOrders.push(desc(transactions.amount), desc(transactions.date));
    } else if (effectiveSort === 'amount_asc') {
      sortOrders.push(asc(transactions.amount), desc(transactions.date));
    } else {
      sortOrders.push(desc(transactions.date), desc(transactions.id));
    }

    const limit = filters.limit ?? 200;
    const offset = filters.offset !== undefined
      ? filters.offset
      : (filters.page && limit ? (Math.max(1, filters.page) - 1) * limit : 0);

    const results = await client
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(...sortOrders)
      .limit(limit)
      .offset(offset);

    return results;
  }

  /**
   * Counts total transactions matching the given filters.
   */
  static async count(
    userId: number,
    filters: TransactionFilters = {},
    txClient?: any
  ): Promise<number> {
    const client = txClient || db;
    const conditions = this.buildFilterConditions(userId, filters);

    const result = await client
      .select({ total: count() })
      .from(transactions)
      .where(and(...conditions));

    return result[0]?.total ?? 0;
  }

  /**
   * Calculates comprehensive filter summary across the entire filtered transaction set.
   */
  static async getFilterSummary(
    userId: number,
    filters: TransactionFilters = {},
    txClient?: any
  ): Promise<FilterSummary> {
    const client = txClient || db;
    const conditions = this.buildFilterConditions(userId, filters);

    const [summary] = await client
      .select({
        totalCount: count(),
        totalInflows: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
        totalOutflows: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN COALESCE(${transactions.personalShareAmount}, ${transactions.amount}) ELSE 0 END), 0)`,
        netCashflow: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN ${transactions.amount} WHEN ${transactions.type} = 'expense' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN -COALESCE(${transactions.personalShareAmount}, ${transactions.amount}) ELSE 0 END), 0)`,
        averageTransactionAmount: sql<number>`COALESCE(AVG(COALESCE(${transactions.personalShareAmount}, ${transactions.amount})), 0)`,
      })
      .from(transactions)
      .where(and(...conditions));

    const totalInflows = Number(summary?.totalInflows ?? 0);
    const totalOutflows = Number(summary?.totalOutflows ?? 0);

    return {
      totalCount: Number(summary?.totalCount ?? 0),
      totalInflows,
      totalOutflows,
      totalInflow: totalInflows,
      totalOutflow: totalOutflows,
      netCashflow: Number(summary?.netCashflow ?? 0),
      averageTransactionAmount: Number(summary?.averageTransactionAmount ?? 0),
    };
  }

  /**
   * Finds a single transaction by ID, scoped to a specific user.
   */
  static async findById(
    userId: number,
    id: number,
    txClient?: any
  ): Promise<typeof transactions.$inferSelect | undefined> {
    const client = txClient || db;
    const results = await client
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1);

    return results[0];
  }

  /**
   * Finds multiple transactions by IDs, scoped to a specific user.
   */
  static async findByIds(
    userId: number,
    ids: number[],
    txClient?: any
  ): Promise<Array<typeof transactions.$inferSelect>> {
    if (ids.length === 0) return [];
    const client = txClient || db;
    return client
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));
  }

  /**
   * Finds transactions belonging to a specific transfer group.
   */
  static async findByTransferGroupId(
    userId: number,
    transferGroupId: string,
    txClient?: any
  ): Promise<Array<typeof transactions.$inferSelect>> {
    const client = txClient || db;
    return client
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.transferGroupId, transferGroupId)));
  }

  /**
   * Finds a transaction by its clientMutationId for idempotent deduplication.
   */
  static async findByClientMutationId(
    userId: number,
    clientMutationId: string,
    txClient?: any
  ): Promise<typeof transactions.$inferSelect | undefined> {
    const client = txClient || db;
    const results = await client
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.clientMutationId, clientMutationId)))
      .limit(1);

    return results[0];
  }

  /**
   * Creates a new transaction with encrypted sensitive fields.
   */
  static async create(
    data: CreateTransactionInput,
    txClient?: any
  ): Promise<typeof transactions.$inferSelect> {
    const client = txClient || db;
    const splitsStr = data.splitItemsJson
      ? (typeof data.splitItemsJson === 'string' ? data.splitItemsJson : JSON.stringify(data.splitItemsJson))
      : (data.splits ? (typeof data.splits === 'string' ? data.splits : JSON.stringify(data.splits)) : null);

    const isSplitVal = data.isSplit !== undefined && data.isSplit !== null
      ? (data.isSplit ? 1 : 0)
      : (splitsStr ? 1 : 0);

    const normMerchant = data.merchantNormalized !== undefined && data.merchantNormalized !== null
      ? data.merchantNormalized
      : (data.description ? normalizeMerchant(data.description) : null);

    const statusVal = data.status || 'cleared';

    const result = await client
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
        accountId: data.accountId,
        toAccountId: data.toAccountId,
        transferGroupId: data.transferGroupId,
        taxSuggested: data.taxSuggested ?? 0,
        splits: splitsStr,
        splitItemsJson: splitsStr,
        isSplit: isSplitVal,
        merchantNormalized: normMerchant,
        status: statusVal,
        clientMutationId: data.clientMutationId ?? null,
        notes: data.notes ?? '',
        taxDeductible: data.taxDeductible ? 1 : 0,
        attachments: data.attachments ?? null,
        personalShareAmount: data.personalShareAmount ?? null,
        reimbursementStatus: data.reimbursementStatus ?? 'none',
        collaborativeSourceType: data.collaborativeSourceType ?? null,
        collaborativeSourceId: data.collaborativeSourceId ?? null,
        collaborativeExpenseId: data.collaborativeExpenseId ?? null,
        isSettlementTransfer: data.isSettlementTransfer ? 1 : 0,
      })
      .returning();

    return result[0];
  }

  /**
   * Updates an existing transaction.
   */
  static async update(
    userId: number,
    id: number,
    data: UpdateTransactionInput,
    txClient?: any
  ): Promise<typeof transactions.$inferSelect | undefined> {
    const client = txClient || db;
    const updateData: Record<string, any> = {};

    if (data.type !== undefined) updateData.type = data.type;
    if (data.amount !== undefined) {
      updateData.amount = data.amount;
      updateData.encryptedAmount = encryptNumber(data.amount, 'transaction-amount');
    }
    if (data.category !== undefined) updateData.category = data.category;
    if (data.description !== undefined) {
      updateData.description = data.description;
      updateData.encryptedDescription = data.description
        ? encryptField(data.description, 'transaction-description')
        : undefined;
      if (data.merchantNormalized === undefined) {
        updateData.merchantNormalized = normalizeMerchant(data.description);
      }
    }
    if (data.merchantNormalized !== undefined) {
      updateData.merchantNormalized = data.merchantNormalized;
    }
    if (data.date !== undefined) updateData.date = data.date;
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.toAccountId !== undefined) updateData.toAccountId = data.toAccountId;
    if (data.transferGroupId !== undefined) updateData.transferGroupId = data.transferGroupId;
    if (data.taxSuggested !== undefined) updateData.taxSuggested = data.taxSuggested;

    if (data.splitItemsJson !== undefined) {
      const sJson = data.splitItemsJson
        ? (typeof data.splitItemsJson === 'string' ? data.splitItemsJson : JSON.stringify(data.splitItemsJson))
        : null;
      updateData.splitItemsJson = sJson;
      updateData.splits = sJson;
      if (data.isSplit === undefined) updateData.isSplit = sJson ? 1 : 0;
    } else if (data.splits !== undefined) {
      const sStr = data.splits
        ? (typeof data.splits === 'string' ? data.splits : JSON.stringify(data.splits))
        : null;
      updateData.splits = sStr;
      updateData.splitItemsJson = sStr;
      if (data.isSplit === undefined) updateData.isSplit = sStr ? 1 : 0;
    }
    if (data.isSplit !== undefined) {
      updateData.isSplit = data.isSplit ? 1 : 0;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    if (data.clientMutationId !== undefined) updateData.clientMutationId = data.clientMutationId;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.taxDeductible !== undefined) updateData.taxDeductible = data.taxDeductible ? 1 : 0;
    if (data.attachments !== undefined) updateData.attachments = data.attachments;
    if (data.personalShareAmount !== undefined) updateData.personalShareAmount = data.personalShareAmount;
    if (data.reimbursementStatus !== undefined) updateData.reimbursementStatus = data.reimbursementStatus;
    if (data.collaborativeSourceType !== undefined) updateData.collaborativeSourceType = data.collaborativeSourceType;
    if (data.collaborativeSourceId !== undefined) updateData.collaborativeSourceId = data.collaborativeSourceId;
    if (data.collaborativeExpenseId !== undefined) updateData.collaborativeExpenseId = data.collaborativeExpenseId;
    if (data.isSettlementTransfer !== undefined) updateData.isSettlementTransfer = data.isSettlementTransfer ? 1 : 0;

    const result = await client
      .update(transactions)
      .set(updateData)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Deletes a transaction by ID, scoped to a specific user.
   */
  static async delete(
    userId: number,
    id: number,
    txClient?: any
  ): Promise<typeof transactions.$inferSelect | undefined> {
    const client = txClient || db;
    const result = await client
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();

    return result[0];
  }

  /**
   * Deletes multiple transactions by IDs, scoped to a specific user.
   */
  static async deleteMany(
    userId: number,
    ids: number[],
    txClient?: any
  ): Promise<Array<typeof transactions.$inferSelect>> {
    if (ids.length === 0) return [];
    const client = txClient || db;
    const result = await client
      .delete(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
      .returning();

    return result;
  }

  /**
   * Bulk updates the category for specified transactions.
   */
  static async bulkCategorize(
    userId: number,
    ids: number[],
    category: string,
    txClient?: any
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const client = txClient || db;
    const result = await client
      .update(transactions)
      .set({ category })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
      .returning();

    return result.length;
  }

  /**
   * Bulk updates the account for specified transactions.
   */
  static async bulkMoveAccount(
    userId: number,
    ids: number[],
    targetAccountId: number,
    txClient?: any
  ): Promise<number> {
    if (ids.length === 0) return 0;
    const client = txClient || db;
    const result = await client
      .update(transactions)
      .set({ accountId: targetAccountId })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)))
      .returning();

    return result.length;
  }

  /**
   * Aggregates spending by category for a date range.
   */
  static async getCategorySpending(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<Array<{ category: string; total: number }>> {
    const expenseRows = await db
      .select({
        category: transactions.category,
        amount: sql<number>`COALESCE(${transactions.personalShareAmount}, ${transactions.amount})`,
        splits: transactions.splits,
        splitItemsJson: transactions.splitItemsJson,
        isSplit: transactions.isSplit,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          sql`COALESCE(${transactions.isSettlementTransfer}, 0) = 0`,
          gte(sql`DATE(${transactions.date})`, startDate),
          lte(sql`DATE(${transactions.date})`, endDate)
        )
      );

    const categoryMap = new Map<string, number>();

    for (const row of expenseRows) {
      const splitRaw = row.splitItemsJson || row.splits;
      if (row.isSplit === 1 || splitRaw) {
        try {
          const splitItems = typeof splitRaw === 'string' ? JSON.parse(splitRaw) : splitRaw;
          if (Array.isArray(splitItems) && splitItems.length > 0) {
            for (const s of splitItems) {
              const cat = s.category || 'Other';
              const cur = categoryMap.get(cat) || 0;
              categoryMap.set(cat, cur + (Number(s.amount) || 0));
            }
            continue;
          }
        } catch {
          // Fall back to parent category on parse failure
        }
      }

      const cat = row.category || 'Other';
      const cur = categoryMap.get(cat) || 0;
      categoryMap.set(cat, cur + Number(row.amount));
    }

    return Array.from(categoryMap.entries())
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }

  /**
   * Aggregates daily spending and earnings for a date range.
   */
  static async getDailySpending(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<Array<{ date: string; expenses: number; earnings: number }>> {
    const results = await db
      .select({
        date: sql<string>`DATE(${transactions.date})`,
        expenses: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN COALESCE(${transactions.personalShareAmount}, ${transactions.amount}) ELSE 0 END), 0)`,
        earnings: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(sql`DATE(${transactions.date})`, startDate),
          lte(sql`DATE(${transactions.date})`, endDate)
        )
      )
      .groupBy(sql`DATE(${transactions.date})`)
      .orderBy(sql`DATE(${transactions.date})`);

    return results.map((r) => ({
      date: r.date,
      expenses: Number(r.expenses),
      earnings: Number(r.earnings),
    }));
  }

  /**
   * Calculates total expenses and earnings for a date range.
   */
  static async getTotals(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<{ expenses: number; earnings: number }> {
    const result = await db
      .select({
        expenses: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'expense' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN COALESCE(${transactions.personalShareAmount}, ${transactions.amount}) ELSE 0 END), 0)`,
        earnings: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN ${transactions.amount} ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(sql`DATE(${transactions.date})`, startDate),
          lte(sql`DATE(${transactions.date})`, endDate)
        )
      );

    return {
      expenses: Number(result[0]?.expenses ?? 0),
      earnings: Number(result[0]?.earnings ?? 0),
    };
  }

  /**
   * Gets the total balance (all-time earnings minus expenses) for a user.
   */
  static async getBalance(userId: number): Promise<number> {
    const result = await db
      .select({
        balance: sql<number>`COALESCE(SUM(CASE WHEN ${transactions.type} = 'earning' AND COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN ${transactions.amount} WHEN COALESCE(${transactions.isSettlementTransfer}, 0) = 0 THEN -COALESCE(${transactions.personalShareAmount}, ${transactions.amount}) ELSE 0 END), 0)`,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    return Number(result[0]?.balance ?? 0);
  }
}
