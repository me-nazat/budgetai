/**
 * @fileoverview Transaction service — business logic for financial transactions.
 *
 * Orchestrates validation, repository calls, audit logging, and balance synchronization
 * for all transaction operations. Enforces atomic database transactions to guarantee
 * zero balance drift across create, update, delete, and bulk operations.
 *
 * @module services/transaction.service
 */

import { db } from '@/db/client';
import {
  TransactionRepository,
  type TransactionFilters,
  type FilterSummary,
} from '@/repositories/transaction.repository';
import { NotificationRepository } from '@/repositories/notification.repository';
import { BudgetRepository } from '@/repositories/budget.repository';
import { AuditService } from '@/services/audit.service';
import { AccountRepository } from '@/repositories/account.repository';
import { AccountService } from '@/services/account.service';
import { AutomationRulesService } from '@/services/automation-rules.service';
import {
  CreateTransactionDTO,
  UpdateTransactionDTO,
  PatchTransactionDTO,
  type TransactionResponseDTO,
} from '@/lib/types/dto';
import { validateInput } from '@/lib/types/api';
import { NotFoundError, ErrorCode } from '@/lib/types/errors';

/**
 * Context for request-scoped metadata (IP, User-Agent).
 */
export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

/**
 * Helper to accumulate account balance deltas.
 */
function recordBalanceDelta(deltas: Map<number, number>, accountId: number, amount: number) {
  if (!accountId || isNaN(accountId) || amount === 0) return;
  const current = deltas.get(accountId) || 0;
  deltas.set(accountId, current + amount);
}

/**
 * TransactionService — business logic layer for financial transactions.
 */
export class TransactionService {
  /**
   * Retrieves transactions for a user with multi-facet filters and summary aggregations.
   */
  static async getAll(
    userId: number,
    filters: TransactionFilters = {}
  ): Promise<{
    transactions: TransactionResponseDTO[];
    total: number;
    filterSummary: FilterSummary;
  }> {
    const [transactions, total, filterSummary] = await Promise.all([
      TransactionRepository.findAll(userId, filters),
      TransactionRepository.count(userId, filters),
      TransactionRepository.getFilterSummary(userId, filters),
    ]);

    return {
      transactions: transactions.map(TransactionService.toResponseDTO),
      total,
      filterSummary,
    };
  }

  /**
   * Retrieves a single transaction by ID.
   */
  static async getById(
    userId: number,
    id: number
  ): Promise<TransactionResponseDTO> {
    const transaction = await TransactionRepository.findById(userId, id);

    if (!transaction) {
      throw new NotFoundError(
        'Transaction not found',
        ErrorCode.TRANSACTION_NOT_FOUND
      );
    }

    return TransactionService.toResponseDTO(transaction);
  }

  /**
   * Creates a new transaction atomically with account balance adjustments.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: RequestContext = {}
  ): Promise<TransactionResponseDTO> {
    const validated = validateInput(CreateTransactionDTO, data);

    // 1. Idempotency check for offline sync retries
    if (validated.clientMutationId) {
      const existing = await TransactionRepository.findByClientMutationId(userId, validated.clientMutationId);
      if (existing) {
        return TransactionService.toResponseDTO(existing);
      }
    }

    // 2. Determine final category (split handling or automation rules)
    let finalCategory = validated.category;
    let matchedRuleId: number | null = null;

    if (validated.splits && validated.splits.length > 0) {
      if (!finalCategory || finalCategory === 'Other' || finalCategory === 'Split Transaction') {
        finalCategory = 'Split Transaction';
      }
    } else {
      const autoMatch = await AutomationRulesService.applyRules(
        userId,
        validated.description || '',
        validated.category || 'Other'
      );
      if (autoMatch.matchedRuleId) {
        finalCategory = autoMatch.category;
        matchedRuleId = autoMatch.matchedRuleId;
      }
    }

    const transaction = await db.transaction(async (tx) => {
      const created = await TransactionRepository.create(
        {
          userId,
          ...validated,
          category: finalCategory,
        },
        tx
      );

      // Atomic balance update (skip pending transactions from liquid balance)
      if (created.accountId && created.status !== 'pending') {
        if (created.type === 'expense') {
          await AccountRepository.updateBalance(created.accountId, -created.amount, tx);
        } else if (created.type === 'earning') {
          await AccountRepository.updateBalance(created.accountId, created.amount, tx);
        } else if (created.type === 'transfer') {
          await AccountRepository.updateBalance(created.accountId, -created.amount, tx);
          if (created.toAccountId) {
            await AccountRepository.updateBalance(created.toAccountId, created.amount, tx);
          }
        }
      }

      return created;
    });

    if (matchedRuleId) {
      AuditService.logAction({
        userId,
        action: 'UPDATE',
        entityType: 'automation_rule',
        entityId: matchedRuleId,
        newValue: {
          event: 'rule_applied',
          transactionId: transaction.id,
          description: validated.description,
          appliedCategory: finalCategory,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    }

    // Check low balance alert (non-blocking)
    if (transaction.accountId) {
      AccountService.checkLowBalanceAlert(userId, transaction.accountId).catch((err) => {
        console.error('[transaction-service] Low balance alert check failed:', err);
      });
    }

    // Fire-and-forget audit log
    AuditService.logCreate(
      userId,
      'transaction',
      transaction.id,
      {
        type: validated.type,
        amount: validated.amount,
        category: validated.category,
        date: validated.date,
        accountId: validated.accountId,
        toAccountId: validated.toAccountId,
        status: validated.status,
      },
      ctx.ip,
      ctx.userAgent
    );

    // Check budget alerts & process round-up sweeps for expenses (non-blocking)
    if (validated.type === 'expense') {
      TransactionService.checkBudgetAlert(
        userId,
        validated.category,
        validated.date
      ).catch((err) => {
        console.error('[transaction-service] Budget alert check failed:', err);
      });

      import('@/repositories/roundUp.repository')
        .then(({ RoundUpRepository }) =>
          RoundUpRepository.processRoundUpForExpense(
            userId,
            validated.amount,
            transaction.id,
            transaction.accountId ?? undefined
          )
        )
        .catch((err) => console.error('[transaction-service] Round-up sweep failed:', err));
    }

    return TransactionService.toResponseDTO(transaction);
  }

  /**
   * Updates an existing transaction atomically, computing exact balance deltas.
   */
  static async update(
    userId: number,
    data: unknown,
    ctx: RequestContext = {}
  ): Promise<TransactionResponseDTO> {
    const validated = validateInput(UpdateTransactionDTO, data);

    const { updated, oldTransaction } = await db.transaction(async (tx) => {
      // 1. Fetch old value inside transaction
      const old = await TransactionRepository.findById(userId, validated.id, tx);
      if (!old) {
        throw new NotFoundError(
          'Transaction not found',
          ErrorCode.TRANSACTION_NOT_FOUND
        );
      }

      // Validate split total if split enabled
      const splitsArray = validated.splitItemsJson || validated.splits;
      if (validated.isSplit || (splitsArray && splitsArray.length > 0)) {
        if (splitsArray && Array.isArray(splitsArray)) {
          const sum = splitsArray.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
          const targetAmount = validated.personalShareAmount ?? validated.amount ?? old.amount;
          if (Math.abs(sum - targetAmount) > 0.05) {
            throw new Error(`Split items total (${sum.toFixed(2)}) must equal transaction amount (${targetAmount.toFixed(2)})`);
          }
        }
      }

      // 2. Compute net balance deltas across accounts
      const deltas = new Map<number, number>();

      // Revert old impact ONLY if old status was not pending
      if (old.accountId && old.status !== 'pending') {
        if (old.type === 'expense') {
          recordBalanceDelta(deltas, old.accountId, old.amount);
        } else if (old.type === 'earning') {
          recordBalanceDelta(deltas, old.accountId, -old.amount);
        } else if (old.type === 'transfer') {
          recordBalanceDelta(deltas, old.accountId, old.amount);
          if (old.toAccountId) {
            recordBalanceDelta(deltas, old.toAccountId, -old.amount);
          }
        }
      }

      let finalCategory = validated.category;
      if (splitsArray && splitsArray.length > 0) {
        if (!finalCategory || finalCategory === 'Other' || finalCategory === 'Split Transaction') {
          finalCategory = 'Split Transaction';
        }
      }

      // 3. Apply update in DB
      const res = await TransactionRepository.update(
        userId,
        validated.id,
        {
          type: validated.type,
          amount: validated.amount,
          category: finalCategory,
          description: validated.description,
          date: validated.date,
          accountId: validated.accountId,
          toAccountId: validated.toAccountId,
          splits: splitsArray,
          splitItemsJson: splitsArray,
          isSplit: validated.isSplit,
          merchantNormalized: validated.merchantNormalized,
          status: validated.status,
          clientMutationId: validated.clientMutationId,
          notes: validated.notes,
          taxDeductible: validated.taxDeductible,
          attachments: validated.attachments,
          personalShareAmount: validated.personalShareAmount,
          reimbursementStatus: validated.reimbursementStatus,
          collaborativeSourceType: validated.collaborativeSourceType,
          collaborativeSourceId: validated.collaborativeSourceId,
          collaborativeExpenseId: validated.collaborativeExpenseId,
          isSettlementTransfer: validated.isSettlementTransfer,
        },
        tx
      );

      if (!res) {
        throw new NotFoundError(
          'Transaction not found after update',
          ErrorCode.TRANSACTION_NOT_FOUND
        );
      }

      // 4. Apply new impact ONLY if new status is not pending
      if (res.accountId && res.status !== 'pending') {
        if (res.type === 'expense') {
          recordBalanceDelta(deltas, res.accountId, -res.amount);
        } else if (res.type === 'earning') {
          recordBalanceDelta(deltas, res.accountId, res.amount);
        } else if (res.type === 'transfer') {
          recordBalanceDelta(deltas, res.accountId, -res.amount);
          if (res.toAccountId) {
            recordBalanceDelta(deltas, res.toAccountId, res.amount);
          }
        }
      }

      // 5. Commit consolidated account balance adjustments
      if (deltas.size > 0) {
        await AccountRepository.applyBalanceDeltas(deltas, tx);
      }

      return { updated: res, oldTransaction: old };
    });

    if (updated.accountId) {
      AccountService.checkLowBalanceAlert(userId, updated.accountId).catch((err) => {
        console.error('[transaction-service] Low balance alert check failed:', err);
      });
    }

    // Audit log with before/after
    AuditService.logUpdate(
      userId,
      'transaction',
      validated.id,
      {
        type: oldTransaction.type,
        amount: oldTransaction.amount,
        category: oldTransaction.category,
        date: oldTransaction.date,
        accountId: oldTransaction.accountId,
        toAccountId: oldTransaction.toAccountId,
        status: oldTransaction.status,
      },
      {
        type: validated.type,
        amount: validated.amount,
        category: validated.category,
        date: validated.date,
        accountId: validated.accountId,
        toAccountId: validated.toAccountId,
        status: validated.status,
      },
      ctx.ip,
      ctx.userAgent
    );

    return TransactionService.toResponseDTO(updated);
  }

  /**
   * Partially updates a transaction (e.g. inline cell edit: merchant, category, account, amount).
   */
  static async patch(
    userId: number,
    data: unknown,
    ctx: RequestContext = {}
  ): Promise<TransactionResponseDTO> {
    const validated = validateInput(PatchTransactionDTO, data);

    const { updated, oldTransaction } = await db.transaction(async (tx) => {
      const old = await TransactionRepository.findById(userId, validated.id, tx);
      if (!old) {
        throw new NotFoundError(
          'Transaction not found',
          ErrorCode.TRANSACTION_NOT_FOUND
        );
      }

      const deltas = new Map<number, number>();

      // Check if amount, type, accountId, toAccountId, or status changed
      const typeChanged = validated.type !== undefined && validated.type !== old.type;
      const amountChanged = validated.amount !== undefined && validated.amount !== old.amount;
      const accountChanged = validated.accountId !== undefined && validated.accountId !== old.accountId;
      const toAccountChanged = validated.toAccountId !== undefined && validated.toAccountId !== old.toAccountId;
      const statusChanged = validated.status !== undefined && validated.status !== old.status;

      const needsBalanceRecalc = typeChanged || amountChanged || accountChanged || toAccountChanged || statusChanged;

      if (needsBalanceRecalc && old.accountId && old.status !== 'pending') {
        // Revert old
        if (old.type === 'expense') {
          recordBalanceDelta(deltas, old.accountId, old.amount);
        } else if (old.type === 'earning') {
          recordBalanceDelta(deltas, old.accountId, -old.amount);
        } else if (old.type === 'transfer') {
          recordBalanceDelta(deltas, old.accountId, old.amount);
          if (old.toAccountId) {
            recordBalanceDelta(deltas, old.toAccountId, -old.amount);
          }
        }
      }

      const splitsArray = validated.splitItemsJson || validated.splits;
      let finalCategory = validated.category;
      if (splitsArray && splitsArray.length > 0) {
        if (!finalCategory || finalCategory === 'Other' || finalCategory === 'Split Transaction') {
          finalCategory = 'Split Transaction';
        }
      }

      const res = await TransactionRepository.update(
        userId,
        validated.id,
        {
          type: validated.type,
          amount: validated.amount,
          category: finalCategory,
          description: validated.description,
          date: validated.date,
          accountId: validated.accountId,
          toAccountId: validated.toAccountId,
          splits: splitsArray,
          splitItemsJson: splitsArray,
          isSplit: validated.isSplit,
          merchantNormalized: validated.merchantNormalized,
          status: validated.status,
          notes: validated.notes,
          taxDeductible: validated.taxDeductible,
          attachments: validated.attachments,
          personalShareAmount: validated.personalShareAmount,
          reimbursementStatus: validated.reimbursementStatus,
          collaborativeSourceType: validated.collaborativeSourceType,
          collaborativeSourceId: validated.collaborativeSourceId,
          collaborativeExpenseId: validated.collaborativeExpenseId,
          isSettlementTransfer: validated.isSettlementTransfer,
        },
        tx
      );

      if (!res) {
        throw new NotFoundError('Transaction not found after patch', ErrorCode.TRANSACTION_NOT_FOUND);
      }

      if (needsBalanceRecalc && res.accountId && res.status !== 'pending') {
        // Apply new
        if (res.type === 'expense') {
          recordBalanceDelta(deltas, res.accountId, -res.amount);
        } else if (res.type === 'earning') {
          recordBalanceDelta(deltas, res.accountId, res.amount);
        } else if (res.type === 'transfer') {
          recordBalanceDelta(deltas, res.accountId, -res.amount);
          if (res.toAccountId) {
            recordBalanceDelta(deltas, res.toAccountId, res.amount);
          }
        }
      }

      if (deltas.size > 0) {
        await AccountRepository.applyBalanceDeltas(deltas, tx);
      }

      return { updated: res, oldTransaction: old };
    });

    if (updated.accountId) {
      AccountService.checkLowBalanceAlert(userId, updated.accountId).catch((err) => {
        console.error('[transaction-service] Low balance alert check failed:', err);
      });
    }

    AuditService.logUpdate(
      userId,
      'transaction',
      validated.id,
      { description: oldTransaction.description, category: oldTransaction.category, amount: oldTransaction.amount, status: oldTransaction.status },
      { description: updated.description, category: updated.category, amount: updated.amount, status: updated.status },
      ctx.ip,
      ctx.userAgent
    );

    return TransactionService.toResponseDTO(updated);
  }

  /**
   * Deletes a transaction atomically, reverting linked account balances.
   * If part of a paired transfer (`transferGroupId`), deletes both legs.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: RequestContext = {}
  ): Promise<void> {
    const deletedItems = await db.transaction(async (tx) => {
      const target = await TransactionRepository.findById(userId, id, tx);
      if (!target) {
        throw new NotFoundError(
          'Transaction not found',
          ErrorCode.TRANSACTION_NOT_FOUND
        );
      }

      let itemsToDelete = [target];
      if (target.transferGroupId) {
        const paired = await TransactionRepository.findByTransferGroupId(userId, target.transferGroupId, tx);
        if (paired.length > 0) {
          itemsToDelete = paired;
        }
      }

      const deltas = new Map<number, number>();
      for (const item of itemsToDelete) {
        if (item.accountId && item.status !== 'pending') {
          if (item.type === 'expense') {
            recordBalanceDelta(deltas, item.accountId, item.amount);
          } else if (item.type === 'earning') {
            recordBalanceDelta(deltas, item.accountId, -item.amount);
          } else if (item.type === 'transfer') {
            recordBalanceDelta(deltas, item.accountId, item.amount);
            if (item.toAccountId) {
              recordBalanceDelta(deltas, item.toAccountId, -item.amount);
            }
          }
        }
      }

      await TransactionRepository.deleteMany(userId, itemsToDelete.map((i) => i.id), tx);
      await AccountRepository.applyBalanceDeltas(deltas, tx);

      return itemsToDelete;
    });

    for (const deleted of deletedItems) {
      AuditService.logDelete(
        userId,
        'transaction',
        deleted.id,
        {
          type: deleted.type,
          amount: deleted.amount,
          category: deleted.category,
          date: deleted.date,
          accountId: deleted.accountId,
          toAccountId: deleted.toAccountId,
        },
        ctx.ip,
        ctx.userAgent
      );
    }
  }

  /**
   * Deletes multiple transactions atomically in a single database transaction.
   * Restores all account balances without any balance drift.
   */
  static async deleteBulk(
    userId: number,
    ids: number[],
    ctx: RequestContext = {}
  ): Promise<{ count: number }> {
    if (!ids || ids.length === 0) return { count: 0 };

    const deletedItems = await db.transaction(async (tx) => {
      const records = await TransactionRepository.findByIds(userId, ids, tx);
      if (records.length === 0) return [];

      // Check for paired transfer legs
      const itemMap = new Map<number, typeof records[0]>();
      for (const r of records) itemMap.set(r.id, r);

      for (const r of records) {
        if (r.transferGroupId) {
          const paired = await TransactionRepository.findByTransferGroupId(userId, r.transferGroupId, tx);
          for (const p of paired) {
            itemMap.set(p.id, p);
          }
        }
      }

      const allItems = Array.from(itemMap.values());
      const deltas = new Map<number, number>();

      for (const item of allItems) {
        if (item.accountId && item.status !== 'pending') {
          if (item.type === 'expense') {
            recordBalanceDelta(deltas, item.accountId, item.amount);
          } else if (item.type === 'earning') {
            recordBalanceDelta(deltas, item.accountId, -item.amount);
          } else if (item.type === 'transfer') {
            recordBalanceDelta(deltas, item.accountId, item.amount);
            if (item.toAccountId) {
              recordBalanceDelta(deltas, item.toAccountId, -item.amount);
            }
          }
        }
      }

      await TransactionRepository.deleteMany(userId, allItems.map((i) => i.id), tx);
      await AccountRepository.applyBalanceDeltas(deltas, tx);

      return allItems;
    });

    for (const d of deletedItems) {
      AuditService.logDelete(
        userId,
        'transaction',
        d.id,
        { type: d.type, amount: d.amount, category: d.category },
        ctx.ip,
        ctx.userAgent
      );
    }

    return { count: deletedItems.length };
  }

  /**
   * Bulk updates the category for specified transactions.
   */
  static async bulkCategorize(
    userId: number,
    ids: number[],
    category: string,
    _ctx: RequestContext = {}
  ): Promise<{ count: number }> {
    if (!ids || ids.length === 0 || !category) return { count: 0 };
    const count = await db.transaction(async (tx) => {
      return TransactionRepository.bulkCategorize(userId, ids, category.trim(), tx);
    });
    return { count };
  }

  /**
   * Bulk moves transactions to a target account, updating balances atomically.
   * Employs the Aggregated Net Delta pattern to ensure zero drift.
   */
  static async bulkMoveAccount(
    userId: number,
    ids: number[],
    targetAccountId: number,
    _ctx: RequestContext = {}
  ): Promise<{ count: number }> {
    if (!ids || ids.length === 0 || !targetAccountId) return { count: 0 };

    const count = await db.transaction(async (tx) => {
      const targetAccount = await AccountRepository.findById(targetAccountId, userId);
      if (!targetAccount) {
        throw new NotFoundError('Target account not found', ErrorCode.ACCOUNT_NOT_FOUND);
      }

      const records = await TransactionRepository.findByIds(userId, ids, tx);
      if (records.length === 0) return 0;

      const deltas = new Map<number, number>();

      for (const rec of records) {
        if (rec.accountId === targetAccountId) continue;

        // Revert old account impact
        if (rec.accountId) {
          if (rec.type === 'expense') {
            recordBalanceDelta(deltas, rec.accountId, rec.amount);
          } else if (rec.type === 'earning') {
            recordBalanceDelta(deltas, rec.accountId, -rec.amount);
          } else if (rec.type === 'transfer') {
            recordBalanceDelta(deltas, rec.accountId, rec.amount);
          }
        }

        // Apply target account impact
        if (rec.type === 'expense') {
          recordBalanceDelta(deltas, targetAccountId, -rec.amount);
        } else if (rec.type === 'earning') {
          recordBalanceDelta(deltas, targetAccountId, rec.amount);
        } else if (rec.type === 'transfer') {
          recordBalanceDelta(deltas, targetAccountId, -rec.amount);
        }
      }

      await TransactionRepository.bulkMoveAccount(userId, ids, targetAccountId, tx);
      await AccountRepository.applyBalanceDeltas(deltas, tx);

      return records.length;
    });

    return { count };
  }

  /**
   * Checks if an expense triggers a budget alert.
   */
  private static async checkBudgetAlert(
    userId: number,
    category: string,
    date: string
  ): Promise<void> {
    const d = new Date(date + 'T00:00:00Z');
    const month = d.getUTCMonth() + 1;
    const year = d.getUTCFullYear();

    const budget = await BudgetRepository.findByCategory(
      userId,
      category,
      month,
      year
    );

    if (!budget) return;

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const categorySpending = await TransactionRepository.getCategorySpending(
      userId,
      startDate,
      endDate
    );
    const catSpend = categorySpending.find((c) => c.category === category);
    const spent = catSpend?.total || 0;
    const percentage = Math.round((spent / budget.monthlyLimit) * 100);

    if (percentage >= 100) {
      await NotificationRepository.create({
        userId,
        type: 'warning',
        title: `Budget exceeded: ${category}`,
        message: `You've spent $${spent.toFixed(2)} of your $${budget.monthlyLimit.toFixed(2)} ${category} budget (${percentage}%).`,
      });
    } else if (percentage >= 80) {
      await NotificationRepository.create({
        userId,
        type: 'info',
        title: `Budget alert: ${category}`,
        message: `You've used ${percentage}% of your ${category} budget ($${spent.toFixed(2)} / $${budget.monthlyLimit.toFixed(2)}).`,
      });
    }
  }

  /**
   * Maps a database record to a response DTO.
   */
  private static toResponseDTO(
    record: Record<string, unknown>
  ): TransactionResponseDTO {
    let splits: any = record.splits || record.splitItemsJson;
    if (splits && typeof splits === 'string') {
      try {
        splits = JSON.parse(splits);
      } catch {
        splits = undefined;
      }
    }

    const isSplitVal = record.isSplit === 1 || Boolean(record.isSplit) || (Array.isArray(splits) && splits.length > 0);

    return {
      id: record.id as number,
      type: record.type as string,
      amount: record.amount as number,
      category: record.category as string,
      description: (record.description as string) || '',
      date: record.date as string,
      createdAt: record.createdAt as string | undefined,
      accountId: record.accountId as number | undefined | null,
      toAccountId: record.toAccountId as number | undefined | null,
      splits: splits || undefined,
      splitItemsJson: splits || undefined,
      isSplit: isSplitVal,
      merchantNormalized: (record.merchantNormalized as string) || undefined,
      status: (record.status as 'cleared' | 'pending' | 'reconciled') || 'cleared',
      notes: (record.notes as string) || undefined,
      taxDeductible: record.taxDeductible as number | undefined,
      taxSuggested: record.taxSuggested as number | undefined,
      transferGroupId: record.transferGroupId as string | undefined | null,
      attachments: record.attachments as string | undefined | null,
      personalShareAmount: record.personalShareAmount as number | undefined | null,
      reimbursementStatus: record.reimbursementStatus as any,
      collaborativeSourceType: record.collaborativeSourceType as any,
      collaborativeSourceId: record.collaborativeSourceId as any,
      collaborativeExpenseId: record.collaborativeExpenseId as any,
      isSettlementTransfer: record.isSettlementTransfer ? 1 : 0,
      clientMutationId: record.clientMutationId as string | undefined | null,
    };
  }

  // Aliases for fintech engine naming conventions
  static createTransaction = TransactionService.create;
  static updateTransaction = TransactionService.update;
  static deleteTransaction = TransactionService.delete;
  static bulkDeleteTransactions = TransactionService.deleteBulk;
}
