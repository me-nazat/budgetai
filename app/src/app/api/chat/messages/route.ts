import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll } from '@/lib/db';

export async function GET(request: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('sessionId');

        if (!sessionId) {
            return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
        }

        const messages = await queryAll<{
            id: number;
            role: string;
            content: string;
            mode: string;
            created_at: string;
        }>(
            'SELECT id, role, content, mode, created_at FROM chat_messages WHERE user_id = ? AND session_id = ? ORDER BY created_at ASC',
            [session.userId, sessionId]
        );

        return NextResponse.json({ messages });
    } catch (error) {
        console.error('Chat messages error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
