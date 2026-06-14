import { NextResponse } from 'next/server';
import { getSession } from "@/lib/security/session-manager";
import { queryAll, queryOne, run } from '@/lib/db';
import { TourTransactionSchema } from '@/lib/validation';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Tour ID required' }, { status: 400 });

    const tour = await queryOne('SELECT id FROM tour_groups WHERE id = ? AND user_id = ?', [id, session.userId]);
    if (!tour) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const transactions = await queryAll(`
        SELECT t.*, p.name as paid_by_name 
        FROM transactions t
        LEFT JOIN tour_participants p ON t.paid_by = p.id
        WHERE t.tour_id = ? 
        ORDER BY t.date DESC, t.created_at DESC
    `, [id]);

    return NextResponse.json({ transactions });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Tour ID required' }, { status: 400 });

    const tour = await queryOne('SELECT id FROM tour_groups WHERE id = ? AND user_id = ?', [id, session.userId]);
    if (!tour) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const data = TourTransactionSchema.parse(body);

    const result = await run(
        'INSERT INTO transactions (user_id, type, amount, category, description, date, tour_id, paid_by, split_type) VALUES (?, "expense", ?, ?, ?, ?, ?, ?, ?)',
        [session.userId, data.amount, data.category, data.description, data.date, id, data.paidBy, data.splitType]
    );

    return NextResponse.json({ id: result.lastInsertRowid });
}
