export const dynamic = 'force-dynamic';

/**
 * @fileoverview Legacy AI Coach Endpoint wrapper (delegating to unified AI service).
 * Routes legacy coach calls to the deterministic financial context and AI processing engine.
 *
 * @module api/coach
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import * as jose from 'jose';
import { getFinancialContextBundle } from '@/lib/financialContext';
import { processMessage } from '@/lib/ai';
import { run, queryAll } from '@/lib/db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-key-for-dev');

async function getUserId() {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;
    if (!token) return null;
    try {
        const { payload } = await jose.jwtVerify(token, JWT_SECRET);
        return payload.userId as number;
    } catch {
        return null;
    }
}

export async function GET() {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const history = await queryAll(
            'SELECT * FROM coach_messages WHERE user_id = ? ORDER BY created_at ASC',
            [userId]
        );
        return NextResponse.json({ messages: history });
    } catch {
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    const userId = await getUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json().catch(() => ({}));
        const message = String(body.message || '');
        if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

        // Record in coach_messages table for legacy callers
        await run(
            'INSERT INTO coach_messages (user_id, role, content) VALUES (?, ?, ?)',
            [userId, 'user', message]
        ).catch(() => {});

        // Record in chat_messages as well
        const sessionId = `coach_${Date.now()}`;
        await run(
            'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
            [userId, 'user', message, 'chat', sessionId]
        ).catch(() => {});

        // Call unified deterministic financial context
        const contextBundle = await getFinancialContextBundle(userId, sessionId);
        const today = new Date().toISOString().split('T')[0];

        const aiResponse = await processMessage(
            message,
            contextBundle.context,
            contextBundle.budgetContext,
            today,
            contextBundle.profile ? {
                name: contextBundle.profile.name,
                currency: contextBundle.profile.currency,
                locale: contextBundle.profile.locale,
            } : undefined
        );

        const reply = aiResponse.message || "I've analyzed your financial situation.";

        await run(
            'INSERT INTO coach_messages (user_id, role, content) VALUES (?, ?, ?)',
            [userId, 'assistant', reply]
        ).catch(() => {});

        await run(
            'INSERT INTO chat_messages (user_id, role, content, mode, session_id) VALUES (?, ?, ?, ?, ?)',
            [userId, 'assistant', reply, 'chat', sessionId]
        ).catch(() => {});

        return NextResponse.json({
            response: reply,
            message: reply,
            financialData: aiResponse.financialData || [],
            actions: aiResponse.actions || [],
            snapshot: contextBundle.snapshot,
        });

    } catch (e) {
        console.error('Coach delegation error:', e);
        return NextResponse.json({ error: 'Failed to process coach message' }, { status: 500 });
    }
}
