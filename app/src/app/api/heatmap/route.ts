export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll } from '@/lib/db';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()));

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const dailySpending = await queryAll<{ date: string; total: number; count: number }>(
      `SELECT date(date) as date, SUM(amount) as total, COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND type = 'expense' AND date(date) >= date(?) AND date(date) <= date(?)
       GROUP BY date(date)
       ORDER BY date(date) ASC`,
      [userId, startDate, endDate]
    );

    const dailyEarnings = await queryAll<{ date: string; total: number; count: number }>(
      `SELECT date(date) as date, SUM(amount) as total, COUNT(*) as count
       FROM transactions
       WHERE user_id = ? AND type = 'earning' AND date(date) >= date(?) AND date(date) <= date(?)
       GROUP BY date(date)
       ORDER BY date(date) ASC`,
      [userId, startDate, endDate]
    );

    // Monthly summary
    const monthlyStats = await queryAll<{ month: string; expenses: number; earnings: number }>(
      `SELECT 
         strftime('%Y-%m', date(date)) as month,
         SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expenses,
         SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END) as earnings
       FROM transactions
       WHERE user_id = ? AND date(date) >= date(?) AND date(date) <= date(?)
       GROUP BY strftime('%Y-%m', date(date))
       ORDER BY month ASC`,
      [userId, startDate, endDate]
    );

    // Peak spending day
    const peakDay = dailySpending.reduce((max, d) => d.total > (max?.total || 0) ? d : max, dailySpending[0] || null);

    return NextResponse.json({
      year,
      dailySpending,
      dailyEarnings,
      monthlyStats,
      peakDay,
      totalDaysTracked: dailySpending.length,
    });
  })
);
