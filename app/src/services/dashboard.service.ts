/**
 * @fileoverview Dashboard service — aggregates data for the main dashboard view.
 *
 * Combines data from multiple repositories to produce the complete
 * dashboard response including expense/earning totals, category breakdowns,
 * daily spending charts, budget alerts, and net worth.
 *
 * @module services/dashboard.service
 */

import { TransactionRepository } from '@/repositories/transaction.repository';
import { BudgetRepository } from '@/repositories/budget.repository';
import { NetWorthRepository } from '@/repositories/networth.repository';
import type { DashboardResponseDTO } from '@/lib/types/dto';

/**
 * DashboardService — aggregates financial data for the main dashboard.
 */
export class DashboardService {
  /**
   * Builds the complete dashboard data payload.
   *
   * @param userId - The authenticated user's ID.
   * @param month - Month in YYYY-MM format.
   * @param week - Week filter ('all', '1', '2', '3', '4').
   * @returns Complete dashboard data for rendering.
   *
   * @complexity O(k) where k is the total number of transactions in the period.
   */
  static async getDashboard(
    userId: number,
    month: string,
    week: string = 'all'
  ): Promise<DashboardResponseDTO> {
    const [yearStr, monthStr] = month.split('-');
    const yearNum = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);

    // Calculate date range
    const { startDate, endDate } = DashboardService.getDateRange(
      yearNum,
      monthNum,
      week
    );

    // Calculate previous period for comparison
    const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
    const prevYear = monthNum === 1 ? yearNum - 1 : yearNum;
    const { startDate: prevStart, endDate: prevEnd } = DashboardService.getDateRange(
      prevYear,
      prevMonth,
      week
    );

    // Parallel data fetching
    const [
      currentTotals,
      prevTotals,
      categorySpending,
      dailySpending,
      recentTransactions,
      budgets,
      latestNetWorth,
      balance,
    ] = await Promise.all([
      TransactionRepository.getTotals(userId, startDate, endDate),
      TransactionRepository.getTotals(userId, prevStart, prevEnd),
      TransactionRepository.getCategorySpending(userId, startDate, endDate),
      TransactionRepository.getDailySpending(userId, startDate, endDate),
      TransactionRepository.findAll(userId, {
        start: startDate,
        end: endDate,
        limit: 10,
      }),
      BudgetRepository.findByMonth(userId, monthNum, yearNum),
      NetWorthRepository.findLatest(userId),
      TransactionRepository.getBalance(userId),
    ]);

    // Calculate changes
    const expenseChange = prevTotals.expenses > 0
      ? ((currentTotals.expenses - prevTotals.expenses) / prevTotals.expenses) * 100
      : 0;
    const earningChange = prevTotals.earnings > 0
      ? ((currentTotals.earnings - prevTotals.earnings) / prevTotals.earnings) * 100
      : 0;

    // Build budget alerts
    const budgetAlerts = budgets.map((budget) => {
      const catSpend = categorySpending.find(
        (c) => c.category === budget.category
      );
      const spent = catSpend?.total || 0;
      return {
        category: budget.category,
        limit: budget.monthlyLimit,
        spent,
        percentage: budget.monthlyLimit > 0
          ? Math.round((spent / budget.monthlyLimit) * 100)
          : 0,
      };
    });

    return {
      expenses: {
        current: currentTotals.expenses,
        change: Math.round(expenseChange * 10) / 10,
      },
      earnings: {
        current: currentTotals.earnings,
        change: Math.round(earningChange * 10) / 10,
      },
      netSavings: currentTotals.earnings - currentTotals.expenses,
      balance,
      categorySpending,
      dailySpending,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description || '',
        date: t.date,
        createdAt: t.createdAt,
      })),
      budgetAlerts,
      netWorth: latestNetWorth?.amount ?? 0,
    };
  }

  /**
   * Calculates the start and end dates for a dashboard period.
   *
   * @param year - Four-digit year.
   * @param month - Month number (1–12).
   * @param week - Week filter ('all', '1', '2', '3', '4').
   * @returns Start and end date strings in YYYY-MM-DD format.
   *
   * @internal
   */
  private static getDateRange(
    year: number,
    month: number,
    week: string
  ): { startDate: string; endDate: string } {
    const paddedMonth = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();

    if (week === 'all' || !['1', '2', '3', '4'].includes(week)) {
      return {
        startDate: `${year}-${paddedMonth}-01`,
        endDate: `${year}-${paddedMonth}-${String(lastDay).padStart(2, '0')}`,
      };
    }

    const weekNum = parseInt(week, 10);
    const weekStart = (weekNum - 1) * 7 + 1;
    const weekEnd = Math.min(weekNum * 7, lastDay);

    return {
      startDate: `${year}-${paddedMonth}-${String(weekStart).padStart(2, '0')}`,
      endDate: `${year}-${paddedMonth}-${String(weekEnd).padStart(2, '0')}`,
    };
  }
}
