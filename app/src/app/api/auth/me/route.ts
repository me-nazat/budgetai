import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryOne } from '@/lib/db';

export async function GET() {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await queryOne<{ id: number; name: string; email: string; currency: string; notify_budget: number; notify_overspend: number }>(
        'SELECT id, name, email, currency, notify_budget, notify_overspend FROM users WHERE id = ?',
        [session.userId]
    );

    if (!user) {
        return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({ user });
}
