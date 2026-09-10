export const dynamic = 'force-dynamic';

/**
 * @fileoverview Agentic AI Action Approval / Execution API Route (Module 19).
 * POST /api/chat/action — Approves or rejects a staged action in agent_action_logs.
 * Reuses the 'aiChat' rate limiter (20 requests/minute).
 *
 * @module api/chat/action
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { executeApprovedAgentAction } from '@/lib/chatActions';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    let body: { actionLogId?: string; approved?: boolean };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { actionLogId, approved } = body;

    if (!actionLogId) {
      return NextResponse.json({ error: 'actionLogId is required' }, { status: 400 });
    }

    const result = await executeApprovedAgentAction(
      actionLogId,
      userId,
      Boolean(approved)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.detail, status: result.status },
        { status: result.status === 'NOT_FOUND' ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      detail: result.detail,
      count: result.count ?? 0,
    });
  }),
  { rateLimit: 'aiChat' }
);
