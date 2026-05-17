import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { queryAll, run } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const notifications = await queryAll(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [session.userId]
        );
        const unreadCount = await queryAll<{ count: number }>(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0',
            [session.userId]
        );
        return NextResponse.json({ notifications, unreadCount: unreadCount[0]?.count || 0 });
    } catch (error) {
        console.error('Notifications error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const { id, markAll } = await request.json();
        if (markAll) {
            await run('UPDATE notifications SET read = 1 WHERE user_id = ?', [session.userId]);
        } else if (id) {
            await run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [id, session.userId]);
        }
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Notification update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        if (body.clearAll) {
            await run('DELETE FROM notifications WHERE user_id = ?', [session.userId]);
        } else if (body.id) {
            await run('DELETE FROM notifications WHERE id = ? AND user_id = ?', [body.id, session.userId]);
        } else {
            return NextResponse.json({ error: 'id or clearAll required' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Notification delete error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
