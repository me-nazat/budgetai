export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, run } from '@/lib/db';

async function autoGenerateAlerts(userId: number) {
    // 1. Budget Alerts
    const month = new Date().getMonth() + 1;
    const year = new Date().getFullYear();
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const budgets = await queryAll<{ id: number; category: string; monthly_limit: number }>(
        'SELECT id, category, monthly_limit FROM budgets WHERE user_id = ? AND month = ? AND year = ?',
        [userId, month, year]
    );

    const spending = await queryAll<{ category: string; total: number }>(
        `SELECT category, SUM(amount) as total FROM transactions 
         WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ? 
         GROUP BY category`,
        [userId, startDate, endDate]
    );

    for (const b of budgets) {
        const spent = spending.find(s => s.category.toLowerCase() === b.category.toLowerCase())?.total || 0;
        if (b.monthly_limit > 0 && spent >= b.monthly_limit * 0.9) {
            const isOver = spent >= b.monthly_limit;
            const title = isOver ? `Budget Exceeded: ${b.category}` : `Nearing Budget Limit: ${b.category}`;
            const message = isOver ? `You have spent ${spent.toFixed(2)} on ${b.category}, exceeding your limit of ${b.monthly_limit}.` : `You have spent ${spent.toFixed(2)} on ${b.category}, nearing your limit of ${b.monthly_limit}.`;
            const type = isOver ? 'danger' : 'warning';
            
            // Check if alert already exists recently
            const existing = await queryAll('SELECT id FROM notifications WHERE user_id = ? AND title = ? AND created_at > date("now", "-5 days")', [userId, title]);
            if (existing.length === 0) {
                await run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [userId, type, title, message]);
            }
        }
    }

    // 2. Recurring Alerts (due in next 3 days)
    const upcoming = await queryAll<{ id: number; name: string; amount: number; type: string; next_date: string }>(
        `SELECT id, name, amount, type, next_date FROM recurring_transactions 
         WHERE user_id = ? AND next_date >= date('now') AND next_date <= date('now', '+3 days')`,
        [userId]
    );

    for (const u of upcoming) {
        const title = `Upcoming ${u.type === 'expense' ? 'Payment' : 'Income'}: ${u.name}`;
        const message = `${u.name} for ${u.amount} is scheduled for ${u.next_date}.`;
        const type = 'info';
        
        const existing = await queryAll('SELECT id FROM notifications WHERE user_id = ? AND title = ? AND created_at > date("now", "-5 days")', [userId, title]);
        if (existing.length === 0) {
            await run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [userId, type, title, message]);
        }
    }

    // 3. Goal Alerts
    const goals = await queryAll<{ id: number; name: string; target_amount: number; saved_amount: number }>(
        'SELECT id, name, target_amount, saved_amount FROM savings_goals WHERE user_id = ?',
        [userId]
    );

    for (const g of goals) {
        if (g.saved_amount >= g.target_amount && g.target_amount > 0) {
            const title = `Goal Reached: ${g.name} 🎉`;
            const message = `Congratulations! You have reached your savings goal of ${g.target_amount} for ${g.name}.`;
            const type = 'success';
            
            const existing = await queryAll('SELECT id FROM notifications WHERE user_id = ? AND title = ?', [userId, title]);
            if (existing.length === 0) {
                await run('INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)', [userId, type, title, message]);
            }
        }
    }
}

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        
        // Auto-generate alerts before fetching
        await autoGenerateAlerts(session.userId);

        const notifications = await queryAll(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [session.userId]
        );
        const unreadCount = await queryAll<{ count: number }>(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
            [session.userId]
        );
        return NextResponse.json({ notifications, unreadCount: unreadCount[0]?.count || 0 });
    } catch (error) {
        console.error('Notifications error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id, markAll } = await request.json();
        if (markAll) {
            await run('UPDATE notifications SET read = 1 WHERE user_id = ?', [session.userId]);
        } else if (id) {
            await run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, session.userId]);
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Notification update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        if (body.clearAll) {
            await run('DELETE FROM notifications WHERE user_id = ?', [session.userId]);
        } else if (body.id) {
            await run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [body.id, session.userId]);
        } else {
            return NextResponse.json({ error: 'id or clearAll required' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Notification delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
