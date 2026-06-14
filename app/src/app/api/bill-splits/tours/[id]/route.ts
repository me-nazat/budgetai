import { NextResponse } from 'next/server';
import { getSession } from "@/lib/security/session-manager";
import { queryAll, queryOne, run } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Tour ID required' }, { status: 400 });

    const tour = await queryOne(
        'SELECT * FROM tour_groups WHERE id = ? AND user_id = ?',
        [id, session.userId]
    );

    if (!tour) return NextResponse.json({ error: 'Tour not found' }, { status: 404 });

    const participants = await queryAll(
        'SELECT * FROM tour_participants WHERE tour_id = ?',
        [id]
    );

    const transactions = await queryAll<{ amount: number, paid_by: number, split_type: string }>(
        'SELECT amount, paid_by, split_type FROM transactions WHERE tour_id = ? AND type = "expense"',
        [id]
    );

    const totalCost = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const perPersonAverage = participants.length > 0 ? totalCost / participants.length : 0;

    return NextResponse.json({ tour, participants, totalCost, perPersonAverage });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Tour ID required' }, { status: 400 });

    await run(
        'DELETE FROM tour_groups WHERE id = ? AND user_id = ?',
        [id, session.userId]
    );

    return NextResponse.json({ success: true });
}
