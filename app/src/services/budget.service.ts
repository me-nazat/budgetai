/**
 * @fileoverview Budget service — business logic for spending limits.
 *
 * @module services/budget.service
 */

import { BudgetRepository } from '@/repositories/budget.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AuditService } from '@/services/audit.service';
import { validateInput } from '@/lib/types/api';
import { CreateBudgetDTO, RebalanceBudgetsDTO, type BudgetResponseDTO } from '@/lib/types/dto';
import { NotFoundError, ConflictError, ErrorCode } from '@/lib/types/errors';
import { getUnsettledTourPayablesForUser } from '@/lib/tour-sync';

/**
 * BudgetService — business logic for monthly spending limits, envelope rollover, and auto-pacing.
 */
export class BudgetService {
  /**
   * Retrieves all budgets for a user in a specific month with spending, rollover, and pacing metrics.
   *
   * @param userId - The user's ID.
   * @param month - Month number (1–12).
   * @param year - Four-digit year.
   * @returns Array of budgets with current spending, rollover balance, and pacing metrics.
   */
  static async getByMonth(
    userId: number,
    month: number,
    year: number
  ): Promise<BudgetResponseDTO[]> {
    const budgets = await BudgetRepository.findByMonth(userId, month, year);

    // Calculate spending for each budget category
    const paddedMonth = String(month).padStart(2, '0');
    const daysInMonth = new Date(year, month, 0).getDate();
    const startDate = `${year}-${paddedMonth}-01`;
    const endDate = `${year}-${paddedMonth}-${String(daysInMonth).padStart(2, '0')}`;

    const rawCategorySpending = await TransactionRepository.getCategorySpending(
      userId,
      startDate,
      endDate
    );

    // Merge active tour payables so group expenses paid by friends count toward user's category budget
    const tourPayables = await getUnsettledTourPayablesForUser(userId, startDate, endDate).catch(() => []);
    const categorySpending = rawCategorySpending.map((c) => ({ ...c }));
    for (const tp of tourPayables) {
      const existing = categorySpending.find(
        (c) => c.category.toLowerCase() === tp.category.toLowerCase()
      );
      if (existing) {
        existing.total = Math.round((existing.total + tp.amount) * 100) / 100;
      } else {
        categorySpending.push({ category: tp.category, total: Math.round(tp.amount * 100) / 100 });
      }
    }

    // Timeline position for pacing calculation
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() + 1 === month;
    const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && now.getMonth() + 1 > month);
    const currentDay = isCurrentMonth
      ? Math.max(1, Math.min(now.getDate(), daysInMonth))
      : isPastMonth
      ? daysInMonth
      : 1;

    const daysRemaining = Math.max(0, daysInMonth - currentDay);

    // If any budget has rollover enabled, inspect previous month to compute rollover carry-overs
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    let prevBudgets: any[] = [];
    let prevSpending: any[] = [];

    const hasRolloverBudgets = budgets.some((b) => b.rolloverEnabled);
    if (hasRolloverBudgets) {
      const prevPadded = String(prevMonth).padStart(2, '0');
      const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
      const prevStart = `${prevYear}-${prevPadded}-01`;
      const prevEnd = `${prevYear}-${prevPadded}-${String(prevLastDay).padStart(2, '0')}`;
      [prevBudgets, prevSpending] = await Promise.all([
        BudgetRepository.findByMonth(userId, prevMonth, prevYear),
        TransactionRepository.getCategorySpending(userId, prevStart, prevEnd),
      ]);
    }

    return await Promise.all(
      budgets.map(async (budget) => {
        let rolloverBalance = Number(budget.rolloverBalance) || 0;

        // Auto-compute rollover if enabled and previous month exists
        if (budget.rolloverEnabled && prevBudgets.length > 0) {
          const prevB = prevBudgets.find((p) => p.category.toLowerCase() === budget.category.toLowerCase());
          if (prevB) {
            const prevSpent =
              prevSpending.find((s) => s.category.toLowerCase() === budget.category.toLowerCase())?.total || 0;
            const prevEffective = Number(prevB.monthlyLimit) + (Number(prevB.rolloverBalance) || 0);
            const calculatedSurplus = Math.max(0, prevEffective - prevSpent);

            if (calculatedSurplus !== rolloverBalance) {
              rolloverBalance = calculatedSurplus;
              await BudgetRepository.update(userId, budget.id, { rolloverBalance: calculatedSurplus }).catch(() => {});
            }
          }
        }

        const catSpend = categorySpending.find(
          (c) => c.category.toLowerCase() === budget.category.toLowerCase()
        );
        const spent = catSpend?.total || 0;
        const effectiveLimit = budget.monthlyLimit + rolloverBalance;
        const remaining = Math.max(0, effectiveLimit - spent);
        const percentage = effectiveLimit > 0 ? Math.round((spent / effectiveLimit) * 100) : 0;

        // Auto-pacing burn rate calculations
        const idealDailyBurn = Math.round((effectiveLimit / daysInMonth) * 100) / 100;
        const actualDailyBurn = Math.round((spent / currentDay) * 100) / 100;
        const projectedMonthEndSpend = Math.round(actualDailyBurn * daysInMonth);

        let pacingStatus: 'on_track' | 'pacing_fast' | 'exhausted' = 'on_track';
        if (spent >= effectiveLimit) {
          pacingStatus = 'exhausted';
        } else if (actualDailyBurn > idealDailyBurn * 1.15) {
          pacingStatus = 'pacing_fast';
        }

        const pacingDeltaPercent =
          idealDailyBurn > 0
            ? Math.round(((actualDailyBurn - idealDailyBurn) / idealDailyBurn) * 100)
            : 0;

        return {
          id: budget.id,
          category: budget.category,
          monthlyLimit: budget.monthlyLimit,
          month: budget.month,
          year: budget.year,
          spent,
          percentage,
          rolloverEnabled: Boolean(budget.rolloverEnabled),
          rolloverBalance,
          effectiveLimit,
          remaining,
          idealDailyBurn,
          actualDailyBurn,
          pacingStatus,
          pacingDeltaPercent,
          projectedMonthEndSpend,
          daysRemaining,
        };
      })
    );
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
        {
          monthlyLimit: validated.monthlyLimit,
          rolloverEnabled: validated.rolloverEnabled,
          rolloverBalance: validated.rolloverBalance,
        }
      );

      AuditService.logUpdate(
        userId,
        'budget',
        existing.id,
        { monthlyLimit: existing.monthlyLimit },
        { monthlyLimit: validated.monthlyLimit, rolloverEnabled: validated.rolloverEnabled },
        ctx.ip,
        ctx.userAgent
      );

      return {
        id: updated!.id,
        category: updated!.category,
        monthlyLimit: updated!.monthlyLimit,
        month: updated!.month,
        year: updated!.year,
        rolloverEnabled: Boolean(updated!.rolloverEnabled),
        rolloverBalance: Number(updated!.rolloverBalance) || 0,
        effectiveLimit: updated!.monthlyLimit + (Number(updated!.rolloverBalance) || 0),
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
        rolloverEnabled: validated.rolloverEnabled,
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
      rolloverEnabled: Boolean(created.rolloverEnabled),
      rolloverBalance: Number(created.rolloverBalance) || 0,
      effectiveLimit: created.monthlyLimit + (Number(created.rolloverBalance) || 0),
    };
  }

  /**
   * Rebalances funds between two envelopes without altering total monthly income or allocated budget.
   */
  static async rebalance(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<{ from: BudgetResponseDTO; to: BudgetResponseDTO }> {
    const validated = validateInput(RebalanceBudgetsDTO, data);

    const { from, to } = await BudgetRepository.rebalance(
      userId,
      validated.fromBudgetId,
      validated.toBudgetId,
      validated.amount
    );

    AuditService.logUpdate(
      userId,
      'budget',
      from.id,
      { action: 'rebalance_transfer_out', amount: validated.amount },
      { monthlyLimit: from.monthlyLimit },
      ctx.ip,
      ctx.userAgent
    );

    AuditService.logUpdate(
      userId,
      'budget',
      to.id,
      { action: 'rebalance_transfer_in', amount: validated.amount },
      { monthlyLimit: to.monthlyLimit },
      ctx.ip,
      ctx.userAgent
    );

    return {
      from: {
        id: from.id,
        category: from.category,
        monthlyLimit: from.monthlyLimit,
        month: from.month,
        year: from.year,
        rolloverEnabled: Boolean(from.rolloverEnabled),
        rolloverBalance: Number(from.rolloverBalance) || 0,
      },
      to: {
        id: to.id,
        category: to.category,
        monthlyLimit: to.monthlyLimit,
        month: to.month,
        year: to.year,
        rolloverEnabled: Boolean(to.rolloverEnabled),
        rolloverBalance: Number(to.rolloverBalance) || 0,
      },
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
