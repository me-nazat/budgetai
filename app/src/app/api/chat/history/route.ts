export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { queryAll } from '@/lib/db';

export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get all unique sessions with their latest message
        const sessions = await queryAll<{
            session_id: string;
            latest_content: string;
            latest_time: string;
            message_count: number;
        }>(
            `SELECT session_id, 
        (SELECT content FROM chat_messages cm2 WHERE cm2.session_id = cm.session_id AND cm2.user_id = ? ORDER BY created_at DESC LIMIT 1) as latest_content,
        MAX(created_at) as latest_time,
        COUNT(*) as message_count
      FROM chat_messages cm 
      WHERE user_id = ? AND session_id IS NOT NULL
      GROUP BY session_id 
      ORDER BY latest_time DESC`,
            [session.userId, session.userId]
        );

        return NextResponse.json({ sessions });
    } catch (error) {
        console.error('Chat history error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
