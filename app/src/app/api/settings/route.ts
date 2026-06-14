export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryOne, run } from '@/lib/db';
import { sanitizeName, isValidCurrency } from '@/lib/validation';

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
        const body = await request.json();

        const name = body.name !== undefined ? sanitizeName(body.name) : null;
        const currency = body.currency !== undefined ? (typeof body.currency === 'string' ? body.currency.toUpperCase().trim() : null) : null;
        const notify_budget = body.notify_budget !== undefined ? (body.notify_budget ? 1 : 0) : null;
        const notify_overspend = body.notify_overspend !== undefined ? (body.notify_overspend ? 1 : 0) : null;

        // Validate currency if provided
        if (currency && !isValidCurrency(currency)) {
            return NextResponse.json({ error: 'Invalid currency code' }, { status: 400 });
        }

        await run(
            'UPDATE users SET name = COALESCE(?, name), currency = COALESCE(?, currency), notify_budget = COALESCE(?, notify_budget), notify_overspend = COALESCE(?, notify_overspend) WHERE id = ?',
            [name, currency, notify_budget, notify_overspend, session.userId]
        );
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Settings update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
