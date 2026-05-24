import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import { run } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-for-dev');

async function getUserId() {
    const token = cookies().get('token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jose.jwtVerify(token, JWT_SECRET);
        return payload.userId as number;
    } catch {
        return null;
    }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { name, amount, currency, billing_cycle, next_renewal_date, category, is_active } = body;

        await run(
            `UPDATE subscriptions SET 
             name = COALESCE(?, name),
             amount = COALESCE(?, amount),
             currency = COALESCE(?, currency),
             billing_cycle = COALESCE(?, billing_cycle),
             next_renewal_date = COALESCE(?, next_renewal_date),
             category = COALESCE(?, category),
             is_active = COALESCE(?, is_active)
             WHERE id = ? AND user_id = ?`,
            [name, amount, currency, billing_cycle, next_renewal_date, category, is_active !== undefined ? (is_active ? 1 : 0) : null, params.id, userId]
        );

        return NextResponse.json({ message: 'Updated' });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await run('DELETE FROM subscriptions WHERE id = ? AND user_id = ?', [params.id, userId]);
        return NextResponse.json({ message: 'Deleted' });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 });
    }
}
