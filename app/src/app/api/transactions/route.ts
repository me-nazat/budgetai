import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, run } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('start');
        const endDate = searchParams.get('end');
        const category = searchParams.get('category');
        const type = searchParams.get('type');
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');

        let sql = 'SELECT * FROM transactions WHERE user_id = ?';
        const params: unknown[] = [session.userId];

        if (startDate) { sql += ' AND date >= ?'; params.push(startDate); }
        if (endDate) { sql += ' AND date <= ?'; params.push(endDate); }
        if (category) { sql += ' AND category = ?'; params.push(category); }
        if (type) { sql += ' AND type = ?'; params.push(type); }

        sql += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const transactions = await queryAll(sql, params);

        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM transactions WHERE user_id = ?';
        const countParams: unknown[] = [session.userId];
        if (startDate) { countSql += ' AND date >= ?'; countParams.push(startDate); }
        if (endDate) { countSql += ' AND date <= ?'; countParams.push(endDate); }
        if (category) { countSql += ' AND category = ?'; countParams.push(category); }
        if (type) { countSql += ' AND type = ?'; countParams.push(type); }

        const countResult = await queryAll<{ total: number }>(countSql, countParams);
        const total = countResult[0]?.total || 0;

        return NextResponse.json({ transactions, total });
    } catch (error) {
        console.error('Transactions error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { type, amount, category, description, date } = await request.json();
        if (!type || !amount) {
            return NextResponse.json({ error: 'Type and amount are required' }, { status: 400 });
        }

        const result = await run(
            'INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (?, ?, ?, ?, ?, ?)',
            [session.userId, type, amount, category || 'Other', description || '', date || new Date().toISOString().split('T')[0]]
        );

        return NextResponse.json({ id: result.lastInsertRowid });
    } catch (error) {
        console.error('Transaction create error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, session.userId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Transaction delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, type, amount, category, description, date } = await request.json();
        if (!id || !type || !amount) {
            return NextResponse.json({ error: 'ID, type, and amount are required' }, { status: 400 });
        }

        const result = await run(
            'UPDATE transactions SET type = ?, amount = ?, category = ?, description = ?, date = ? WHERE id = ? AND user_id = ?',
            [type, amount, category || 'Other', description || '', date || new Date().toISOString().split('T')[0], id, session.userId]
        );

        if (result.rowsAffected === 0) {
            return NextResponse.json({ error: 'Transaction not found or unauthorized' }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Transaction update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
