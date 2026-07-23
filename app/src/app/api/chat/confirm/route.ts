export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { AiInsightsRepository } from '@/repositories/aiInsights.repository';
import { TransactionService } from '@/services/transaction.service';
import { BudgetRepository } from '@/repositories/budget.repository';
import { GoalRepository } from '@/repositories/goal.repository';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { executionId, action, toolName, parameters } = body;

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

    // Execute requested tool mutation safely
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
