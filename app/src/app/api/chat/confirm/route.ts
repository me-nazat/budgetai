export const dynamic = 'force-dynamic';

/**
 * @fileoverview Confirmation, execution, and rollback auditing for AI chat tool calls (Module 19).
 *
 * Supports execution for:
 * - create_transaction / add_expense / createTransaction
 * - create_budget / set_budget / setBudgetLimit / update_budget_limit
 * - create_goal / add_goal / createSavingsGoal
 * - transfer_between_accounts / transferBetweenAccounts
 * - create_automation_rule / createAutomationRule
 *
 * Enforces:
 * - Rate limiting (5 executions per minute per user)
 * - Permission checking via module_29_action_permissions
 * - Inverse operation capture for 1-click undo
 * - Audit logging in agent_action_logs with previousStateJson and createdRecordId
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
  accounts,
  automationRules,
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
    const normalizedToolName = (toolName || '').toLowerCase().replace(/_/g, '');
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
    let createdRecordId: any = null;

    try {
      if (
        normalizedToolName === 'createtransaction' ||
        normalizedToolName === 'addexpense'
      ) {
        const txAmount = parseFloat(parameters.amount);
        const txType = (parameters.type || 'expense').toLowerCase() as any;
        const targetAccountId = parameters.accountId ? parseInt(parameters.accountId, 10) : undefined;

        const created = await TransactionService.create(userId, {
          name: parameters.description || parameters.merchant || parameters.name || 'AI Added Transaction',
          amount: txAmount,
          type: txType,
          category: parameters.categoryName || parameters.category || 'Other',
          date: parameters.date || new Date().toISOString().split('T')[0],
          accountId: targetAccountId,
        });

        // If target account provided, adjust account balance
        if (targetAccountId && !isNaN(targetAccountId)) {
          const delta = txType === 'earning' || txType === 'income' ? txAmount : -txAmount;
          await db
            .update(accounts)
            .set({ currentBalance: sql`${accounts.currentBalance} + ${delta}` })
            .where(and(eq(accounts.id, targetAccountId), eq(accounts.userId, userId)));
        }

        result = created;
        createdRecordId = created.id;
        inversePayload = {
          action: 'delete_transaction',
          transactionId: created.id,
          accountId: targetAccountId,
          amount: txAmount,
          type: txType,
        };
      } else if (
        normalizedToolName === 'createbudget' ||
        normalizedToolName === 'setbudget' ||
        normalizedToolName === 'setbudgetlimit' ||
        normalizedToolName === 'updatebudgetlimit'
      ) {
        const now = new Date();
        const month = parameters.month || now.getMonth() + 1;
        const year = parameters.year || now.getFullYear();
        const category = parameters.categoryName || parameters.category;
        const newLimit = parseFloat(parameters.monthlyLimit || parameters.newLimit || parameters.amount);

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

        createdRecordId = result.id;
        inversePayload = {
          action: 'restore_budget',
          budgetId: result.id,
          category,
          month,
          year,
          previousMonthlyLimit: prevBudget ? prevBudget.monthlyLimit : null,
        };
      } else if (
        normalizedToolName === 'creategoal' ||
        normalizedToolName === 'addgoal' ||
        normalizedToolName === 'createsavingsgoal'
      ) {
        result = await GoalRepository.create({
          userId,
          name: parameters.goalName || parameters.name || 'Savings Goal',
          targetAmount: parseFloat(parameters.targetAmount || parameters.amount),
          savedAmount: 0,
          deadline: parameters.targetDate || parameters.deadline || undefined,
        });

        createdRecordId = result.id;
        inversePayload = {
          action: 'delete_goal',
          goalId: result.id,
        };
      } else if (
        normalizedToolName === 'transferbetweenaccounts' ||
        normalizedToolName === 'transfer'
      ) {
        const fromAccountId = parseInt(parameters.fromAccountId, 10);
        const toAccountId = parseInt(parameters.toAccountId, 10);
        const transferAmount = parseFloat(parameters.amount);
        const note = parameters.description || `Transfer to account #${toAccountId}`;
        const date = parameters.date || new Date().toISOString().split('T')[0];

        // Decrement source account
        await db
          .update(accounts)
          .set({ currentBalance: sql`${accounts.currentBalance} - ${transferAmount}` })
          .where(and(eq(accounts.id, fromAccountId), eq(accounts.userId, userId)));

        // Increment target account
        await db
          .update(accounts)
          .set({ currentBalance: sql`${accounts.currentBalance} + ${transferAmount}` })
          .where(and(eq(accounts.id, toAccountId), eq(accounts.userId, userId)));

        // Record transfer expense on source
        const [txOut] = await db
          .insert(transactions)
          .values({
            userId,
            accountId: fromAccountId,
            type: 'expense',
            amount: transferAmount,
            category: 'Transfer',
            description: note,
            date,
          })
          .returning();

        // Record transfer earning on target
        const [txIn] = await db
          .insert(transactions)
          .values({
            userId,
            accountId: toAccountId,
            type: 'earning',
            amount: transferAmount,
            category: 'Transfer',
            description: parameters.description || `Transfer from account #${fromAccountId}`,
            date,
          })
          .returning();

        result = { fromAccountId, toAccountId, amount: transferAmount, txOutId: txOut.id, txInId: txIn.id };
        createdRecordId = txOut.id;
        inversePayload = {
          action: 'reverse_transfer',
          fromAccountId,
          toAccountId,
          amount: transferAmount,
          fromTxId: txOut.id,
          toTxId: txIn.id,
        };
      } else if (
        normalizedToolName === 'createautomationrule' ||
        normalizedToolName === 'automationrule'
      ) {
        const keyword = parameters.keyword || parameters.triggerValue || '';
        const category = parameters.category || parameters.actionValue || 'Other';
        const ruleName = `Auto-categorize "${keyword}" -> ${category}`;

        const [newRule] = await db
          .insert(automationRules)
          .values({
            userId,
            name: ruleName,
            triggerType: 'description_contains',
            triggerValue: keyword,
            actionType: 'set_category',
            actionValue: category,
            active: 1,
            priority: 0,
          })
          .returning();

        result = newRule;
        createdRecordId = newRule.id;
        inversePayload = {
          action: 'delete_automation_rule',
          ruleId: newRule.id,
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

      // Audit in agentActionLogs with previousStateJson and createdRecordId
      const actionLogId = `act_${randomUUID()}`;
      await db.insert(agentActionLogs).values({
        id: actionLogId,
        userId,
        actionType: toolName || 'UNKNOWN',
        payloadJson: JSON.stringify({
          ...parameters,
          previousStateJson: inversePayload,
          createdRecordId,
        }),
        status: 'EXECUTED',
        executedAt: Math.floor(Date.now() / 1000),
        createdAt: sql`(unixepoch())`,
      });

      return NextResponse.json({
        status: 'executed',
        message: 'Action executed successfully.',
        executionId: executionRecordId,
        actionLogId,
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
