/**
 * @fileoverview Transaction service — business logic for financial transactions.
 *
 * Orchestrates validation, repository calls, audit logging, and encryption
 * for all transaction operations. This is the single entry point for
 * transaction-related business logic.
 *
 * ## Responsibilities
 * - Input validation via Zod DTOs.
 * - Calling TransactionRepository for data persistence.
 * - Triggering AuditService for every mutation.
 * - Budget alert checking after expenses.
 * - Notification creation for budget overages.
 *
 * @module services/transaction.service
 */

import { TransactionRepository, type TransactionFilters } from '@/repositories/transaction.repository';
import { NotificationRepository } from '@/repositories/notification.repository';
import { BudgetRepository } from '@/repositories/budget.repository';
import { AuditService } from '@/services/audit.service';
import { AccountRepository } from '@/repositories/account.repository';
import { AccountService } from '@/services/account.service';
import {
  CreateTransactionDTO,
  UpdateTransactionDTO,
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
 * TransactionService — business logic layer for financial transactions.
 *
 * @example
 * ```ts
 * const txn = await TransactionService.create(userId, {
 *   type: 'expense',
 *   amount: 42.50,
 *   category: 'Food',
 *   description: 'Lunch at café',
 * }, { ip: '192.168.1.1' });
 * ```
 */
export class TransactionService {
  /**
   * Retrieves transactions for a user with optional filters.
   *
   * @param userId - The authenticated user's ID.
   * @param filters - Query filters (date range, type, pagination).
   * @returns Object with transactions array and total count.
   */
  static async getAll(
    userId: number,
    filters: TransactionFilters = {}
  ): Promise<{ transactions: TransactionResponseDTO[]; total: number }> {
    const [transactions, total] = await Promise.all([
      TransactionRepository.findAll(userId, filters),
      TransactionRepository.count(userId, filters),
    ]);

    return {
      transactions: transactions.map(TransactionService.toResponseDTO),
      total,
    };
  }

  /**
   * Retrieves a single transaction by ID.
   *
   * @param userId - The authenticated user's ID.
   * @param id - The transaction ID.
   * @returns The transaction response DTO.
   *
   * @throws {NotFoundError} If the transaction doesn't exist or belongs to another user.
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
   * Creates a new transaction.
   *
   * Validates input, persists to the database, creates an audit log,
   * and checks budget alerts for expense transactions.
   *
   * @param userId - The authenticated user's ID.
   * @param data - Raw input data (validated via Zod).
   * @param ctx - Request context for audit logging.
   * @returns The created transaction response DTO.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: RequestContext = {}
  ): Promise<TransactionResponseDTO> {
    const validated = validateInput(CreateTransactionDTO, data);

    const transaction = await TransactionRepository.create({
      userId,
      ...validated,
    });

    // Update account balances
    if (transaction.accountId) {
      if (transaction.type === 'expense') {
        await AccountRepository.updateBalance(transaction.accountId, -transaction.amount);
      } else if (transaction.type === 'earning') {
        await AccountRepository.updateBalance(transaction.accountId, transaction.amount);
      } else if (transaction.type === 'transfer') {
        await AccountRepository.updateBalance(transaction.accountId, -transaction.amount);
        if (transaction.toAccountId) {
          await AccountRepository.updateBalance(transaction.toAccountId, transaction.amount);
        }
      }
      // Check low balance alert (non-blocking)
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

      // Module 15: Wire micro-savings round-up sweep
      import('@/repositories/roundUp.repository')
        .then(({ RoundUpRepository }) => RoundUpRepository.processRoundUpForExpense(userId, validated.amount))
        .catch((err) => console.error('[transaction-service] Round-up sweep failed:', err));
    }

    return TransactionService.toResponseDTO(transaction);
  }

  /**
   * Updates an existing transaction.
   *
   * @param userId - The authenticated user's ID.
   * @param data - Raw input data including the transaction ID.
   * @param ctx - Request context for audit logging.
   * @returns The updated transaction response DTO.
   *
   * @throws {NotFoundError} If the transaction doesn't exist.
   */
  static async update(
    userId: number,
    data: unknown,
    ctx: RequestContext = {}
  ): Promise<TransactionResponseDTO> {
    const validated = validateInput(UpdateTransactionDTO, data);

    // Fetch old value for audit comparison
    const oldTransaction = await TransactionRepository.findById(userId, validated.id);
    if (!oldTransaction) {
      throw new NotFoundError(
        'Transaction not found',
        ErrorCode.TRANSACTION_NOT_FOUND
      );
    }

    // Revert old account balances
    if (oldTransaction.accountId) {
      if (oldTransaction.type === 'expense') {
        await AccountRepository.updateBalance(oldTransaction.accountId, oldTransaction.amount);
      } else if (oldTransaction.type === 'earning') {
        await AccountRepository.updateBalance(oldTransaction.accountId, -oldTransaction.amount);
      } else if (oldTransaction.type === 'transfer') {
        await AccountRepository.updateBalance(oldTransaction.accountId, oldTransaction.amount);
        if (oldTransaction.toAccountId) {
          await AccountRepository.updateBalance(oldTransaction.toAccountId, -oldTransaction.amount);
        }
      }
    }

    const updated = await TransactionRepository.update(userId, validated.id, {
      type: validated.type,
      amount: validated.amount,
      category: validated.category,
      description: validated.description,
      date: validated.date,
      accountId: validated.accountId,
      toAccountId: validated.toAccountId,
    });

    if (!updated) {
      throw new NotFoundError(
        'Transaction not found after update',
        ErrorCode.TRANSACTION_NOT_FOUND
      );
    }

    // Apply new account balances
    if (updated.accountId) {
      if (updated.type === 'expense') {
        await AccountRepository.updateBalance(updated.accountId, -updated.amount);
      } else if (updated.type === 'earning') {
        await AccountRepository.updateBalance(updated.accountId, updated.amount);
      } else if (updated.type === 'transfer') {
        await AccountRepository.updateBalance(updated.accountId, -updated.amount);
        if (updated.toAccountId) {
          await AccountRepository.updateBalance(updated.toAccountId, updated.amount);
        }
      }
      // Check low balance alert (non-blocking)
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
      },
      {
        type: validated.type,
        amount: validated.amount,
        category: validated.category,
        date: validated.date,
        accountId: validated.accountId,
        toAccountId: validated.toAccountId,
      },
      ctx.ip,
      ctx.userAgent
    );

    return TransactionService.toResponseDTO(updated);
  }

  /**
   * Deletes a transaction.
   *
   * @param userId - The authenticated user's ID.
   * @param id - The transaction ID to delete.
   * @param ctx - Request context for audit logging.
   *
   * @throws {NotFoundError} If the transaction doesn't exist.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: RequestContext = {}
  ): Promise<void> {
    const deleted = await TransactionRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundError(
        'Transaction not found',
        ErrorCode.TRANSACTION_NOT_FOUND
      );
    }

    // Revert account balances
    if (deleted.accountId) {
      if (deleted.type === 'expense') {
        await AccountRepository.updateBalance(deleted.accountId, deleted.amount);
      } else if (deleted.type === 'earning') {
        await AccountRepository.updateBalance(deleted.accountId, -deleted.amount);
      } else if (deleted.type === 'transfer') {
        await AccountRepository.updateBalance(deleted.accountId, deleted.amount);
        if (deleted.toAccountId) {
          await AccountRepository.updateBalance(deleted.toAccountId, -deleted.amount);
        }
      }
    }

    AuditService.logDelete(
      userId,
      'transaction',
      id,
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

  /**
   * Checks if an expense triggers a budget alert.
   *
   * Runs after each expense creation to compare total spending
   * against the budget limit. Creates a notification if spending
   * exceeds 80% or 100% of the budget.
   *
   * @param userId - The user's ID.
   * @param category - The expense category.
   * @param date - The expense date (used to determine month/year).
   *
   * @internal
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

    // Calculate total spending for this category this month
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const totals = await TransactionRepository.getTotals(userId, startDate, endDate);
    // Get category-specific spending
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
   *
   * Strips internal fields and formats for API output.
   *
   * @param record - The raw database record.
   * @returns A clean response DTO.
   */
  private static toResponseDTO(
    record: Record<string, unknown>
  ): TransactionResponseDTO {
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
    };
  }
}
