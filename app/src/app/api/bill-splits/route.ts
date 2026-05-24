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

export async function POST(req: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { description, total_amount, date, split_mode, participants_json } = body;

        if (!description || total_amount == null) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const res = await run(
            `INSERT INTO bill_splits (user_id, description, total_amount, date, split_mode, participants_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, description, total_amount, date || new Date().toISOString(), split_mode || 'Equal', participants_json || '[]']
        );

        return NextResponse.json({ message: 'Created', id: res.lastInsertRowid });
    } catch (e) {
        return NextResponse.json({ error: 'Failed to create bill split' }, { status: 500 });
    }
}
