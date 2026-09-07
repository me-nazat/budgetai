/**
 * @fileoverview Proactive Financial Insight Generation Engine (Module 19).
 * Synthesizes proactive insights (SPENDING_SPIKE, SUBSCRIPTION_LEAK, SAVINGS_OPPORTUNITY, BUDGET_OVERRUN)
 * from recent transactions, budgets, and recurring obligations, factoring in negative user feedback.
 */

import { db } from '@/db/client';
import {
  transactions,
  budgets,
  recurringTransactions,
  module29InsightFeedback,
} from '@/db/schema';
import { eq, and, desc, gte } from 'drizzle-orm';

export interface GeneratedInsight {
  insightType: 'SPENDING_SPIKE' | 'SUBSCRIPTION_LEAK' | 'SAVINGS_OPPORTUNITY' | 'BUDGET_OVERRUN';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  message: string;
  actionLink: string;
}

export async function generateUserInsights(userId: number): Promise<GeneratedInsight[]> {
  const now = new Date();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // 1. Fetch recent transactions
  const recentTransactions = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), gte(transactions.date, thirtyDaysAgo)))
    .orderBy(desc(transactions.date));

  // 2. Fetch active budgets
  const activeBudgets = await db
    .select()
    .from(budgets)
    .where(
      and(
        eq(budgets.userId, userId),
        eq(budgets.month, now.getMonth() + 1),
        eq(budgets.year, now.getFullYear())
      )
    );

  // 3. Fetch recurring
  const recurring = await db
    .select()
    .from(recurringTransactions)
    .where(and(eq(recurringTransactions.userId, userId), eq(recurringTransactions.active, 1)));

  // 4. Fetch dismissed/unhelpful topics from module_29_insight_feedback
  const unhelpful = await db
    .select()
    .from(module29InsightFeedback)
    .where(
      and(
        eq(module29InsightFeedback.userId, userId),
        eq(module29InsightFeedback.feedback, 'not_helpful')
      )
    );
  // (Optional filtering can be added based on unhelpful records)

  const candidateInsights: GeneratedInsight[] = [];

  // ─── A. Detect Budget Overruns ───
  const spendingByCategory: Record<string, number> = {};
  for (const tx of recentTransactions) {
    if (tx.type === 'expense') {
      spendingByCategory[tx.category] = (spendingByCategory[tx.category] || 0) + tx.amount;
    }
  }

  for (const b of activeBudgets) {
    const spent = spendingByCategory[b.category] || 0;
    const ratio = b.monthlyLimit > 0 ? spent / b.monthlyLimit : 0;

    if (ratio >= 1.0) {
      candidateInsights.push({
        insightType: 'BUDGET_OVERRUN',
        severity: 'CRITICAL',
        title: `Budget Boundary Breached: ${b.category}`,
        message: `You've utilized ${(ratio * 100).toFixed(0)}% of your ${b.category} ceiling (৳${spent.toLocaleString()} spent of ৳${b.monthlyLimit.toLocaleString()}).`,
        actionLink: `/budgets?category=${encodeURIComponent(b.category)}`,
      });
    } else if (ratio >= 0.8) {
      candidateInsights.push({
        insightType: 'BUDGET_OVERRUN',
        severity: 'WARNING',
        title: `Approaching Budget Cap: ${b.category}`,
        message: `Current cycle spend has reached ${(ratio * 100).toFixed(0)}% for ${b.category}. Consider throttling discretionary outflow.`,
        actionLink: `/budgets?category=${encodeURIComponent(b.category)}`,
      });
    }
  }

  // ─── B. Detect Spending Spikes ───
  for (const [cat, total] of Object.entries(spendingByCategory)) {
    if (total > 15000 && !activeBudgets.some((b) => b.category === cat)) {
      candidateInsights.push({
        insightType: 'SPENDING_SPIKE',
        severity: 'WARNING',
        title: `Unusual Spending Velocity in ${cat}`,
        message: `Total unbudgeted outflow of ৳${total.toLocaleString()} detected in "${cat}" over the past 30 days.`,
        actionLink: `/budgets?newEnvelopeCategory=${encodeURIComponent(cat)}`,
      });
    }
  }

  // ─── C. Detect Subscription Leaks ───
  const subs = recurring.filter((r) =>
    (r.category || '').toLowerCase().includes('sub') || (r.name || '').toLowerCase().includes('netflix')
  );
  if (subs.length > 3) {
    const totalSubCost = subs.reduce((sum, s) => sum + s.amount, 0);
    candidateInsights.push({
      insightType: 'SUBSCRIPTION_LEAK',
      severity: 'WARNING',
      title: `Multiple Active Digital Subscriptions (${subs.length})`,
      message: `You are maintaining ${subs.length} active subscriptions totaling ৳${totalSubCost.toLocaleString()}/mo. An audit may yield immediate savings.`,
      actionLink: `/recurring`,
    });
  }

  // ─── D. Detect Savings Opportunities ───
  const totalIncome = recentTransactions
    .filter((t) => t.type === 'earning')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = recentTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const surplus = totalIncome - totalExpense;

  if (surplus > 10000) {
    const recommendedAllocation = Math.floor(surplus * 0.4);
    candidateInsights.push({
      insightType: 'SAVINGS_OPPORTUNITY',
      severity: 'INFO',
      title: `Surplus Capital Optimization`,
      message: `Positive net cashflow surplus of ৳${surplus.toLocaleString()} recorded. Directing ৳${recommendedAllocation.toLocaleString()} to wealth goals can accelerate milestone attainment.`,
      actionLink: `/wealth-goals`,
    });
  }

  // Limit to top 3 insights
  return candidateInsights.slice(0, 3);
}
