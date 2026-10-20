export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll } from '@/lib/db';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const now = new Date();
    const yearParam = url.searchParams.get('year');
    const monthParam = url.searchParams.get('month');

    const year = parseInt(yearParam || String(now.getFullYear()), 10);
    const month = monthParam ? parseInt(monthParam, 10) : null;

    let startDate: string;
    let endDate: string;

    if (month && month >= 1 && month <= 12) {
      const daysInMonth = new Date(year, month, 0).getDate();
      startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    } else {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    }

    const [dailySpending, dailyEarnings, monthlyStats] = await Promise.all([
      queryAll<{ date: string; total: number; count: number }>(
        `SELECT date(date) as date, SUM(amount) as total, COUNT(*) as count
         FROM transactions
         WHERE user_id = ? AND type = 'expense' AND date(date) >= date(?) AND date(date) <= date(?)
         GROUP BY date(date)
         ORDER BY date(date) ASC`,
        [userId, startDate, endDate]
      ),
      queryAll<{ date: string; total: number; count: number }>(
        `SELECT date(date) as date, SUM(amount) as total, COUNT(*) as count
         FROM transactions
         WHERE user_id = ? AND type = 'earning' AND date(date) >= date(?) AND date(date) <= date(?)
         GROUP BY date(date)
         ORDER BY date(date) ASC`,
        [userId, startDate, endDate]
      ),
      queryAll<{ month: string; expenses: number; earnings: number }>(
        `SELECT 
           strftime('%Y-%m', date(date)) as month,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
           SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END) as earnings
         FROM transactions
         WHERE user_id = ? AND date(date) >= date(?) AND date(date) <= date(?)
         GROUP BY strftime('%Y-%m', date(date))
         ORDER BY month ASC`,
        [userId, startDate, endDate]
      ),
    ]);

    // Build map for rapid date lookup
    const expenseMap = new Map<string, { total: number; count: number }>();
    dailySpending.forEach((d) => expenseMap.set(d.date, { total: Number(d.total), count: Number(d.count) }));

    const earningMap = new Map<string, { total: number; count: number }>();
    dailyEarnings.forEach((d) => earningMap.set(d.date, { total: Number(d.total), count: Number(d.count) }));

    // Non-zero expenses distribution for statistical quartile & outlier calculation
    const nonZeroExpenses = dailySpending
      .map((d) => Number(d.total))
      .filter((t) => t > 0)
      .sort((a, b) => a - b);

    let quartiles = [0, 0, 0, 0];
    let median = 0;
    let outlierThreshold = 0;

    if (nonZeroExpenses.length > 0) {
      const len = nonZeroExpenses.length;
      const q1 = nonZeroExpenses[Math.floor(len * 0.25)];
      median = nonZeroExpenses[Math.floor(len * 0.50)];
      const q3 = nonZeroExpenses[Math.floor(len * 0.75)];
      const q4 = nonZeroExpenses[len - 1];
      quartiles = [q1, median, q3, q4];
      outlierThreshold = Math.round(median * 2.5 * 100) / 100;
    }

    // Peak spending day
    const peakDay = dailySpending.reduce(
      (max, d) => (d.total > (max?.total || 0) ? d : max),
      dailySpending[0] || null
    );

    // Build comprehensive dailyStats for calendar days
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const startObj = new Date(startDate + 'T00:00:00Z');
    const endObj = new Date(endDate + 'T00:00:00Z');
    const dailyStats = [];
    let zeroSpendDaysCount = 0;

    for (let cur = new Date(startObj); cur <= endObj; cur.setUTCDate(cur.getUTCDate() + 1)) {
      const curIso = cur.toISOString().split('T')[0];
      const exp = expenseMap.get(curIso)?.total || 0;
      const earn = earningMap.get(curIso)?.total || 0;
      const count = (expenseMap.get(curIso)?.count || 0) + (earningMap.get(curIso)?.count || 0);
      const isZeroSpendDay = exp === 0;
      const isOutlier = outlierThreshold > 0 && exp > outlierThreshold;

      if (isZeroSpendDay && curIso <= todayStr) {
        zeroSpendDaysCount++;
      }

      dailyStats.push({
        date: curIso,
        income: earn,
        expense: exp,
        count,
        netCashflow: earn - exp,
        isZeroSpendDay,
        isOutlier,
      });
    }

    return NextResponse.json({
      year,
      month,
      dailySpending,
      dailyEarnings,
      dailyStats,
      monthlyStats,
      peakDay,
      totalDaysTracked: dailySpending.length,
      zeroSpendDaysCount,
      quartiles,
      median,
      outlierThreshold,
    });
  })
);
