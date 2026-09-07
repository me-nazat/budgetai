export const dynamic = 'force-dynamic';

/**
 * @fileoverview Action Undo API Route (Module 19).
 * POST /api/chat/undo/[id] — Reverses an executed autonomous tool action
 * using the captured inverse operation payload within the allowable window.
 *
 * @module api/chat/undo/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  chatToolExecutions,
  agentActionLogs,
  transactions,
  budgets,
  savingsGoals,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const POST = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(
    async (_request: NextRequest, { userId }, context) => {
      try {
        const { id } = await context.params;
        const executionId = parseInt(id, 10);

        if (isNaN(executionId)) {
          return NextResponse.json({ error: 'Invalid execution identifier' }, { status: 400 });
        }

        const [execution] = await db
          .select()
          .from(chatToolExecutions)
          .where(
            and(
              eq(chatToolExecutions.id, executionId),
              eq(chatToolExecutions.userId, userId)
            )
          );

        if (!execution) {
          return NextResponse.json({ error: 'Tool execution record not found' }, { status: 404 });
        }

        if (execution.status !== 'executed') {
          return NextResponse.json(
            { error: `Action in status '${execution.status}' cannot be rolled back.` },
            { status: 400 }
          );
        }

        if (!execution.inverseOperationPayloadJson) {
          return NextResponse.json(
            { error: 'No inverse rollback instructions registered for this action.' },
            { status: 400 }
          );
        }

        const inverse = JSON.parse(execution.inverseOperationPayloadJson);

        // Execute inverse rollback
        if (inverse.action === 'delete_transaction' && inverse.transactionId) {
          await db
            .delete(transactions)
            .where(
              and(
                eq(transactions.id, inverse.transactionId),
                eq(transactions.userId, userId)
              )
            );
        } else if (inverse.action === 'restore_budget' && inverse.budgetId) {
          if (inverse.previousMonthlyLimit !== null && inverse.previousMonthlyLimit !== undefined) {
            await db
              .update(budgets)
              .set({ monthlyLimit: inverse.previousMonthlyLimit })
              .where(
                and(
                  eq(budgets.id, inverse.budgetId),
                  eq(budgets.userId, userId)
                )
              );
          } else {
            // Budget was newly created; delete it
            await db
              .delete(budgets)
              .where(
                and(
                  eq(budgets.id, inverse.budgetId),
                  eq(budgets.userId, userId)
                )
              );
          }
        } else if (inverse.action === 'delete_goal' && inverse.goalId) {
          await db
            .delete(savingsGoals)
            .where(
              and(
                eq(savingsGoals.id, inverse.goalId),
                eq(savingsGoals.userId, userId)
              )
            );
        }

        // Update status to cancelled
        await db
          .update(chatToolExecutions)
          .set({ status: 'cancelled' })
          .where(eq(chatToolExecutions.id, executionId));

        // Audit log in agent_action_logs
        await db.insert(agentActionLogs).values({
          id: `act_${randomUUID()}`,
          userId,
          actionType: `UNDO_${execution.toolName}`,
          payloadJson: execution.inverseOperationPayloadJson,
          status: 'ROLLED_BACK',
          executedAt: Math.floor(Date.now() / 1000),
          createdAt: sql`(unixepoch())`,
        });

        return NextResponse.json({
          success: true,
          status: 'cancelled',
          message: 'Action successfully rolled back.',
        });
      } catch (err: any) {
        console.error('Error undoing chat action:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to rollback action' },
          { status: 500 }
        );
      }
    }
  )
);
