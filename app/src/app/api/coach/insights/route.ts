export const dynamic = 'force-dynamic';

/**
 * @fileoverview AI Coach Insights engine — Dynamic database-driven analysis.
 *
 * GET  — Generates real-time financial insights from user database data:
 *        - Idle cash detection (> $2,000 in liquid accounts)
 *        - Monthly spending acceleration (> 15% month-over-month increase)
 *        - Unused subscription / recurring bill alerts
 * POST — Dismiss an insight.
 *
 * @module api/coach/insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { AiInsightsRepository } from '@/repositories/aiInsights.repository';
import { db } from '@/db/client';
import { accounts, recurringTransactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { queryOne } from '@/lib/db';

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    let insights = await AiInsightsRepository.getActiveInsights(userId);

    // If active cache has expired or is empty, run real financial analysis
    if (insights.length === 0) {
      // 1. Idle Cash Analysis
      const checkingAccounts = await db
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, userId),
            eq(accounts.type, 'bank')
          )
        );

      const totalCheckingBalance = checkingAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);

      if (totalCheckingBalance > 2000) {
        const excess = Math.round(totalCheckingBalance - 1500);
        const estimatedYield = Math.round(excess * 0.045); // 4.5% APY HYSA
        await AiInsightsRepository.cacheInsight({
          userId,
          insightType: 'savings_opportunity',
          title: 'Idle Cash Optimization',
          description: `You have $${totalCheckingBalance.toLocaleString()} in checking. Moving $${excess.toLocaleString()} to High-Yield Savings could earn ~$${estimatedYield}/year.`,
          actionPayload: JSON.stringify({
            toolName: 'analyze_idle_cash',
            parameters: { idleAmount: excess, targetYield: estimatedYield },
          }),
        });
      }

      // 2. Month-over-Month Spending Delta Analysis
      const now = new Date();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
      const currentYear = String(now.getFullYear());
      const prevYear = String(prevMonthDate.getFullYear());

      const currentSpend = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE user_id = ? AND type = 'expense'
         AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
        [userId, currentMonth, currentYear]
      );

      const prevSpend = await queryOne<{ total: number }>(
        `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
         WHERE user_id = ? AND type = 'expense'
         AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
        [userId, prevMonth, prevYear]
      );

      const currTotal = currentSpend?.total || 0;
      const prevTotal = prevSpend?.total || 0;

      if (prevTotal > 0 && currTotal > prevTotal * 1.15) {
        const increasePct = Math.round(((currTotal - prevTotal) / prevTotal) * 100);
        await AiInsightsRepository.cacheInsight({
          userId,
          insightType: 'price_jump',
          title: 'Spending Delta Warning',
          description: `Your spending this month ($${currTotal.toFixed(0)}) is ${increasePct}% higher than last month ($${prevTotal.toFixed(0)}).`,
          actionPayload: JSON.stringify({
            toolName: 'create_budget',
            parameters: { category: 'General', monthlyLimit: Math.round(prevTotal * 1.05) },
          }),
        });
      }

      // 3. Active Subscription Count Insight
      const activeSubs = await db
        .select()
        .from(recurringTransactions)
        .where(
          and(
            eq(recurringTransactions.userId, userId),
            eq(recurringTransactions.active, 1),
            eq(recurringTransactions.type, 'expense')
          )
        );

      if (activeSubs.length >= 3) {
        const totalSubMonthly = activeSubs.reduce((sum, s) => sum + s.amount, 0);
        await AiInsightsRepository.cacheInsight({
          userId,
          insightType: 'subscription_review',
          title: `Review ${activeSubs.length} Active Subscriptions`,
          description: `You are paying $${totalSubMonthly.toFixed(2)}/month across ${activeSubs.length} recurring subscriptions.`,
          actionPayload: JSON.stringify({
            toolName: 'suggest_tax_deductions',
            parameters: { subscriptionCount: activeSubs.length, monthlyTotal: totalSubMonthly },
          }),
        });
      }

      insights = await AiInsightsRepository.getActiveInsights(userId);
    }

    return NextResponse.json({ insights });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { insightId } = body;

    if (!insightId) {
      return NextResponse.json({ error: 'Insight ID required' }, { status: 400 });
    }

    await AiInsightsRepository.dismissInsight(parseInt(insightId, 10), userId);
    return NextResponse.json({ success: true });
  })
);
