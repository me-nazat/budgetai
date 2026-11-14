/**
 * @fileoverview Budget service — business logic for spending limits.
 *
 * @module services/budget.service
 */

import { BudgetRepository } from '@/repositories/budget.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AuditService } from '@/services/audit.service';
import { validateInput } from '@/lib/types/api';
import { CreateBudgetDTO, type BudgetResponseDTO } from '@/lib/types/dto';
import { NotFoundError, ConflictError, ErrorCode } from '@/lib/types/errors';

/**
 * BudgetService — business logic for monthly spending limits.
 */
export class BudgetService {
  /**
   * Retrieves all budgets for a user in a specific month with spending data.
   *
   * @param userId - The user's ID.
   * @param month - Month number (1–12).
   * @param year - Four-digit year.
   * @returns Array of budgets with current spending and percentage.
   */
  static async getByMonth(
    userId: number,
    month: number,
    year: number
  ): Promise<BudgetResponseDTO[]> {
    const budgets = await BudgetRepository.findByMonth(userId, month, year);

    // Calculate spending for each budget category
    const paddedMonth = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const startDate = `${year}-${paddedMonth}-01`;
    const endDate = `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`;

    const categorySpending = await TransactionRepository.getCategorySpending(
      userId,
      startDate,
      endDate
    );

    return budgets.map((budget) => {
      const catSpend = categorySpending.find((c) => c.category === budget.category);
      const spent = catSpend?.total || 0;
      return {
        id: budget.id,
        category: budget.category,
        monthlyLimit: budget.monthlyLimit,
        month: budget.month,
        year: budget.year,
        spent,
        percentage: budget.monthlyLimit > 0
          ? Math.round((spent / budget.monthlyLimit) * 100)
          : 0,
      };
    });
  }

  /**
   * Creates or updates a budget for a category/month.
   *
   * @param userId - The user's ID.
   * @param data - Raw input data.
   * @param ctx - Request context for audit.
   * @returns The created/updated budget.
   */
  static async createOrUpdate(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<BudgetResponseDTO> {
    const validated = validateInput(CreateBudgetDTO, data);

    // Check for existing budget
    const existing = await BudgetRepository.findByCategory(
      userId,
      validated.category,
      validated.month,
      validated.year
    );

    if (existing) {
      // Update existing
      const updated = await BudgetRepository.update(
        userId,
        existing.id,
        validated.monthlyLimit
      );

      AuditService.logUpdate(
        userId,
        'budget',
        existing.id,
        { monthlyLimit: existing.monthlyLimit },
        { monthlyLimit: validated.monthlyLimit },
        ctx.ip,
        ctx.userAgent
      );

      return {
        id: updated!.id,
        category: updated!.category,
        monthlyLimit: updated!.monthlyLimit,
        month: updated!.month,
        year: updated!.year,
      };
    }

    // Create new
    const created = await BudgetRepository.create({
      userId,
      ...validated,
    });

    AuditService.logCreate(
      userId,
      'budget',
      created.id,
      {
        category: validated.category,
        monthlyLimit: validated.monthlyLimit,
        month: validated.month,
        year: validated.year,
      },
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: created.id,
      category: created.category,
      monthlyLimit: created.monthlyLimit,
      month: created.month,
      year: created.year,
    };
  }

  /**
   * Deletes a budget.
   *
   * @param userId - The user's ID.
   * @param id - The budget ID.
   * @param ctx - Request context.
   *
   * @throws {NotFoundError} If the budget doesn't exist.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const deleted = await BudgetRepository.delete(userId, id);

    if (!deleted) {
      throw new NotFoundError('Budget not found', ErrorCode.BUDGET_NOT_FOUND);
    }

    AuditService.logDelete(
      userId,
      'budget',
      id,
      {
        category: deleted.category,
        monthlyLimit: deleted.monthlyLimit,
        month: deleted.month,
        year: deleted.year,
      },
      ctx.ip,
      ctx.userAgent
    );
  }
}
