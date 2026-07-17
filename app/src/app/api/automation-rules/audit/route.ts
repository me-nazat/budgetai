export const dynamic = 'force-dynamic';

/**
 * @fileoverview Automation audit log API.
 *
 * GET — List recent automation actions with undo capability
 * POST — Undo a specific automation action
 *
 * @module api/automation-rules/audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { automationAuditLog, automationRules } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { queryOne } from '@/lib/db';

const UndoSchema = z.object({
  auditLogId: z.number().int().positive(),
});

/**
 * GET /api/automation-rules/audit
 * Returns the last 50 automation actions.
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const logs = await db
      .select({
        id: automationAuditLog.id,
        ruleId: automationAuditLog.ruleId,
        transactionId: automationAuditLog.transactionId,
        actionPerformed: automationAuditLog.actionPerformed,
        previousValue: automationAuditLog.previousValue,
        newValue: automationAuditLog.newValue,
        undone: automationAuditLog.undone,
        createdAt: automationAuditLog.createdAt,
        ruleName: automationRules.name,
      })
      .from(automationAuditLog)
      .leftJoin(automationRules, eq(automationAuditLog.ruleId, automationRules.id))
      .where(eq(automationAuditLog.userId, userId))
      .orderBy(desc(automationAuditLog.createdAt))
      .limit(50);

    return NextResponse.json({ auditLog: logs });
  })
);

/**
 * POST /api/automation-rules/audit
 * Undo a specific automation action — reverts the transaction's category.
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const { auditLogId } = UndoSchema.parse(body);

    // Get the audit log entry
    const [entry] = await db
      .select()
      .from(automationAuditLog)
      .where(
        and(
          eq(automationAuditLog.id, auditLogId),
          eq(automationAuditLog.userId, userId)
        )
      )
      .limit(1);

    if (!entry) {
      return NextResponse.json({ error: 'Audit log entry not found' }, { status: 404 });
    }

    if (entry.undone) {
      return NextResponse.json({ error: 'Action already undone' }, { status: 409 });
    }

    // Revert the transaction's category
    if (entry.transactionId && entry.previousValue) {
      const { run } = await import('@/lib/db');
      await run(
        'UPDATE transactions SET category = ? WHERE id = ? AND user_id = ?',
        [entry.previousValue, entry.transactionId, userId]
      );
    }

    // Mark as undone
    await db
      .update(automationAuditLog)
      .set({ undone: 1 })
      .where(eq(automationAuditLog.id, auditLogId));

    return NextResponse.json({ message: 'Action undone successfully' });
  })
);
