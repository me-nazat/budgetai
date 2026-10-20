export const dynamic = 'force-dynamic';

/**
 * @fileoverview Action Undo API Route (Module 19).
 * POST /api/chat/undo/[id] — Reverses an executed autonomous tool action
 * using the captured inverse operation payload within the allowable window.
 * Supports both numeric chatToolExecutions.id and string agentActionLogs.id (act_...).
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
  accounts,
  automationRules,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const POST = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(
    async (_request: NextRequest, { userId }, context) => {
      try {
        const { id } = await context.params;

        let inverse: any = null;
        let toolName = 'ACTION';
        let executionIdNum: number | null = null;
        let actionLogIdStr: string | null = null;

        // Check if numeric execution ID or string actionLog ID
        if (id.startsWith('act_')) {
          actionLogIdStr = id;
          const [log] = await db
            .select()
            .from(agentActionLogs)
            .where(
              and(
                eq(agentActionLogs.id, id),
                eq(agentActionLogs.userId, userId)
              )
            );

          if (!log) {
            return NextResponse.json({ error: 'Action log record not found' }, { status: 404 });
          }

          if (log.status === 'ROLLED_BACK') {
            return NextResponse.json(
              { error: 'Action has already been rolled back.' },
              { status: 400 }
            );
          }

          toolName = log.actionType;
          try {
            const parsed = JSON.parse(log.payloadJson);
            inverse = parsed.previousStateJson || parsed;
          } catch {
            return NextResponse.json({ error: 'Corrupt action log payload' }, { status: 500 });
          }
        } else {
          executionIdNum = parseInt(id, 10);
          if (isNaN(executionIdNum)) {
            return NextResponse.json({ error: 'Invalid execution identifier' }, { status: 400 });
          }

          const [execution] = await db
            .select()
            .from(chatToolExecutions)
            .where(
              and(
                eq(chatToolExecutions.id, executionIdNum),
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

          toolName = execution.toolName;
          inverse = JSON.parse(execution.inverseOperationPayloadJson);
        }

        if (!inverse || !inverse.action) {
          return NextResponse.json({ error: 'Invalid inverse rollback instructions' }, { status: 400 });
        }

        // ── Execute Inverse Rollback ──
        if (inverse.action === 'delete_transaction' && inverse.transactionId) {
          await db
            .delete(transactions)
            .where(
              and(
                eq(transactions.id, inverse.transactionId),
                eq(transactions.userId, userId)
              )
            );

          // Revert account balance adjustment if account was targeted
          if (inverse.accountId && inverse.amount) {
            const isEarning = inverse.type === 'earning' || inverse.type === 'income';
            const delta = isEarning ? -inverse.amount : inverse.amount;
            await db
              .update(accounts)
              .set({ currentBalance: sql`${accounts.currentBalance} + ${delta}` })
              .where(
                and(
                  eq(accounts.id, inverse.accountId),
                  eq(accounts.userId, userId)
                )
              );
          }
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
        } else if (inverse.action === 'reverse_transfer') {
          const { fromAccountId, toAccountId, amount, fromTxId, toTxId } = inverse;
          if (fromAccountId && toAccountId && amount) {
            // Move funds back: credit fromAccount, debit toAccount
            await db
              .update(accounts)
              .set({ currentBalance: sql`${accounts.currentBalance} + ${amount}` })
              .where(and(eq(accounts.id, fromAccountId), eq(accounts.userId, userId)));

            await db
              .update(accounts)
              .set({ currentBalance: sql`${accounts.currentBalance} - ${amount}` })
              .where(and(eq(accounts.id, toAccountId), eq(accounts.userId, userId)));
          }

          // Remove transfer transactions
          if (fromTxId) {
            await db.delete(transactions).where(and(eq(transactions.id, fromTxId), eq(transactions.userId, userId)));
          }
          if (toTxId) {
            await db.delete(transactions).where(and(eq(transactions.id, toTxId), eq(transactions.userId, userId)));
          }
        } else if (inverse.action === 'delete_automation_rule' && inverse.ruleId) {
          await db
            .delete(automationRules)
            .where(
              and(
                eq(automationRules.id, inverse.ruleId),
                eq(automationRules.userId, userId)
              )
            );
        }

        // Update status of execution and logs
        if (executionIdNum) {
          await db
            .update(chatToolExecutions)
            .set({ status: 'cancelled' })
            .where(eq(chatToolExecutions.id, executionIdNum));
        }

        if (actionLogIdStr) {
          await db
            .update(agentActionLogs)
            .set({
              status: 'ROLLED_BACK',
              executedAt: Math.floor(Date.now() / 1000),
            })
            .where(eq(agentActionLogs.id, actionLogIdStr));
        }

        // Audit log in agent_action_logs
        await db.insert(agentActionLogs).values({
          id: `act_${randomUUID()}`,
          userId,
          actionType: `UNDO_${toolName}`,
          payloadJson: JSON.stringify(inverse),
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
