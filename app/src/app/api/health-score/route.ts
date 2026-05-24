import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll, queryOne } from '@/lib/db';
import { generateGeminiResponse } from '@/lib/ai/gemini';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

    const currentStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const currentEndDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(new Date(currentYear, currentMonth, 0).getDate()).padStart(2, '0')}`;
    
    const prevStartDate = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`;
    const prevEndDate = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-${String(new Date(lastMonthYear, lastMonth, 0).getDate()).padStart(2, '0')}`;

    // 1. Savings Rate (25pts)
    const currentExpenses = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
      [userId, currentStartDate, currentEndDate]
    );
    const currentEarnings = await queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date <= ?",
      [userId, currentStartDate, currentEndDate]
    );

    const expenseTotal = currentExpenses?.total || 0;
    const earningTotal = currentEarnings?.total || 0;
    const savings = earningTotal - expenseTotal;
    const savingsRate = earningTotal > 0 ? (savings / earningTotal) : 0;
    
    // 20%+ = 25pts, linear scale down
    let savingsRateScore = 0;
    if (savingsRate >= 0.2) savingsRateScore = 25;
    else if (savingsRate > 0) savingsRateScore = Math.round((savingsRate / 0.2) * 25);

    // 2. Budget Adherence (25pts)
    const budgets = await queryAll<{ category: string; monthly_limit: number }>(
      'SELECT category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
      [userId, currentMonth, currentYear]
    );

    const categorySpending = await queryAll<{ category: string; total: number }>(
      "SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ? GROUP BY category",
      [userId, currentStartDate, currentEndDate]
    );

    let budgetAdherenceScore = 25;
    if (budgets.length > 0) {
      let budgetsKept = 0;
      for (const b of budgets) {
        const spent = categorySpending.find(c => c.category.toLowerCase() === b.category.toLowerCase())?.total || 0;
        if (spent <= b.monthly_limit) budgetsKept++;
      }
      budgetAdherenceScore = Math.round((budgetsKept / budgets.length) * 25);
    }

    // 3. Net Worth Trend (20pts)
    const currentNetWorth = await queryOne<{ amount: number }>(
      "SELECT amount FROM net_worth WHERE user_id = ? AND date(created_at) <= ? ORDER BY created_at DESC LIMIT 1",
      [userId, currentEndDate]
    );
    const lastNetWorth = await queryOne<{ amount: number }>(
      "SELECT amount FROM net_worth WHERE user_id = ? AND date(created_at) <= ? ORDER BY created_at DESC LIMIT 1",
      [userId, prevEndDate]
    );

    const cnw = currentNetWorth?.amount || 0;
    const lnw = lastNetWorth?.amount || 0;
    
    let netWorthScore = 10; // base score if no historical data
    if (cnw > 0 && lnw > 0) {
      if (cnw > lnw) {
        netWorthScore = 20; // Grew
      } else if (cnw === lnw) {
        netWorthScore = 15; // Stagnant
      } else {
        const drop = (lnw - cnw) / lnw;
        netWorthScore = Math.max(0, 20 - Math.round(drop * 100)); // Dropped, penalty
      }
    }

    // 4. Emergency Fund Coverage (20pts)
    let emergencyFundScore = 0;
    if (expenseTotal > 0) {
      const monthsCoverage = cnw / expenseTotal;
      if (monthsCoverage >= 6) emergencyFundScore = 20;
      else emergencyFundScore = Math.round((monthsCoverage / 6) * 20);
    } else if (cnw > 0) {
       emergencyFundScore = 20; // Have net worth and 0 expenses = full coverage
    }

    // 5. Expense Consistency (10pts)
    const dailySpending = await queryAll<{ date: string; amount: number }>(
      "SELECT date, SUM(amount) as amount FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ? GROUP BY date",
      [userId, prevStartDate, currentEndDate] // Last 2 months for better stddev
    );

    let consistencyScore = 5;
    if (dailySpending.length > 2) {
       // Group into weeks
       const weeklySpend: number[] = [];
       let currentWeekSum = 0;
       for (let i = 0; i < dailySpending.length; i++) {
           currentWeekSum += dailySpending[i].amount;
           if ((i + 1) % 7 === 0 || i === dailySpending.length - 1) {
               weeklySpend.push(currentWeekSum);
               currentWeekSum = 0;
           }
       }
       if (weeklySpend.length > 1) {
           const avg = weeklySpend.reduce((a, b) => a + b, 0) / weeklySpend.length;
           const variance = weeklySpend.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / weeklySpend.length;
           const stdDev = Math.sqrt(variance);
           const cv = avg > 0 ? stdDev / avg : 0; // Coefficient of Variation

           // CV < 0.2 is very consistent (10pts). CV > 1.0 is very inconsistent (0pts).
           if (cv < 0.2) consistencyScore = 10;
           else if (cv > 1.0) consistencyScore = 0;
           else consistencyScore = Math.round((1.0 - cv) / 0.8 * 10);
       }
    } else if (dailySpending.length === 0) {
        consistencyScore = 10; // No spending is consistent
    }

    const totalScore = savingsRateScore + budgetAdherenceScore + netWorthScore + emergencyFundScore + consistencyScore;

    // AI Insight
    let insight = '';
    try {
        const prompt = `Analyze this user's financial health score components and generate exactly ONE short, actionable sentence (max 15 words) advising them on their biggest opportunity for improvement.
        
        Data:
        Total Score: ${totalScore}/100
        Savings Rate: ${Math.round(savingsRate*100)}% (Score: ${savingsRateScore}/25)
        Budgets Kept: (Score: ${budgetAdherenceScore}/25)
        Net Worth: ${cnw} (Score: ${netWorthScore}/20)
        Emergency Fund: (Score: ${emergencyFundScore}/20)
        Expense Consistency: (Score: ${consistencyScore}/10)
        
        Example outputs:
        "Try to save 20% of your income this month to boost your score."
        "Build your emergency fund to cover at least 6 months of expenses."
        "Review your budget limits, you frequently exceed them."
        "Your net worth dropped slightly; review your largest expenses this month."
        `;
        insight = await generateGeminiResponse(prompt, '');
        insight = insight.replace(/["']/g, '').trim(); // Clean up quotes
    } catch (e) {
        console.error("Gemini Health Score error:", e);
        insight = "Keep tracking your expenses to build a strong financial history.";
    }

    // Sparkline history (last 7 months)
    const history = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
        const monthEnd = `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
        
        // Simplified score for history: just use savings + net worth proxy
        const moExp = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
            [userId, monthStart, monthEnd]
        );
        const moEarn = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date <= ?",
            [userId, monthStart, monthEnd]
        );
        const eT = moEarn?.total || 0;
        const xT = moExp?.total || 0;
        const sR = eT > 0 ? (eT - xT) / eT : 0;
        let pScore = 50; // base
        if (sR > 0.1) pScore += 20;
        else if (sR > 0) pScore += 10;
        else if (sR < 0) pScore -= 20;
        
        // Clamp 0-100
        pScore = Math.max(0, Math.min(100, pScore));
        
        // For the current month, use the actual calculated totalScore
        if (i === 0) {
            pScore = totalScore;
        }

        history.push({
            month: d.toLocaleString('default', { month: 'short' }),
            score: pScore
        });
    }

    return NextResponse.json({
      score: totalScore,
      breakdown: {
        savingsRate: { score: savingsRateScore, max: 25 },
        budgetAdherence: { score: budgetAdherenceScore, max: 25 },
        netWorth: { score: netWorthScore, max: 20 },
        emergencyFund: { score: emergencyFundScore, max: 20 },
        consistency: { score: consistencyScore, max: 10 }
      },
      history,
      insight
    });
  })
);
