import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne, run } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = await queryOne<{ id: number; name: string; email: string; currency: string; notify_budget: number; notify_overspend: number }>(
            'SELECT id, name, email, currency, notify_budget, notify_overspend FROM users WHERE id = ?',
            [session.userId]
        );
        return NextResponse.json({ user });
    } catch (error) {
        console.error('Settings error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { name, currency, notify_budget, notify_overspend } = await request.json();
        await run(
            'UPDATE users SET name = COALESCE(?, name), currency = COALESCE(?, currency), notify_budget = COALESCE(?, notify_budget), notify_overspend = COALESCE(?, notify_overspend) WHERE id = ?',
            [name ?? null, currency ?? null, notify_budget !== undefined ? (notify_budget ? 1 : 0) : null, notify_overspend !== undefined ? (notify_overspend ? 1 : 0) : null, session.userId]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
