import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, run } from '@/lib/db';
import { isValidAmount, isValidType, isValidFrequency, isValidDate, sanitizeName, sanitizeCategory } from '@/lib/validation';

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

        const body = await request.json();
        const name = sanitizeName(body.name);
        const type = body.type;
        const amount = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
        const category = sanitizeCategory(body.category);
        const frequency = body.frequency || 'monthly';
        const next_date = body.next_date || new Date().toISOString().split('T')[0];

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        if (!isValidType(type)) {
            return NextResponse.json({ error: 'Type must be "expense" or "earning"' }, { status: 400 });
        }
        if (!isValidAmount(amount)) {
            return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
        }
        if (!isValidFrequency(frequency)) {
            return NextResponse.json({ error: 'Frequency must be weekly, monthly, or yearly' }, { status: 400 });
        }
        if (next_date && !isValidDate(next_date)) {
            return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
        }

        await run(
            'INSERT INTO recurring_transactions (user_id, name, type, amount, category, frequency, next_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [session.userId, name, type, amount, category, frequency, next_date]
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

        const body = await request.json();
        const id = body.id;

        if (!id || typeof id !== 'number') {
            return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
        }

        await run('DELETE FROM recurring_transactions WHERE id = ? AND user_id = ?', [id, session.userId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Recurring error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
