import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, run } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const goals = await queryAll('SELECT * FROM savings_goals WHERE user_id = ? ORDER BY created_at DESC', [session.userId]);
        return NextResponse.json({ goals });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { name, target_amount, deadline } = await request.json();
        if (!name || !target_amount || target_amount <= 0) {
            return NextResponse.json({ error: 'Name and valid target amount required' }, { status: 400 });
        }

        await run(
            'INSERT INTO savings_goals (user_id, name, target_amount, deadline) VALUES (?, ?, ?, ?)',
            [session.userId, name, target_amount, deadline || null]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, contribution } = await request.json();
        if (!id || !contribution || contribution <= 0) {
            return NextResponse.json({ error: 'Valid goal ID and contribution required' }, { status: 400 });
        }

        await run(
            'UPDATE savings_goals SET saved_amount = saved_amount + ? WHERE id = ? AND user_id = ?',
            [contribution, id, session.userId]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await request.json();
        await run('DELETE FROM savings_goals WHERE id = ? AND user_id = ?', [id, session.userId]);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Goals error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
