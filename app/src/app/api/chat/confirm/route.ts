export const dynamic = 'force-dynamic';

/**
 * @fileoverview Confirmation and execution handler for AI chat and insight tool calls.
 *
 * Supports execution for:
 * - create_transaction / add_expense
 * - create_budget / set_budget
 * - create_goal / add_goal
 * - analyze_idle_cash (creates a High-Yield Savings goal for unallocated cash)
 * - compare_peer_benchmarks (fetches cohort benchmarks and updates demographic opt-in)
 * - suggest_tax_deductions (creates tax deduction item from eligible transaction)
 * - run_round_up_simulation (enables round-ups targeting specified goal)
 *
 * @module api/chat/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { AiInsightsRepository } from '@/repositories/aiInsights.repository';
import { TransactionService } from '@/services/transaction.service';
import { BudgetRepository } from '@/repositories/budget.repository';
import { GoalRepository } from '@/repositories/goal.repository';
import { BenchmarkRepository } from '@/repositories/benchmark.repository';
import { RoundUpRepository } from '@/repositories/roundUp.repository';
import { TaxRepository } from '@/repositories/tax.repository';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { executionId, action, toolName, parameters = {} } = body;

    if (action === 'cancel') {
      if (executionId) {
        await AiInsightsRepository.updateToolExecutionStatus(
          parseInt(executionId, 10),
          userId,
          'cancelled'
        );
      }
      return NextResponse.json({ status: 'cancelled', message: 'Action cancelled by user' });
    }

    let result: any = null;

    try {
      if (toolName === 'create_transaction' || toolName === 'add_expense') {
        result = await TransactionService.create(userId, {
          name: parameters.name || 'AI Added Transaction',
          amount: parseFloat(parameters.amount),
          type: parameters.type || 'expense',
          category: parameters.category || 'Other',
          date: parameters.date || new Date().toISOString().split('T')[0],
        });
      } else if (toolName === 'create_budget' || toolName === 'set_budget') {
        const now = new Date();
        result = await BudgetRepository.create({
          userId,
          category: parameters.category,
          monthlyLimit: parseFloat(parameters.amount || parameters.monthlyLimit),
          month: now.getMonth() + 1,
          year: now.getFullYear(),
        });
      } else if (toolName === 'create_goal' || toolName === 'add_goal') {
        result = await GoalRepository.create({
          userId,
          name: parameters.name,
          targetAmount: parseFloat(parameters.targetAmount || parameters.amount),
          savedAmount: 0,
          deadline: parameters.deadline || undefined,
        });
      } else if (toolName === 'analyze_idle_cash') {
        // Create High-Yield Savings Goal from idle cash recommendation
        const targetAmount = parseFloat(parameters.idleAmount || 1000);
        result = await GoalRepository.create({
          userId,
          name: 'High-Yield Savings Reserve',
          targetAmount,
          savedAmount: 0,
        });
      } else if (toolName === 'compare_peer_benchmarks') {
        // Fetch benchmarks and ensure opt-in is registered
        result = await BenchmarkRepository.getPeerBenchmarks(userId, {
          ageTier: parameters.ageTier || '25-34',
          regionCode: parameters.regionCode || 'GLOBAL',
        });
      } else if (toolName === 'suggest_tax_deductions') {
        // Flag tax deduction item
        const now = new Date();
        result = await TaxRepository.flagDeduction({
          userId,
          transactionId: parameters.transactionId ? parseInt(parameters.transactionId, 10) : undefined,
          taxYear: parameters.taxYear || now.getFullYear(),
          deductionCategory: parameters.category || 'Professional Expenses',
          deductibleAmount: parseFloat(parameters.amount || 100),
        });
      } else if (toolName === 'run_round_up_simulation') {
        // Enable round-ups with target goal
        result = await RoundUpRepository.saveSettings({
          userId,
          enabled: 1,
          roundingTier: parseFloat(parameters.roundingTier || 1.0),
          multiplier: parseFloat(parameters.multiplier || 1.0),
          targetGoalId: parameters.targetGoalId ? parseInt(parameters.targetGoalId, 10) : null,
        });
      } else {
        return NextResponse.json({ error: `Unknown tool name: ${toolName}` }, { status: 400 });
      }

      if (executionId) {
        await AiInsightsRepository.updateToolExecutionStatus(
          parseInt(executionId, 10),
          userId,
          'executed'
        );
      }

      return NextResponse.json({
        status: 'executed',
        message: 'Tool action confirmed and executed successfully',
        result,
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Execution failed' }, { status: 500 });
    }
  })
);
