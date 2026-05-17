import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { run } from '@/lib/db';
import { DataAction, ParsedFinancialData } from '@/lib/ai';
import { getFinancialContextBundle } from '@/lib/financialContext';
import { processDataActions, storeFinancialData } from '@/lib/chatActions';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const financialData = Array.isArray(body.financialData) ? body.financialData as ParsedFinancialData[] : [];
        const actions = Array.isArray(body.actions) ? body.actions as DataAction[] : [];
        const sessionId = typeof body.sessionId === 'string' ? body.sessionId : `session_${Date.now()}`;
        const mode = body.mode === 'silent' ? 'silent' : 'chat';
        const today = new Date().toISOString().split('T')[0];
        const contextBundle = await getFinancialContextBundle(session.userId, sessionId);

        const [transactions, actionResults] = await Promise.all([
            storeFinancialData(financialData, session.userId, today, contextBundle.currencySymbol),
            processDataActions(actions, session.userId),
        ]);

        const details: string[] = [];
        if (transactions.length > 0) {
            details.push(`${transactions.length} transaction${transactions.length === 1 ? '' : 's'} saved`);
        }
        if (actionResults.length > 0) {
            details.push(...actionResults.map(r => r.detail));
        }

        const message = details.length > 0
            ? `Confirmed and saved: ${details.join(' | ')}`
            : 'Nothing new was saved from that attachment.';

        await run(
            'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
            [session.userId, 'system', message, mode, sessionId]
        );

        return NextResponse.json({
            message,
            transactions,
            actionResults,
            sessionId,
            mode,
        });
    } catch (error) {
        console.error('Chat confirmation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

