/**
 * @fileoverview Insight Service — Unified financial intelligence engine.
 *
 * Consolidates insight signals from spending trends, budget velocity,
 * savings rate, debt payoff, and benchmark percentiles into a single source of truth.
 *
 * @module services/insight.service
 */

import { db } from '@/db/client';
import { transactions, budgets, savingsGoals, debts } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface ConsolidatedInsight {
  id: string;
  type: 'warning' | 'tip' | 'milestone' | 'benchmark';
  title: string;
  description: string;
  category?: string;
  actionUrl?: string;
  scoreImpact?: number;
}

export class InsightService {
  /**
   * Generates a consolidated list of actionable insights for the user.
   */
  static async generateConsolidatedInsights(userId: number): Promise<ConsolidatedInsight[]> {
    const insights: ConsolidatedInsight[] = [];
    const now = new Date();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const currentYearStr = String(now.getFullYear());

    // 1. Check budget overspending
    const userBudgets = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.month, now.getMonth() + 1), eq(budgets.year, now.getFullYear())));

    for (const b of userBudgets) {
      const [spending] = await db
        .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            eq(transactions.type, 'expense'),
            eq(transactions.category, b.category)
          )
        );

      const totalSpent = spending?.total || 0;
      if (b.monthlyLimit > 0 && totalSpent > b.monthlyLimit) {
        insights.push({
          id: `budget_over_${b.category}`,
          type: 'warning',
          title: `Over Budget: ${b.category}`,
          description: `You've spent $${totalSpent.toFixed(0)} against a $${b.monthlyLimit.toFixed(0)} limit in ${b.category}.`,
          category: b.category,
          actionUrl: '/budgets',
          scoreImpact: -5,
        });
      }
    }

    // 2. Check active debt payoff momentum
    const userDebts = await db
      .select()
      .from(debts)
      .where(and(eq(debts.userId, userId), sql`${debts.balance} > 0`));

    if (userDebts.length > 0) {
      const highestRateDebt = [...userDebts].sort((a, b) => b.interestRateApr - a.interestRateApr)[0];
      insights.push({
        id: `debt_avalanche_${highestRateDebt.id}`,
        type: 'tip',
        title: `Avalanche Payoff Focus: ${highestRateDebt.name}`,
        description: `Focus extra payments on "${highestRateDebt.name}" (${highestRateDebt.interestRateApr}% APR) to minimize overall interest.`,
        actionUrl: '/debts',
        scoreImpact: 3,
      });
    }

    // 3. Savings goals milestone check
    const goals = await db
      .select()
      .from(savingsGoals)
      .where(eq(savingsGoals.userId, userId));

    for (const g of goals) {
      if (g.targetAmount > 0) {
        const pct = (g.savedAmount / g.targetAmount) * 100;
        if (pct >= 80 && pct < 100) {
          insights.push({
            id: `goal_near_${g.id}`,
            type: 'milestone',
            title: `Almost There: ${g.name}`,
            description: `You're ${pct.toFixed(0)}% of the way to reaching your "${g.name}" goal!`,
            actionUrl: '/wealth-goals',
            scoreImpact: 5,
          });
        }
      }
    }

    return insights;
  }
}
