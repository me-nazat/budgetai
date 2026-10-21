/**
 * @fileoverview Dashboard service — aggregates financial data for the command center.
 *
 * Implements deterministic Safe-to-Spend engine, day-of-month spending velocity pacing,
 * unified accounts & liquidity ledger, and transparent 4-pillar financial health scoring.
 *
 * @module services/dashboard.service
 */

import { AccountRepository } from '@/repositories/account.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { BudgetRepository } from '@/repositories/budget.repository';
import { RecurringRepository } from '@/repositories/recurring.repository';
import { DebtRepository } from '@/repositories/debt.repository';
import { GoalRepository } from '@/repositories/goal.repository';
import { NetWorthRepository } from '@/repositories/networth.repository';
import { getTourReceivablesAndPayables } from '@/lib/tour-sync';
import { getHouseholdReceivablesAndPayables } from '@/lib/household-sync';
import type {
  DashboardResponseDTO,
  SafeToSpendDTO,
  SpendingPaceDTO,
  AccountsSummaryDTO,
  HealthScoreDTO,
} from '@/lib/types/dto';

export class DashboardService {
  /**
   * Builds the complete unified dashboard data payload with concurrent execution.
   *
   * @param userId - Authenticated user's ID.
   * @param month - Month in YYYY-MM format (defaults to current calendar month).
   * @param week - Week filter ('all', '1', '2', '3', '4').
   */
  static async getDashboard(
    userId: number,
    month?: string,
    week: string = 'all'
  ): Promise<DashboardResponseDTO> {
    const now = new Date();
    const currentCalendarMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const selectedMonth = (month && month.match(/^\d{4}-\d{2}$/)) ? month : currentCalendarMonth;
    const [yearNum, monthNum] = selectedMonth.split('-').map(Number);

    // Calculate dates for active month
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const { startDate, endDate } = DashboardService.getDateRange(yearNum, monthNum, week);

    // Calculate dates for previous calendar month
    const prevMonthNum = monthNum === 1 ? 12 : monthNum - 1;
    const prevYearNum = monthNum === 1 ? yearNum - 1 : yearNum;
    const daysInPrevMonth = new Date(prevYearNum, prevMonthNum, 0).getDate();
    const { startDate: prevStart, endDate: prevEnd } = DashboardService.getDateRange(
      prevYearNum,
      prevMonthNum,
      week
    );

    // Day of month pacing calculation
    const isCurrentMonth = selectedMonth === currentCalendarMonth;
    const currentDayN = isCurrentMonth
      ? Math.min(now.getDate(), daysInMonth)
      : selectedMonth < currentCalendarMonth ? daysInMonth : 1;
    const daysRemaining = isCurrentMonth
      ? Math.max(1, daysInMonth - currentDayN + 1)
      : selectedMonth < currentCalendarMonth ? 1 : daysInMonth;

    const todayIso = isCurrentMonth
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      : selectedMonth < currentCalendarMonth ? endDate : startDate;

    const currentPaceEnd = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(currentDayN).padStart(2, '0')}`;
    const prevPaceDay = Math.min(currentDayN, daysInPrevMonth);
    const prevPaceEnd = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}-${String(prevPaceDay).padStart(2, '0')}`;

    // Parallel database execution — zero waterfalls
    const [
      accounts,
      currentTotals,
      prevTotals,
      currentPaceTotals,
      prevPaceTotals,
      categorySpending,
      prevCategorySpending,
      dailySpending,
      previousMonthDailySpending,
      recentTransactions,
      budgets,
      recurringTxs,
      debtsList,
      goalsList,
      latestNetWorth,
      balance,
      totalTxs,
      tourCollab,
      hhCollab,
    ] = await Promise.all([
      AccountRepository.findAllByUserId(userId, false),
      TransactionRepository.getTotals(userId, startDate, endDate),
      TransactionRepository.getTotals(userId, prevStart, prevEnd),
      TransactionRepository.getTotals(userId, startDate, currentPaceEnd),
      TransactionRepository.getTotals(userId, prevStart, prevPaceEnd),
      TransactionRepository.getCategorySpending(userId, startDate, endDate),
      TransactionRepository.getCategorySpending(userId, prevStart, prevEnd),
      TransactionRepository.getDailySpending(userId, startDate, endDate),
      TransactionRepository.getDailySpending(userId, prevStart, prevEnd),
      TransactionRepository.findAll(userId, {
        start: startDate,
        end: endDate,
        limit: 10,
      }),
      BudgetRepository.findByMonth(userId, monthNum, yearNum),
      RecurringRepository.findAll(userId),
      DebtRepository.findAllByUserId(userId),
      GoalRepository.findAll(userId),
      NetWorthRepository.findLatest(userId),
      TransactionRepository.getBalance(userId),
      TransactionRepository.count(userId),
      getTourReceivablesAndPayables(userId).catch(() => ({ receivables: 0, payables: 0 })),
      getHouseholdReceivablesAndPayables(userId).catch(() => ({ receivables: 0, payables: 0 })),
    ]);

    const netCollaborativeReceivables = Math.round(((tourCollab?.receivables || 0) + (hhCollab?.receivables || 0)) * 100) / 100;
    const netCollaborativePayables = Math.round(((tourCollab?.payables || 0) + (hhCollab?.payables || 0)) * 100) / 100;

    // ────────────────────────────────────────────────────────────
    // 1. DETERMINISTIC SAFE-TO-SPEND ENGINE
    // ────────────────────────────────────────────────────────────
    // 1.1 Liquid Cash
    const accountsLiquidCash = accounts
      .filter((a) => {
        if (a.isArchived) return false;
        const type = (a.type || '').toLowerCase();
        const name = (a.name || '').toLowerCase();
        if (type === 'card' || name.includes('credit') || name.includes('loan')) return false;
        return ['cash', 'bank', 'mobile_wallet', 'wallet', 'checking', 'savings'].includes(type) || type !== 'other';
      })
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
    const liquidCash = accounts.length > 0 ? accountsLiquidCash : Math.max(0, balance);

    // 1.2 Credit Card Current Balances Due
    const creditCardCurrentBalance = accounts
      .filter((a) => {
        if (a.isArchived) return false;
        const type = (a.type || '').toLowerCase();
        const name = (a.name || '').toLowerCase();
        return type === 'card' || name.includes('card') || name.includes('credit');
      })
      .reduce((sum, a) => sum + (a.currentBalance > 0 ? a.currentBalance : Math.abs(a.currentBalance)), 0);

    // 1.3 Upcoming Committed Bills (scheduled between today and month end)
    const upcomingCommittedBills = recurringTxs
      .filter((r) => {
        if (r.active !== 1 || r.type !== 'expense') return false;
        return r.nextDate >= todayIso && r.nextDate <= endDate;
      })
      .reduce((sum, r) => sum + r.amount, 0);

    // 1.4 Remaining Budget & Goal Reservations
    const unspentBudgets = budgets.reduce((sum, b) => {
      const catSpend = categorySpending.find(
        (c) => c.category.toLowerCase() === b.category.toLowerCase()
      );
      const spent = catSpend?.total || 0;
      return sum + Math.max(0, b.monthlyLimit - spent);
    }, 0);

    const pendingGoalContributions = goalsList.reduce((sum, g) => {
      const remaining = Math.max(0, g.targetAmount - g.savedAmount);
      if (remaining <= 0) return sum;
      if (g.deadline) {
        const deadlineDate = new Date(g.deadline);
        const months = Math.max(
          1,
          (deadlineDate.getFullYear() - yearNum) * 12 + (deadlineDate.getMonth() + 1 - monthNum)
        );
        return sum + remaining / months;
      }
      return sum + Math.min(remaining, remaining * 0.1);
    }, 0);

    const remainingBudgetReservations = Math.round(unspentBudgets + pendingGoalContributions);

    // 1.5 Safe-to-Spend Total & Daily Allowance (incorporating pending collaborative payables)
    const safeToSpendTotal = Math.max(
      0,
      liquidCash - upcomingCommittedBills - remainingBudgetReservations - creditCardCurrentBalance - netCollaborativePayables
    );
    const dailySafeAllowance = Math.round((safeToSpendTotal / daysRemaining) * 100) / 100;

    const safeToSpend: SafeToSpendDTO = {
      safeToSpendTotal,
      dailySafeAllowance,
      daysRemaining,
      liquidCash,
      upcomingCommittedBills,
      remainingBudgetReservations,
      creditCardCurrentBalance,
    };

    // ────────────────────────────────────────────────────────────
    // 2. DAY-OF-MONTH SPENDING PACE (VELOCITY COMPARISON)
    // ────────────────────────────────────────────────────────────
    const currentMonthSpendToDate = currentPaceTotals.expenses;
    const previousMonthSpendSameDay = prevPaceTotals.expenses;
    const paceDeltaPercent = previousMonthSpendSameDay > 0
      ? Math.round(((currentMonthSpendToDate - previousMonthSpendSameDay) / previousMonthSpendSameDay) * 1000) / 10
      : 0;

    const dailyBurnRate = currentDayN > 0 ? currentMonthSpendToDate / currentDayN : 0;
    const projectedMonthEndSpend = Math.round(
      currentMonthSpendToDate + dailyBurnRate * Math.max(0, daysInMonth - currentDayN)
    );

    const totalBudgetLimit = budgets.reduce((sum, b) => sum + (b.monthlyLimit || 0), 0);
    const monthElapsedPercent = Math.round((currentDayN / daysInMonth) * 1000) / 10;
    const budgetConsumedPercent = totalBudgetLimit > 0
      ? Math.round((currentMonthSpendToDate / totalBudgetLimit) * 1000) / 10
      : 0;

    const spendingPace: SpendingPaceDTO = {
      currentMonthSpendToDate,
      previousMonthSpendSameDay,
      paceDeltaPercent,
      projectedMonthEndSpend,
      dayOfMonth: currentDayN,
      daysInMonth,
      monthElapsedPercent,
      budgetConsumedPercent,
    };

    // ────────────────────────────────────────────────────────────
    // 3. ACCOUNTS & LIQUIDITY SUMMARY
    // ────────────────────────────────────────────────────────────
    const accountsAssets = accounts
      .filter((a) => !a.isArchived && a.type !== 'card')
      .reduce((sum, a) => sum + Math.max(0, a.currentBalance), 0);
    const totalAssets = Math.round(
      ((accounts.length > 0 ? accountsAssets : Math.max(0, balance)) + netCollaborativeReceivables) * 100
    ) / 100;

    const totalDebtAmount = debtsList.reduce((sum, d) => sum + (d.balance || 0), 0);
    const totalLiabilities = Math.round((creditCardCurrentBalance + totalDebtAmount + netCollaborativePayables) * 100) / 100;
    const computedNetWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;
    const assetToLiabilityRatio = totalLiabilities > 0
      ? Math.round((totalAssets / totalLiabilities) * 10) / 10
      : totalAssets > 0 ? 100 : 1;

    const liquidRatio = totalAssets > 0 ? Math.round((liquidCash / totalAssets) * 100) : 0;

    const accountsSummary: AccountsSummaryDTO = {
      totalAssets,
      totalLiabilities,
      netWorth: computedNetWorth !== 0 ? computedNetWorth : (latestNetWorth?.amount ?? balance),
      assetToLiabilityRatio,
      liquidCash,
      liquidRatio,
      accounts: accounts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        currentBalance: a.currentBalance,
        balance: a.currentBalance,
        isLiability: a.type === 'card',
        colorTag: a.colorTag,
        isArchived: a.isArchived,
      })),
    };

    // ────────────────────────────────────────────────────────────
    // 4. FINANCIAL HEALTH SCORE (4 TRANSPARENT PILLARS, 25 PTS EACH)
    // ────────────────────────────────────────────────────────────
    const healthScore = DashboardService.computeHealthScore({
      earnings: currentTotals.earnings,
      expenses: currentTotals.expenses,
      budgets,
      categorySpending,
      liquidCash,
      totalLiabilities,
    });

    // ────────────────────────────────────────────────────────────
    // 5. BUDGET ALERTS & PERIOD CHANGES
    // ────────────────────────────────────────────────────────────
    const budgetAlerts = budgets
      .map((budget) => {
        const catSpend = categorySpending.find(
          (c) => c.category.toLowerCase() === budget.category.toLowerCase()
        );
        const spent = catSpend?.total || 0;
        const pct = budget.monthlyLimit > 0 ? (spent / budget.monthlyLimit) * 100 : 0;
        return {
          category: budget.category,
          limit: budget.monthlyLimit,
          spent,
          percentage: Math.round(pct),
        };
      })
      .sort((a, b) => b.percentage - a.percentage);

    const expenseChange = prevTotals.expenses > 0
      ? ((currentTotals.expenses - prevTotals.expenses) / prevTotals.expenses) * 100
      : 0;
    const earningChange = prevTotals.earnings > 0
      ? ((currentTotals.earnings - prevTotals.earnings) / prevTotals.earnings) * 100
      : 0;

    const prevCategoryMap = new Map<string, number>();
    prevCategorySpending.forEach((c) => prevCategoryMap.set(c.category.toLowerCase(), c.total));

    const totalExpenseAmount = currentTotals.expenses;
    const enrichedCategorySpending = categorySpending.map((c) => {
      const prevSpent = prevCategoryMap.get(c.category.toLowerCase()) || 0;
      const delta = prevSpent > 0
        ? Math.round(((c.total - prevSpent) / prevSpent) * 1000) / 10
        : (c.total > 0 ? 100 : 0);
      const percentage = totalExpenseAmount > 0
        ? Math.round((c.total / totalExpenseAmount) * 1000) / 10
        : 0;
      return {
        category: c.category,
        total: c.total,
        amount: c.total,
        percentage,
        delta,
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
      categorySpending: enrichedCategorySpending,
      dailySpending,
      previousMonthDailySpending,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description || '',
        date: t.date,
        createdAt: t.createdAt ?? undefined,
      })),
      budgetAlerts,
      netWorth: computedNetWorth !== 0 ? computedNetWorth : (latestNetWorth?.amount ?? balance),
      safeToSpend,
      spendingPace,
      accountsSummary,
      healthScore,
      totalTransactions: totalTxs || 0,
      netCollaborativeReceivables,
      netCollaborativePayables,
    };
  }

  /**
   * Deterministic 4-pillar Financial Health Score calculator (25 points each = 100 total).
   */
  static computeHealthScore(params: {
    earnings: number;
    expenses: number;
    budgets: Array<{ category: string; monthlyLimit: number }>;
    categorySpending: Array<{ category: string; total: number }>;
    liquidCash: number;
    totalLiabilities: number;
  }): HealthScoreDTO {
    const { earnings, expenses, budgets, categorySpending, liquidCash, totalLiabilities } = params;

    // Pillar 1: Savings Rate (25 pts) — Full at >= 20%, linear down to 0 at <= 0%
    const savings = earnings - expenses;
    const savingsRate = earnings > 0 ? savings / earnings : 0;
    let savingsRateScore = 0;
    let savingsAction = '';

    if (savingsRate >= 0.2) {
      savingsRateScore = 25;
      savingsAction = `Optimal savings rate of ${Math.round(savingsRate * 100)}% maintains full score`;
    } else if (savingsRate > 0) {
      savingsRateScore = Math.round((savingsRate / 0.2) * 25);
      const needed = Math.round(earnings * 0.2 - savings);
      savingsAction = `Save ${needed > 0 ? needed : 500} more to hit the 20% savings threshold (+${25 - savingsRateScore} pts)`;
    } else {
      savingsRateScore = 0;
      savingsAction = `Expenses exceed income by ${Math.abs(savings)}. Cut non-essentials to restore savings (+25 pts)`;
    }

    // Pillar 2: Budget Adherence (25 pts) — Based on % of envelopes within limits
    let budgetScore = 25;
    let budgetAction = '';
    if (budgets.length > 0) {
      const kept = budgets.filter((b) => {
        const spent = categorySpending.find(
          (c) => c.category.toLowerCase() === b.category.toLowerCase()
        )?.total || 0;
        return spent <= b.monthlyLimit;
      }).length;
      budgetScore = Math.round((kept / budgets.length) * 25);
      const over = budgets.find((b) => {
        const spent = categorySpending.find(
          (c) => c.category.toLowerCase() === b.category.toLowerCase()
        )?.total || 0;
        return spent > b.monthlyLimit;
      });
      if (over) {
        const overSpent = categorySpending.find(
          (c) => c.category.toLowerCase() === over.category.toLowerCase()
        )?.total || 0;
        budgetAction = `Reduce ${over.category} by ${Math.round(overSpent - over.monthlyLimit)} to recover adherence (+${25 - budgetScore} pts)`;
      } else {
        budgetAction = 'All active budget envelopes are strictly on track (+25 pts)';
      }
    } else {
      budgetScore = 22;
      budgetAction = 'Set up category budgets to safeguard your spending limits (+3 pts)';
    }

    // Pillar 3: Emergency Runway (25 pts) — Full at >= 6 months, down to 0 at < 0.5 months
    const monthlyBurn = expenses > 0 ? expenses : earnings > 0 ? earnings * 0.7 : 1000;
    const runwayMonths = Math.round((liquidCash / monthlyBurn) * 10) / 10;
    let runwayScore = 0;
    let runwayAction = '';

    if (runwayMonths >= 6) {
      runwayScore = 25;
      runwayAction = `Excellent buffer: ${runwayMonths} months of liquid runway secured`;
    } else if (runwayMonths < 0.5) {
      runwayScore = 0;
      runwayAction = 'Runway under 2 weeks. Build emergency cash reserves immediately (+25 pts)';
    } else {
      runwayScore = Math.min(25, Math.round(((runwayMonths - 0.5) / 5.5) * 25));
      runwayAction = `Runway is ${runwayMonths} months. Add ${Math.round(monthlyBurn * (6 - runwayMonths))} to reach 6-month safety (+${25 - runwayScore} pts)`;
    }

    // Pillar 4: Debt & Utilization Load (25 pts) — Full when liabilities are 0
    let debtScore = 25;
    let debtAction = '';
    if (totalLiabilities <= 0) {
      debtScore = 25;
      debtAction = 'Zero debt load maintains maximum credit and stability rating (+25 pts)';
    } else {
      const debtRatio = earnings > 0 ? totalLiabilities / (earnings * 6) : 1;
      debtScore = Math.max(0, Math.min(25, Math.round(25 * (1 - Math.min(1, debtRatio)))));
      if (debtScore >= 20) {
        debtAction = 'Debt load is low and well within manageable limits';
      } else {
        debtAction = `Pay down ${Math.round(totalLiabilities * 0.25)} in card/loan balances to lower debt load (+${25 - debtScore} pts)`;
      }
    }

    const totalScore = Math.max(0, Math.min(100, savingsRateScore + budgetScore + runwayScore + debtScore));
    const grade = totalScore >= 80 ? 'Excellent' : totalScore >= 65 ? 'Good' : totalScore >= 45 ? 'Fair' : 'Needs Work';

    return {
      score: totalScore,
      grade,
      pillars: {
        savingsRate: { score: savingsRateScore, max: 25, action: savingsAction },
        budgetAdherence: { score: budgetScore, max: 25, action: budgetAction },
        emergencyRunway: { score: runwayScore, max: 25, action: runwayAction },
        debtLoad: { score: debtScore, max: 25, action: debtAction },
      },
      breakdown: {
        savingsRate: { score: savingsRateScore, max: 25, action: savingsAction },
        budgetAdherence: { score: budgetScore, max: 25, action: budgetAction },
        emergencyRunway: { score: runwayScore, max: 25, action: runwayAction },
        debtLoad: { score: debtScore, max: 25, action: debtAction },
        netWorth: { score: Math.round(totalScore * 0.2), max: 20 },
        emergencyFund: { score: runwayScore, max: 20 },
        consistency: { score: 10, max: 10 },
      },
    };
  }

  /**
   * Helper to retrieve standalone health score with historical trends.
   */
  static async getHealthScore(userId: number, month?: string): Promise<HealthScoreDTO> {
    const dashboard = await DashboardService.getDashboard(userId, month, 'all');
    return dashboard.healthScore || DashboardService.computeHealthScore({
      earnings: dashboard.earnings.current,
      expenses: dashboard.expenses.current,
      budgets: dashboard.budgetAlerts.map((b) => ({ category: b.category, monthlyLimit: b.limit })),
      categorySpending: dashboard.categorySpending,
      liquidCash: dashboard.safeToSpend?.liquidCash || 0,
      totalLiabilities: dashboard.accountsSummary?.totalLiabilities || 0,
    });
  }

  /**
   * Calculates the start and end dates for a dashboard period.
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
