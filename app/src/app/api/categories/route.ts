export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll, queryOne, run } from '@/lib/db';
import { resolveIcon, resolveColor, UNIFIED_DEFAULT_CATEGORIES } from '@/lib/categoryUtils';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // optional: 'expense' | 'earning' | 'all'

        let sql = 'SELECT * FROM custom_categories WHERE user_id = ?';
        const params: unknown[] = [session.userId];

        if (type && type !== 'all') {
            sql += ' AND type = ?';
            params.push(type);
        }

        sql += ' ORDER BY created_at DESC';

        const customRows = await queryAll<{
            id: number;
            name: string;
            type: string;
            icon?: string;
            color?: string;
        }>(sql, params);

        const customList = customRows.map((c) => ({
            id: c.id,
            name: c.name,
            type: c.type,
            icon: c.icon || resolveIcon(c.name),
            color: c.color || resolveColor(c.name),
            group: c.type === 'earning' || c.type === 'income' ? 'Income' : 'Lifestyle',
            isCustom: true,
        }));

        const defaultList = UNIFIED_DEFAULT_CATEGORIES
            .filter((c) => {
                if (!type || type === 'all') return true;
                if (type === 'expense') return c.type === 'expense';
                if (type === 'earning' || type === 'income') return c.type === 'income';
                if (type === 'transfer') return c.type === 'transfer';
                return true;
            })
            .map((c) => ({
                id: c.id,
                name: c.name,
                type: c.type === 'income' ? 'earning' : c.type,
                icon: c.icon,
                color: c.color,
                group: c.group,
                isCustom: false,
            }));

        const customNames = new Set(customList.map((c) => c.name.toLowerCase()));
        const combined = [
            ...customList,
            ...defaultList.filter((d) => !customNames.has(d.name.toLowerCase())),
        ];

        return NextResponse.json({
            categories: combined,
            customCategories: customList,
            defaultCategories: defaultList,
        });
    } catch (error) {
        console.error('Categories GET error:', error);
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

        const trimmedName = String(name).trim().replace(/\s+/g, ' ');
        const existing = await queryOne<{ id: number; name: string; icon: string; color: string }>(
            'SELECT id, name, icon, color FROM custom_categories WHERE user_id = ? AND type = ? AND LOWER(name) = LOWER(?) LIMIT 1',
            [session.userId, type, trimmedName]
        );

        // Smart defaults: auto-resolve icon & color from category name if not provided
        const resolvedIcon = (icon && icon !== 'category') ? icon : resolveIcon(trimmedName);
        const resolvedColor = (color && color !== 'gray') ? color : resolveColor(trimmedName);

        if (existing) {
            await run(
                'UPDATE custom_categories SET icon = ?, color = ? WHERE id = ? AND user_id = ?',
                [resolvedIcon || existing.icon, resolvedColor || existing.color, existing.id, session.userId]
            );

            return NextResponse.json({
                id: existing.id,
                name: existing.name,
                icon: resolvedIcon || existing.icon,
                color: resolvedColor || existing.color,
                existing: true,
                success: true
            });
        }

        const result = await run(
            'INSERT INTO custom_categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
            [session.userId, trimmedName, type, resolvedIcon, resolvedColor]
        );

        return NextResponse.json({ 
            id: result.lastInsertRowid, 
            name: trimmedName,
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

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id, name, type, icon, color } = await request.json();
        const trimmedName = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ') : '';

        if (!id && (!trimmedName || !type)) {
            return NextResponse.json({ error: 'ID or name/type are required' }, { status: 400 });
        }

        const existing = id
            ? await queryOne<{ id: number; name: string; icon: string; color: string }>(
                'SELECT id, name, icon, color FROM custom_categories WHERE id = ? AND user_id = ? LIMIT 1',
                [id, session.userId]
            )
            : await queryOne<{ id: number; name: string; icon: string; color: string }>(
                'SELECT id, name, icon, color FROM custom_categories WHERE user_id = ? AND type = ? AND LOWER(name) = LOWER(?) LIMIT 1',
                [session.userId, type, trimmedName]
            );

        if (!existing) {
            return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        const nextIcon = icon || existing.icon || resolveIcon(existing.name);
        const nextColor = color || existing.color || resolveColor(existing.name);

        await run(
            'UPDATE custom_categories SET icon = ?, color = ? WHERE id = ? AND user_id = ?',
            [nextIcon, nextColor, existing.id, session.userId]
        );

        return NextResponse.json({
            id: existing.id,
            name: existing.name,
            icon: nextIcon,
            color: nextColor,
            success: true
        });
    } catch (error) {
        console.error('Custom categories PUT error:', error);
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
