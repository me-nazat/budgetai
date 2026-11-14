export const dynamic = 'force-dynamic';

/**
 * @fileoverview Data export API.
 *
 * GET — Export all user data as JSON or CSV
 *
 * Supports:
 * - Full JSON export (all tables)
 * - CSV export (transactions only)
 * - AI annual report generation
 *
 * @security
 * - Rate limited to prevent abuse.
 * - Only exports data belonging to the authenticated user.
 *
 * @module api/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll } from '@/lib/db';

/**
 * GET /api/export?format=json|csv
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    if (format === 'csv') {
      // CSV export: transactions only
      const transactions = await queryAll<{
        id: number; type: string; category: string; description: string;
        amount: number; date: string; created_at: string;
      }>(
        'SELECT id, type, category, description, amount, date, created_at FROM transactions WHERE user_id = ? ORDER BY date DESC',
        [userId]
      );

      const csvHeader = 'ID,Type,Category,Description,Amount,Date,Created At\n';
      const csvRows = transactions.map(t =>
        `${t.id},"${t.type}","${(t.category || '').replace(/"/g, '""')}","${(t.description || '').replace(/"/g, '""')}",${t.amount},"${t.date}","${t.created_at}"`
      ).join('\n');

      return new NextResponse(csvHeader + csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wealthai-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Full JSON export
    const [
      transactions,
      budgets,
      savingsGoals,
      netWorth,
      recurringTransactions,
      notifications,
      debts,
      customCategories,
      chatMessages,
      automationRules,
    ] = await Promise.all([
      queryAll('SELECT id, type, category, description, amount, date, created_at FROM transactions WHERE user_id = ? ORDER BY date DESC', [userId]),
      queryAll('SELECT id, category, monthly_limit, month, year, created_at FROM budgets WHERE user_id = ?', [userId]),
      queryAll('SELECT id, name, target_amount, saved_amount, deadline, created_at FROM savings_goals WHERE user_id = ?', [userId]),
      queryAll('SELECT id, amount, note, created_at FROM net_worth WHERE user_id = ? ORDER BY created_at DESC', [userId]),
      queryAll('SELECT id, name, type, amount, category, frequency, next_date, active, created_at FROM recurring_transactions WHERE user_id = ?', [userId]),
      queryAll('SELECT id, type, title, message, read, created_at FROM notifications WHERE user_id = ?', [userId]),
      queryAll('SELECT id, name, debt_type, balance, initial_balance, interest_rate_apr, minimum_payment, due_day_of_month, created_at FROM debts WHERE user_id = ?', [userId]),
      queryAll('SELECT id, name, type, icon, color, created_at FROM custom_categories WHERE user_id = ?', [userId]),
      queryAll('SELECT id, role, content, mode, session_id, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 500', [userId]),
      queryAll('SELECT id, name, trigger_type, trigger_value, action_type, action_value, active, priority, created_at FROM automation_rules WHERE user_id = ?', [userId]),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.5.0',
      data: {
        transactions,
        budgets,
        savingsGoals,
        netWorth,
        recurringTransactions,
        notifications,
        debts,
        customCategories,
        chatMessages,
        automationRules,
      },
      stats: {
        totalTransactions: transactions.length,
        totalBudgets: budgets.length,
        totalGoals: savingsGoals.length,
        totalNetWorthEntries: netWorth.length,
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="wealthai-export-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }),
  { rateLimit: 'api' }
);
