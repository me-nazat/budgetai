export const dynamic = 'force-dynamic';

/**
 * @fileoverview AI Annual Report API.
 *
 * GET — Generate an AI-powered annual financial summary report.
 *
 * Uses Gemini to analyze the user's full year of transactions, budgets,
 * net worth, and goals — then returns a structured narrative.
 *
 * @module api/report/annual
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll, queryOne } from '@/lib/db';

/**
 * GET /api/report/annual?year=2026
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    // Gather data
    const [
      transactions,
      monthlyTotals,
      topCategories,
      netWorthHistory,
      goalsSnapshot,
      debtsSnapshot,
    ] = await Promise.all([
      queryOne<{ count: number; totalIncome: number; totalExpense: number }>(
        `SELECT
          COUNT(*) as count,
          COALESCE(SUM(CASE WHEN type='earning' THEN amount ELSE 0 END), 0) as totalIncome,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as totalExpense
         FROM transactions WHERE user_id = ? AND strftime('%Y', date) = ?`,
        [userId, String(year)]
      ),
      queryAll<{ month: string; income: number; expense: number }>(
        `SELECT
          strftime('%m', date) as month,
          COALESCE(SUM(CASE WHEN type='earning' THEN amount ELSE 0 END), 0) as income,
          COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
         FROM transactions WHERE user_id = ? AND strftime('%Y', date) = ?
         GROUP BY strftime('%m', date)
         ORDER BY month`,
        [userId, String(year)]
      ),
      queryAll<{ category: string; total: number }>(
        `SELECT category, SUM(amount) as total FROM transactions
         WHERE user_id = ? AND type = 'expense' AND strftime('%Y', date) = ?
         GROUP BY category ORDER BY total DESC LIMIT 10`,
        [userId, String(year)]
      ),
      queryAll<{ amount: number; created_at: string }>(
        `SELECT amount, created_at FROM net_worth
         WHERE user_id = ? AND strftime('%Y', created_at) = ?
         ORDER BY created_at ASC`,
        [userId, String(year)]
      ),
      queryAll<{ name: string; target_amount: number; saved_amount: number }>(
        `SELECT name, target_amount, saved_amount FROM savings_goals WHERE user_id = ?`,
        [userId]
      ),
      queryAll<{ name: string; balance: number; initial_balance: number }>(
        `SELECT name, balance, initial_balance FROM debts WHERE user_id = ?`,
        [userId]
      ),
    ]);

    const totalIncome = transactions?.totalIncome || 0;
    const totalExpense = transactions?.totalExpense || 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;
    const netWorthStart = netWorthHistory[0]?.amount || 0;
    const netWorthEnd = netWorthHistory[netWorthHistory.length - 1]?.amount || 0;
    const netWorthChange = netWorthEnd - netWorthStart;

    // Build AI prompt
    const prompt = `You are a professional financial advisor writing a personal annual financial report for ${year}.

Data:
- Total income: $${totalIncome.toFixed(2)}
- Total expenses: $${totalExpense.toFixed(2)}
- Net savings: $${(totalIncome - totalExpense).toFixed(2)}
- Savings rate: ${savingsRate.toFixed(1)}%
- Transaction count: ${transactions?.count || 0}
- Top spending categories: ${topCategories.map(c => `${c.category} ($${c.total.toFixed(2)})`).join(', ')}
- Monthly trends: ${monthlyTotals.map(m => `Month ${m.month}: Income=$${m.income.toFixed(2)}, Expense=$${m.expense.toFixed(2)}`).join('; ')}
- Net worth change: $${netWorthStart.toFixed(2)} → $${netWorthEnd.toFixed(2)} (${netWorthChange >= 0 ? '+' : ''}$${netWorthChange.toFixed(2)})
- Active goals: ${goalsSnapshot.map(g => `${g.name}: ${((g.saved_amount / g.target_amount) * 100).toFixed(0)}% complete`).join(', ') || 'None'}
- Debts: ${debtsSnapshot.map(d => `${d.name}: $${d.balance.toFixed(2)} remaining of $${d.initial_balance.toFixed(2)}`).join(', ') || 'None'}

Write a comprehensive yet concise annual report in markdown format with these sections:
1. **Executive Summary** (2-3 sentences)
2. **Income & Expenses** (key stats + monthly highlights)
3. **Top Spending Categories** (analysis + recommendations)
4. **Net Worth Progress** (trend analysis)
5. **Goals & Debt Progress** (milestone tracking)
6. **Personalized Recommendations** (3-5 actionable tips for next year)
7. **Financial Health Score** (rate 1-100 with explanation)

Keep the tone professional but encouraging. Use bullet points and be specific with numbers.`;

    // Call Gemini API
    let aiReport = '';
    try {
      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
            }),
          }
        );

        if (res.ok) {
          const data = await res.json();
          aiReport = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        }
      }
    } catch (error) {
      console.error('[annual-report] AI generation error:', error);
    }

    // Fallback if AI fails
    if (!aiReport) {
      aiReport = `# ${year} Annual Financial Report

## Executive Summary
In ${year}, you earned $${totalIncome.toFixed(2)} and spent $${totalExpense.toFixed(2)}, achieving a savings rate of ${savingsRate.toFixed(1)}%.

## Key Statistics
- **Total Income:** $${totalIncome.toFixed(2)}
- **Total Expenses:** $${totalExpense.toFixed(2)}
- **Net Savings:** $${(totalIncome - totalExpense).toFixed(2)}
- **Savings Rate:** ${savingsRate.toFixed(1)}%
- **Net Worth Change:** ${netWorthChange >= 0 ? '+' : ''}$${netWorthChange.toFixed(2)}

## Top Spending Categories
${topCategories.map((c, i) => `${i + 1}. ${c.category}: $${c.total.toFixed(2)}`).join('\n')}

*AI-powered detailed analysis requires a Gemini API key.*`;
    }

    return NextResponse.json({
      year,
      report: aiReport,
      rawData: {
        totalIncome,
        totalExpense,
        savingsRate,
        netWorthChange,
        transactionCount: transactions?.count || 0,
        topCategories,
        monthlyTotals,
        goalsSnapshot,
        debtsSnapshot,
      },
    });
  }),
  { rateLimit: 'api' }
);
