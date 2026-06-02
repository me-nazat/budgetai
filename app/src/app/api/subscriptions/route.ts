import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import { queryAll, run } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-for-dev');

async function getUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jose.jwtVerify(token, JWT_SECRET);
        return payload.userId as number;
    } catch {
        return null;
    }
}

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const subscriptions = await queryAll(
            'SELECT * FROM subscriptions WHERE user_id = ? ORDER BY next_renewal_date ASC',
            [userId]
        );
        return NextResponse.json({ subscriptions });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { name, amount, currency = 'BDT', billing_cycle = 'monthly', next_renewal_date, category = 'Other', logo_url = null, is_active = 1 } = body;

        if (!name || amount == null || !next_renewal_date) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const res = await run(
            `INSERT INTO subscriptions (user_id, name, amount, currency, billing_cycle, next_renewal_date, category, logo_url, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, name, amount, currency, billing_cycle, next_renewal_date, category, logo_url, is_active ? 1 : 0]
        );

        return NextResponse.json({ message: 'Created', id: res.lastInsertRowid });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 });
    }
}
