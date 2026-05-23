import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, queryOne } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const searchParams = request.nextUrl.searchParams;
        const monthQuery = searchParams.get('month'); // format: YYYY-MM
        const weekQuery = searchParams.get('week'); // format: 'all', '1', '2', '3', '4'

        let currentYear, currentMonth;
        if (monthQuery && monthQuery.match(/^\d{4}-\d{2}$/)) {
            [currentYear, currentMonth] = monthQuery.split('-').map(Number);
        } else {
            const now = new Date();
            currentYear = now.getFullYear();
            currentMonth = now.getMonth() + 1;
        }

        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        let startDayCurrent = 1;
        let endDayCurrent = new Date(currentYear, currentMonth, 0).getDate(); // last day of month

        let startDayPrev = 1;
        let endDayPrev = new Date(lastMonthYear, lastMonth, 0).getDate();

        if (weekQuery && weekQuery !== 'all') {
            const weekNum = parseInt(weekQuery);
            if (weekNum === 1) { startDayCurrent = 1; endDayCurrent = 7; }
            else if (weekNum === 2) { startDayCurrent = 8; endDayCurrent = 14; }
            else if (weekNum === 3) { startDayCurrent = 15; endDayCurrent = 21; }
            else if (weekNum === 4) { startDayCurrent = 22; /* endDay is already last day of month */ }

            // Apply same day ranges for previous period comparison
            startDayPrev = startDayCurrent;
            endDayPrev = weekNum === 4 ? new Date(lastMonthYear, lastMonth, 0).getDate() : endDayCurrent;
        }

        const currentStartDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(startDayCurrent).padStart(2, '0')}`;
        const currentEndDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(endDayCurrent).padStart(2, '0')}`;

        const prevStartDate = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-${String(startDayPrev).padStart(2, '0')}`;
        const prevEndDate = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-${String(endDayPrev).padStart(2, '0')}`;

        // Current period totals
        const currentExpenses = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
            [session.userId, currentStartDate, currentEndDate]
        );
        const currentEarnings = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date <= ?",
            [session.userId, currentStartDate, currentEndDate]
        );

        // Previous period totals
        const lastExpenses = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?",
            [session.userId, prevStartDate, prevEndDate]
        );
        const lastEarnings = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date <= ?",
            [session.userId, prevStartDate, prevEndDate]
        );

        // Spending by category this period
        const categorySpending = await queryAll<{ category: string; total: number }>(
            "SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ? GROUP BY category ORDER BY total DESC",
            [session.userId, currentStartDate, currentEndDate]
        );

        // Daily spending for chart 
        const dailySpending = await queryAll<{ date: string; expenses: number; earnings: number }>(
            `SELECT date, 
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
        COALESCE(SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END), 0) as earnings
       FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date ORDER BY date ASC`,
            [session.userId, currentStartDate, currentEndDate]
        );

        const totalTxs = await queryOne<{ count: number }>(
            'SELECT COUNT(*) as count FROM transactions WHERE user_id = ?',
            [session.userId]
        );

        // Recent transactions
        const recentTransactions = await queryAll(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC LIMIT 5',
            [session.userId]
        );

        // Budget alerts
        const budgets = await queryAll<{ category: string; monthly_limit: number }>(
            'SELECT category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
            [session.userId, currentMonth, currentYear]
        );

        const budgetAlerts = budgets.map(b => {
            const s = categorySpending.find(c => c.category.toLowerCase() === b.category.toLowerCase());
            const spent = s?.total || 0;
            const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
            return { category: b.category, limit: b.monthly_limit, spent, percentage: Math.round(pct) };
        }).filter(b => b.percentage >= 50)
            .sort((a, b) => b.percentage - a.percentage);

        // Net worth
        const netWorth = await queryOne<{ amount: number }>(
            'SELECT amount FROM net_worth WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [session.userId]
        );

        const expChange = lastExpenses?.total ? ((currentExpenses!.total - lastExpenses.total) / lastExpenses.total * 100) : 0;
        const earnChange = lastEarnings?.total ? ((currentEarnings!.total - lastEarnings.total) / lastEarnings.total * 100) : 0;

        return NextResponse.json({
            expenses: { current: currentExpenses?.total || 0, change: expChange },
            earnings: { current: currentEarnings?.total || 0, change: earnChange },
            netSavings: (currentEarnings?.total || 0) - (currentExpenses?.total || 0),
            balance: (netWorth?.amount || 0) + (currentEarnings?.total || 0) - (currentExpenses?.total || 0),
            categorySpending,
            dailySpending,
            recentTransactions,
            budgetAlerts,
            netWorth: netWorth?.amount || 0,
            totalTransactions: totalTxs?.count || 0,
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
    }
}
