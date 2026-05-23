import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, queryOne, run } from '@/lib/db';
import { maybeCreateBudgetAlert } from '@/lib/alerts';
import { isStandardCategory, resolveColor, resolveIcon } from '@/lib/categoryUtils';
import {
    isValidAmount, isValidType, isValidDate,
    sanitizeCategory, sanitizeDescription,
    clampPaginationLimit, clampPaginationOffset
} from '@/lib/validation';

async function ensureCustomCategory(userId: number, type: string, categoryName: string) {
    const name = categoryName.trim().replace(/\s+/g, ' ');
    if (!name || isStandardCategory(name)) return;

    const existing = await queryOne<{ id: number }>(
        'SELECT id FROM custom_categories WHERE user_id = ? AND type = ? AND LOWER(name) = LOWER(?) LIMIT 1',
        [userId, type, name]
    );

    if (existing) return;

    try {
        await run(
            'INSERT INTO custom_categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
            [userId, name, type, resolveIcon(name), resolveColor(name)]
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!message.includes('UNIQUE constraint failed')) throw error;
    }
}

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('start');
        const endDate = searchParams.get('end');
        const category = searchParams.get('category');
        const type = searchParams.get('type');
        const limit = clampPaginationLimit(searchParams.get('limit') || '100');
        const offset = clampPaginationOffset(searchParams.get('offset') || '0');

        // Validate optional filter params
        if (startDate && !isValidDate(startDate)) {
            return NextResponse.json({ error: 'Invalid start date format (YYYY-MM-DD)' }, { status: 400 });
        }
        if (endDate && !isValidDate(endDate)) {
            return NextResponse.json({ error: 'Invalid end date format (YYYY-MM-DD)' }, { status: 400 });
        }
        if (type && !isValidType(type)) {
            return NextResponse.json({ error: 'Invalid type (must be expense or earning)' }, { status: 400 });
        }

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

        const body = await request.json();
        const type = body.type;
        const amount = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
        const description = sanitizeDescription(body.description);
        const notes = sanitizeDescription(body.notes || '');
        const date = body.date || new Date().toISOString().split('T')[0];

        if (!isValidType(type)) {
            return NextResponse.json({ error: 'Type must be "expense" or "earning"' }, { status: 400 });
        }
        if (!isValidAmount(amount)) {
            return NextResponse.json({ error: 'Amount must be a positive number (max 999,999,999)' }, { status: 400 });
        }
        if (date && !isValidDate(date)) {
            return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
        }

        const categoryName = sanitizeCategory(body.category);
        await ensureCustomCategory(session.userId, type, categoryName);

        const result = await run(
            'INSERT INTO transactions (user_id, type, amount, category, description, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [session.userId, type, amount, categoryName, description, date, notes]
        );

        await maybeCreateBudgetAlert({
            userId: session.userId,
            type,
            amount,
            category: categoryName,
            date,
        });

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

        const numId = parseInt(id, 10);
        if (!Number.isFinite(numId) || numId < 1) {
            return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
        }

        await run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [numId, session.userId]);
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

        const body = await request.json();
        const id = body.id;
        const type = body.type;
        const amount = typeof body.amount === 'string' ? parseFloat(body.amount) : body.amount;
        const description = sanitizeDescription(body.description);
        const notes = sanitizeDescription(body.notes || '');
        const date = body.date || new Date().toISOString().split('T')[0];

        if (!id || typeof id !== 'number') {
            return NextResponse.json({ error: 'Valid ID is required' }, { status: 400 });
        }
        if (!isValidType(type)) {
            return NextResponse.json({ error: 'Type must be "expense" or "earning"' }, { status: 400 });
        }
        if (!isValidAmount(amount)) {
            return NextResponse.json({ error: 'Amount must be a positive number (max 999,999,999)' }, { status: 400 });
        }
        if (date && !isValidDate(date)) {
            return NextResponse.json({ error: 'Invalid date format (YYYY-MM-DD)' }, { status: 400 });
        }

        const categoryName = sanitizeCategory(body.category);
        await ensureCustomCategory(session.userId, type, categoryName);

        const result = await run(
            'UPDATE transactions SET type = ?, amount = ?, category = ?, description = ?, date = ?, notes = ? WHERE id = ? AND user_id = ?',
            [type, amount, categoryName, description, date, notes, id, session.userId]
        );

        if (result.rowsAffected === 0) {
            return NextResponse.json({ error: 'Transaction not found or unauthorized' }, { status: 404 });
        }

        await maybeCreateBudgetAlert({
            userId: session.userId,
            type,
            amount,
            category: categoryName,
            date,
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Transaction update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
