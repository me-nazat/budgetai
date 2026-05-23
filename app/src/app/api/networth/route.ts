import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, run } from '@/lib/db';
import { sanitizeText } from '@/lib/validation';

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
        const body = await request.json();
        const amount = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
        const note = sanitizeText(body.note, 200);

        if (typeof amount !== 'number' || !Number.isFinite(amount)) {
            return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
        }

        const result = await run('INSERT INTO net_worth (user_id, amount, note) VALUES (?, ?, ?)', [session.userId, amount, note]);
        return NextResponse.json({ id: result.lastInsertRowid });
    } catch (error) {
        console.error('Net worth create error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
