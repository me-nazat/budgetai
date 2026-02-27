import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, queryOne } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();
        const firstOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const firstOfLastMonth = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}-01`;

        // Current month totals
        const currentExpenses = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ?",
            [session.userId, firstOfMonth]
        );
        const currentEarnings = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ?",
            [session.userId, firstOfMonth]
        );

        // Last month totals
        const lastExpenses = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ?",
            [session.userId, firstOfLastMonth, firstOfMonth]
        );
        const lastEarnings = await queryOne<{ total: number }>(
            "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id = ? AND type = 'earning' AND date >= ? AND date < ?",
            [session.userId, firstOfLastMonth, firstOfMonth]
        );

        // Spending by category this month
        const categorySpending = await queryAll<{ category: string; total: number }>(
            "SELECT category, SUM(amount) as total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? GROUP BY category ORDER BY total DESC",
            [session.userId, firstOfMonth]
        );

        // Daily spending for chart (last 30 days)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const dailySpending = await queryAll<{ date: string; expenses: number; earnings: number }>(
            `SELECT date, 
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
        COALESCE(SUM(CASE WHEN type = 'earning' THEN amount ELSE 0 END), 0) as earnings
       FROM transactions WHERE user_id = ? AND date >= ? GROUP BY date ORDER BY date ASC`,
            [session.userId, thirtyDaysAgo]
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
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
