import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, run } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const entries = await queryAll('SELECT * FROM net_worth WHERE user_id = ? ORDER BY created_at DESC', [session.userId]);
        return NextResponse.json({ entries });
    } catch (error) {
        console.error('Net worth error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { amount, note } = await request.json();
        if (amount === undefined) return NextResponse.json({ error: 'Amount required' }, { status: 400 });
        const result = await run('INSERT INTO net_worth (user_id, amount, note) VALUES (?, ?, ?)', [session.userId, amount, note || '']);
        return NextResponse.json({ id: result.lastInsertRowid });
    } catch (error) {
        console.error('Net worth create error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
