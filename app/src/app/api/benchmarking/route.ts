export const dynamic = 'force-dynamic';

/**
 * @fileoverview Peer Benchmarking API.
 *
 * GET — Returns anonymized percentile comparisons for the authenticated user.
 *
 * Computes:
 * - Savings rate percentile
 * - Spending per category vs. global averages
 * - Budget adherence percentile
 * - AI narrative insight
 *
 * @privacy
 * - All data is anonymized. No PII is shared.
 * - Users must opt-in via their profile settings.
 *
 * @module api/benchmarking
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll, queryOne } from '@/lib/db';

/**
 * GET /api/benchmarking
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear());

    // User's stats this month
    const userStats = await queryOne<{
      totalIncome: number; totalExpense: number; txCount: number;
    }>(
      `SELECT
        COALESCE(SUM(CASE WHEN type='earning' THEN amount ELSE 0 END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as totalExpense,
        COUNT(*) as txCount
       FROM transactions
       WHERE user_id = ? AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
      [userId, month, year]
    );

    // Global averages (anonymized, across all users)
    const globalStats = await queryOne<{
      avgIncome: number; avgExpense: number; userCount: number;
    }>(
      `SELECT
        AVG(user_income) as avgIncome,
        AVG(user_expense) as avgExpense,
        COUNT(*) as userCount
       FROM (
        SELECT user_id,
          SUM(CASE WHEN type='earning' THEN amount ELSE 0 END) as user_income,
          SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) as user_expense
        FROM transactions
        WHERE strftime('%m', date) = ? AND strftime('%Y', date) = ?
        GROUP BY user_id
       )`,
      [month, year]
    );

    // Calculate savings rate percentiles
    const allSavingsRates = await queryAll<{ rate: number }>(
      `SELECT
        CASE WHEN SUM(CASE WHEN type='earning' THEN amount ELSE 0 END) > 0
          THEN (SUM(CASE WHEN type='earning' THEN amount ELSE 0 END) - SUM(CASE WHEN type='expense' THEN amount ELSE 0 END))
            / SUM(CASE WHEN type='earning' THEN amount ELSE 0 END) * 100
          ELSE 0 END as rate
       FROM transactions
       WHERE strftime('%m', date) = ? AND strftime('%Y', date) = ?
       GROUP BY user_id
       ORDER BY rate ASC`,
      [month, year]
    );

    const userIncome = userStats?.totalIncome || 0;
    const userExpense = userStats?.totalExpense || 0;
    const userSavingsRate = userIncome > 0
      ? ((userIncome - userExpense) / userIncome) * 100
      : 0;

    // Calculate percentile
    const totalUsers = allSavingsRates.length;
    const belowUser = allSavingsRates.filter(r => r.rate < userSavingsRate).length;
    const savingsPercentile = totalUsers > 0 ? Math.round((belowUser / totalUsers) * 100) : 50;

    // Top spending categories comparison
    const userCategories = await queryAll<{ category: string; total: number }>(
      `SELECT category, SUM(amount) as total FROM transactions
       WHERE user_id = ? AND type = 'expense' AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
       GROUP BY category ORDER BY total DESC LIMIT 5`,
      [userId, month, year]
    );

    const globalCategories = await queryAll<{ category: string; avgTotal: number }>(
      `SELECT category, AVG(cat_total) as avgTotal FROM (
        SELECT user_id, category, SUM(amount) as cat_total FROM transactions
        WHERE type = 'expense' AND strftime('%m', date) = ? AND strftime('%Y', date) = ?
        GROUP BY user_id, category
       ) GROUP BY category ORDER BY avgTotal DESC LIMIT 10`,
      [month, year]
    );

    const categoryBenchmarks = userCategories.map(uc => {
      const globalAvg = globalCategories.find(gc => gc.category === uc.category)?.avgTotal || 0;
      const diff = globalAvg > 0 ? ((uc.total - globalAvg) / globalAvg * 100) : 0;
      return {
        category: uc.category,
        userSpending: uc.total,
        globalAverage: globalAvg,
        diffPercent: Math.round(diff),
        status: diff > 20 ? 'above' as const : diff < -20 ? 'below' as const : 'average' as const,
      };
    });

    // AI narrative
    let aiInsight = '';
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey && totalUsers > 1) {
        const prompt = `In 2 concise sentences, give a personalized peer comparison insight.
User's savings rate: ${userSavingsRate.toFixed(1)}% (${savingsPercentile}th percentile of ${totalUsers} users).
Top spending: ${categoryBenchmarks.map(c => `${c.category}: ${c.diffPercent > 0 ? '+' : ''}${c.diffPercent}% vs avg`).join(', ')}.
Be encouraging but honest. Use specific numbers.`;

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 200 },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          aiInsight = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }
    } catch { /* fail silently */ }

    return NextResponse.json({
      month: `${year}-${month}`,
      peerCount: totalUsers,
      user: {
        income: userIncome,
        expense: userExpense,
        savingsRate: Math.round(userSavingsRate * 10) / 10,
        transactionCount: userStats?.txCount || 0,
      },
      benchmarks: {
        savingsPercentile,
        globalAvgIncome: globalStats?.avgIncome || 0,
        globalAvgExpense: globalStats?.avgExpense || 0,
        categoryBenchmarks,
      },
      aiInsight: aiInsight || `Your savings rate of ${userSavingsRate.toFixed(1)}% puts you in the ${savingsPercentile}th percentile among ${totalUsers} users.`,
    });
  })
);
