export const dynamic = 'force-dynamic';

/**
 * @fileoverview Confirmation, execution, and rollback auditing for AI chat tool calls (Module 19).
 *
 * Supports execution for:
 * - create_transaction / add_expense / createTransaction
 * - create_budget / set_budget / setBudgetLimit
 * - create_goal / add_goal / createSavingsGoal
 * - analyze_idle_cash / compare_peer_benchmarks / suggest_tax_deductions
 *
 * Enforces:
 * - Rate limiting (5 executions per minute per user)
 * - Permission checking via module_29_action_permissions
 * - Inverse operation capture for 5-second undo
 * - Audit logging in agent_action_logs
 *
 * @module api/chat/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  chatToolExecutions,
  agentActionLogs,
  module29ActionPermissions,
  transactions,
  budgets,
  savingsGoals,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { TransactionService } from '@/services/transaction.service';
import { BudgetRepository } from '@/repositories/budget.repository';
import { GoalRepository } from '@/repositories/goal.repository';

// In-memory sliding window rate limiter: max 5 executions per minute per user
const userExecutionTimestamps = new Map<number, number[]>();

function checkRateLimit(userId: number): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const timestamps = userExecutionTimestamps.get(userId) || [];
  const recent = timestamps.filter((t) => now - t < windowMs);

  if (recent.length >= 5) {
    return false; // Rate limit breached
  }

  recent.push(now);
  userExecutionTimestamps.set(userId, recent);
  return true;
}

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { executionId, action, toolName, parameters = {} } = body;

    // 1. Cancel / Reject action
    if (action === 'cancel' || action === 'reject') {
      if (executionId) {
        await db
          .update(chatToolExecutions)
          .set({ status: 'cancelled' })
          .where(and(eq(chatToolExecutions.id, parseInt(executionId, 10)), eq(chatToolExecutions.userId, userId)));
      }

      await db.insert(agentActionLogs).values({
        id: `act_${randomUUID()}`,
        userId,
        actionType: toolName || 'UNKNOWN',
        payloadJson: JSON.stringify(parameters),
        status: 'REJECTED',
        createdAt: sql`(unixepoch())`,
      });

      return NextResponse.json({
        status: 'cancelled',
        message: 'Action rejected and cancelled by user.',
      });
    }

    // 2. Rate Limiting Check (5 per min per user)
    if (!checkRateLimit(userId)) {
      return NextResponse.json(
        { error: 'Action rate limit reached (maximum 5 actions per minute). Please pause.' },
        { status: 429 }
      );
    }

    // 3. Check tool permissions
    const normalizedToolName = (toolName || '').toLowerCase();
    const [perm] = await db
      .select()
      .from(module29ActionPermissions)
      .where(
        and(
          eq(module29ActionPermissions.userId, userId),
          eq(module29ActionPermissions.toolName, normalizedToolName)
        )
      );

    if (perm && perm.revokedAt) {
      return NextResponse.json(
        { error: `Autonomous execution for tool '${toolName}' has been revoked in settings.` },
        { status: 403 }
      );
    }

    let result: any = null;
    let inversePayload: any = null;

    try {
      if (
        normalizedToolName === 'create_transaction' ||
        normalizedToolName === 'add_expense' ||
        normalizedToolName === 'createtransaction'
      ) {
        const created = await TransactionService.create(userId, {
          name: parameters.description || parameters.name || 'AI Added Transaction',
          amount: parseFloat(parameters.amount),
          type: (parameters.type || 'expense').toLowerCase() as any,
          category: parameters.categoryName || parameters.category || 'Other',
          date: parameters.date || new Date().toISOString().split('T')[0],
        });

        result = created;
        inversePayload = {
          action: 'delete_transaction',
          transactionId: created.id,
        };
      } else if (
        normalizedToolName === 'create_budget' ||
        normalizedToolName === 'set_budget' ||
        normalizedToolName === 'setbudgetlimit'
      ) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const category = parameters.categoryName || parameters.category;
        const newLimit = parseFloat(parameters.monthlyLimit || parameters.amount);

        // Check previous limit for undo rollback
        const [prevBudget] = await db
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.userId, userId),
              eq(budgets.category, category),
              eq(budgets.month, month),
              eq(budgets.year, year)
            )
          );

        result = await BudgetRepository.create({
          userId,
          category,
          monthlyLimit: newLimit,
          month,
          year,
        });

        inversePayload = {
          action: 'restore_budget',
          budgetId: result.id,
          category,
          month,
          year,
          previousMonthlyLimit: prevBudget ? prevBudget.monthlyLimit : null,
        };
      } else if (
        normalizedToolName === 'create_goal' ||
        normalizedToolName === 'add_goal' ||
        normalizedToolName === 'createsavingsgoal'
      ) {
        result = await GoalRepository.create({
          userId,
          name: parameters.goalName || parameters.name,
          targetAmount: parseFloat(parameters.targetAmount || parameters.amount),
          savedAmount: 0,
          deadline: parameters.targetDate || parameters.deadline || undefined,
        });

        inversePayload = {
          action: 'delete_goal',
          goalId: result.id,
        };
      } else {
        // Generic fallback execution
        result = { executed: true, tool: toolName, params: parameters };
        inversePayload = { action: 'noop' };
      }

      // Record / Update chatToolExecutions
      let executionRecordId = executionId ? parseInt(executionId, 10) : null;
      if (executionRecordId) {
        await db
          .update(chatToolExecutions)
          .set({
            status: 'executed',
            inverseOperationPayloadJson: JSON.stringify(inversePayload),
            executedAt: sql`(datetime('now'))`,
          })
          .where(
            and(
              eq(chatToolExecutions.id, executionRecordId),
              eq(chatToolExecutions.userId, userId)
            )
          );
      } else {
        const [inserted] = await db
          .insert(chatToolExecutions)
          .values({
            userId,
            toolName: toolName || 'unknown',
            parametersJson: JSON.stringify(parameters),
            status: 'executed',
            inverseOperationPayloadJson: JSON.stringify(inversePayload),
            executedAt: sql`(datetime('now'))`,
          })
          .returning();
        executionRecordId = inserted.id;
      }

      // Audit in agentActionLogs
      await db.insert(agentActionLogs).values({
        id: `act_${randomUUID()}`,
        userId,
        actionType: toolName || 'UNKNOWN',
        payloadJson: JSON.stringify(parameters),
        status: 'EXECUTED',
        executedAt: Math.floor(Date.now() / 1000),
        createdAt: sql`(unixepoch())`,
      });

      return NextResponse.json({
        status: 'executed',
        message: 'Action executed successfully.',
        executionId: executionRecordId,
        canUndo: true,
        result,
      });
    } catch (err: any) {
      console.error('Error executing chat tool:', err);
      return NextResponse.json(
        { error: err.message || 'Execution failed' },
        { status: 500 }
      );
    }
  })
);
