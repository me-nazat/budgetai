export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, run } from '@/lib/db';
import { isValidAmount, sanitizeCategory } from '@/lib/validation';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
        const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

        // Validate month/year ranges
        if (!Number.isFinite(month) || month < 1 || month > 12) {
            return NextResponse.json({ error: 'Invalid month (1-12)' }, { status: 400 });
        }
        if (!Number.isFinite(year) || year < 2000 || year > 2100) {
            return NextResponse.json({ error: 'Invalid year (2000-2100)' }, { status: 400 });
        }

        const budgets = await queryAll<{ id: number; category: string; monthly_limit: number }>(
            'SELECT id, category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
            [session.userId, month, year]
        );

        // Get spending per category
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

        const spending = await queryAll<{ category: string; total: number }>(
            `SELECT category, SUM(amount) as total FROM transactions 
       WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ? 
       GROUP BY category`,
            [session.userId, startDate, endDate]
        );

        const budgetsWithSpending = budgets.map(b => {
            const s = spending.find(s => s.category.toLowerCase() === b.category.toLowerCase());
            return { ...b, spent: s?.total || 0 };
        });

        return NextResponse.json({ budgets: budgetsWithSpending });
    } catch (error) {
        console.error('Budgets error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const category = sanitizeCategory(body.category);
        const monthly_limit = typeof body.monthly_limit === 'string' ? parseFloat(body.monthly_limit) : body.monthly_limit;

        if (!category || category === 'Other') {
            return NextResponse.json({ error: 'Category is required' }, { status: 400 });
        }
        if (!isValidAmount(monthly_limit)) {
            return NextResponse.json({ error: 'Valid budget limit required (positive number)' }, { status: 400 });
        }

        const m = body.month || new Date().getMonth() + 1;
        const y = body.year || new Date().getFullYear();

        if (typeof m !== 'number' || m < 1 || m > 12 || typeof y !== 'number' || y < 2000 || y > 2100) {
            return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
        }

        await run(
            `INSERT INTO budgets (user_id, category, monthly_limit, month, year) 
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, category, month, year) DO UPDATE SET monthly_limit = ?`,
            [session.userId, category, monthly_limit, m, y, monthly_limit]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Budget create error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const numId = parseInt(id, 10);
        if (!Number.isFinite(numId) || numId < 1) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        await run('DELETE FROM budgets WHERE id = ? AND user_id = ?', [numId, session.userId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Budget delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
