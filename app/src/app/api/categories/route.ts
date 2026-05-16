import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, run } from '@/lib/db';
import { resolveIcon, resolveColor } from '@/lib/categoryUtils';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // optional: 'expense' | 'earning'

        let sql = 'SELECT * FROM custom_categories WHERE user_id = ?';
        const params: unknown[] = [session.userId];

        if (type) {
            sql += ' AND type = ?';
            params.push(type);
        }

        sql += ' ORDER BY created_at DESC';

        const categories = await queryAll(sql, params);
        return NextResponse.json({ categories });
    } catch (error) {
        console.error('Custom categories GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { name, type, icon, color } = await request.json();
        
        if (!name || !type) {
            return NextResponse.json({ error: 'Name and type are required' }, { status: 400 });
        }

        // Smart defaults: auto-resolve icon & color from category name if not provided
        const resolvedIcon = (icon && icon !== 'category') ? icon : resolveIcon(name);
        const resolvedColor = (color && color !== 'gray') ? color : resolveColor(name);

        const result = await run(
            'INSERT INTO custom_categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
            [session.userId, name, type, resolvedIcon, resolvedColor]
        );

        return NextResponse.json({ 
            id: result.lastInsertRowid, 
            icon: resolvedIcon,
            color: resolvedColor,
            success: true 
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (message.includes('UNIQUE constraint failed')) {
            return NextResponse.json({ error: 'Category already exists' }, { status: 400 });
        }
        console.error('Custom categories POST error:', error);
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

        await run('DELETE FROM custom_categories WHERE id = ? AND user_id = ?', [id, session.userId]);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Custom categories DELETE error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
