import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, run } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const items = await queryAll('SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY next_date ASC', [session.userId]);
        return NextResponse.json({ items });
    } catch (error) {
        console.error('Recurring error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { name, type, amount, category, frequency, next_date } = await request.json();
        if (!name || !type || !amount || amount <= 0) {
            return NextResponse.json({ error: 'Name, type, and valid amount required' }, { status: 400 });
        }

        await run(
            'INSERT INTO recurring_transactions (user_id, name, type, amount, category, frequency, next_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [session.userId, name, type, amount, category || 'Other', frequency || 'monthly', next_date || new Date().toISOString().split('T')[0]]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Recurring error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await request.json();
        await run('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [id, session.userId]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Recurring error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
