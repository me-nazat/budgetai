export const dynamic = 'force-dynamic';

/**
 * @fileoverview Data export API.
 *
 * GET — Export all user data as institutional JSON or CSV
 *
 * Supports:
 * - Full JSON institutional financial vault snapshot (Accounts, Transactions, Budgets, Subscriptions, Goals, Debts, Net Worth, Households, Tours)
 * - CSV export with UTF-8 BOM (\uFEFF) and multi-account ledger columns
 *
 * @security
 * - Rate limited to prevent abuse.
 * - Only exports data belonging to the authenticated user.
 *
 * @module api/export
 */

import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll } from '@/lib/db';

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  return `"${str.replace(/"/g, '""')}"`;
}

async function safeQuery<T = any>(sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    return await queryAll<T>(sql, params);
  } catch {
    return [];
  }
}

/**
 * GET /api/export?format=json|csv
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    if (format === 'csv') {
      // Joined transaction export with accounts and collaborative shares
      let transactions = await safeQuery<{
        id: number;
        date: string;
        account_name?: string;
        currency?: string;
        type: string;
        category: string;
        description: string;
        amount: number;
        personal_share_amount?: number;
        tax_deductible?: number;
        notes?: string;
      }>(`
        SELECT 
          t.id,
          t.date,
          COALESCE(a.name, 'Default') AS account_name,
          COALESCE(a.currency, t.currency, u.currency, 'BDT') AS currency,
          t.type,
          t.category,
          t.description,
          t.amount,
          COALESCE(t.personal_share_amount, t.amount) AS personal_share_amount,
          COALESCE(t.tax_deductible, 0) AS tax_deductible,
          COALESCE(t.notes, '') AS notes
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.user_id = ?
        ORDER BY t.date DESC
      `, [userId]);

      // Fallback if joined query encountered schema differences
      if (transactions.length === 0) {
        transactions = await safeQuery<{
          id: number;
          date: string;
          type: string;
          category: string;
          description: string;
          amount: number;
        }>(
          'SELECT id, date, type, category, description, amount FROM transactions WHERE user_id = ? ORDER BY date DESC',
          [userId]
        );
      }

      const csvHeader = 'Date,Account,Currency,Type,Category,Merchant/Description,Total Amount,Personal Share Amount,Tax Deductible,Notes\n';
      const csvRows = transactions.map((t) => {
        const date = t.date || '';
        const account = escapeCsv(t.account_name || 'Default');
        const currency = escapeCsv(t.currency || 'BDT');
        const type = escapeCsv(t.type || '');
        const category = escapeCsv(t.category || 'Other');
        const desc = escapeCsv(t.description || '');
        const totalAmount = t.amount ?? 0;
        const personalShare = t.personal_share_amount ?? t.amount ?? 0;
        const tax = t.tax_deductible ? 'Yes' : 'No';
        const notes = escapeCsv(t.notes || '');
        return `"${date}",${account},${currency},${type},${category},${desc},${totalAmount},${personalShare},"${tax}",${notes}`;
      }).join('\n');

      return new NextResponse('\uFEFF' + csvHeader + csvRows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="wealthai-transactions-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Full JSON institutional vault snapshot
    const [
      accountsList,
      transactionsList,
      budgetsList,
      subscriptionsList,
      savingsGoalsList,
      debtsList,
      netWorthList,
      householdsList,
      toursList,
      recurringTransactionsList,
      notificationsList,
      customCategoriesList,
      chatMessagesList,
      automationRulesList,
    ] = await Promise.all([
      safeQuery('SELECT id, name, type, currency, opening_balance, current_balance, color_tag, is_archived, created_at FROM accounts WHERE user_id = ? ORDER BY name ASC', [userId]),
      safeQuery(`
        SELECT 
          t.id, t.type, t.category, t.description, t.amount,
          COALESCE(t.personal_share_amount, t.amount) AS personal_share_amount,
          COALESCE(t.tax_deductible, 0) AS tax_deductible,
          COALESCE(t.notes, '') AS notes,
          t.date, t.created_at,
          COALESCE(a.name, 'Default') AS account_name,
          COALESCE(a.currency, t.currency, u.currency, 'BDT') AS currency
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE t.user_id = ?
        ORDER BY t.date DESC
      `, [userId]).then((res) => {
        if (res.length > 0) return res;
        return safeQuery('SELECT id, type, category, description, amount, date, created_at FROM transactions WHERE user_id = ? ORDER BY date DESC', [userId]);
      }),
      safeQuery('SELECT id, category, monthly_limit, month, year, created_at FROM budgets WHERE user_id = ?', [userId]),
      safeQuery('SELECT id, name, amount, currency, billing_cycle, next_renewal_date, category, is_active, created_at FROM subscriptions WHERE user_id = ?', [userId]),
      safeQuery('SELECT id, name, target_amount, saved_amount, deadline, created_at FROM savings_goals WHERE user_id = ?', [userId]),
      safeQuery('SELECT id, name, debt_type, balance, initial_balance, interest_rate_apr, minimum_payment, due_day_of_month, created_at FROM debts WHERE user_id = ?', [userId]),
      safeQuery('SELECT id, amount, note, created_at FROM net_worth WHERE user_id = ? ORDER BY created_at DESC', [userId]),
      safeQuery(`
        SELECT h.id, h.name, h.invite_code, h.default_split_mode, h.created_at 
        FROM households h 
        WHERE h.created_by = ? 
        OR h.id IN (SELECT household_id FROM household_members WHERE user_id = ?)
      `, [userId, userId]).then((res) => {
        if (res.length > 0) return res;
        return safeQuery('SELECT id, name, invite_code, default_split_mode, created_at FROM households WHERE created_by = ?', [userId]);
      }),
      safeQuery('SELECT id, name, destination, start_date, end_date, base_currency, total_budget, created_at FROM tours WHERE created_by = ?', [userId])
        .then((res) => {
          if (res.length > 0) return res;
          return safeQuery('SELECT id, name, created_at FROM tours WHERE created_by = ?', [userId]);
        }),
      safeQuery('SELECT id, name, type, amount, category, frequency, next_date, active, created_at FROM recurring_transactions WHERE user_id = ?', [userId]),
      safeQuery('SELECT id, type, title, message, read, created_at FROM notifications WHERE user_id = ?', [userId]),
      safeQuery('SELECT id, name, type, icon, color, created_at FROM custom_categories WHERE user_id = ?', [userId]),
      safeQuery('SELECT id, role, content, mode, session_id, created_at FROM chat_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 500', [userId]),
      safeQuery('SELECT id, name, trigger_type, trigger_value, action_type, action_value, active, priority, created_at FROM automation_rules WHERE user_id = ?', [userId]),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
      vault: {
        accounts: accountsList,
        transactions: transactionsList,
        budgets: budgetsList,
        subscriptions: subscriptionsList,
        goals: savingsGoalsList,
        debts: debtsList,
        netWorth: netWorthList,
        households: householdsList,
        tours: toursList,
      },
      data: {
        accounts: accountsList,
        transactions: transactionsList,
        budgets: budgetsList,
        subscriptions: subscriptionsList,
        savingsGoals: savingsGoalsList,
        netWorth: netWorthList,
        recurringTransactions: recurringTransactionsList,
        notifications: notificationsList,
        debts: debtsList,
        customCategories: customCategoriesList,
        chatMessages: chatMessagesList,
        automationRules: automationRulesList,
        households: householdsList,
        tours: toursList,
      },
      stats: {
        totalAccounts: accountsList.length,
        totalTransactions: transactionsList.length,
        totalBudgets: budgetsList.length,
        totalSubscriptions: subscriptionsList.length,
        totalGoals: savingsGoalsList.length,
        totalNetWorthEntries: netWorthList.length,
        totalDebts: debtsList.length,
        totalHouseholds: householdsList.length,
        totalTours: toursList.length,
      },
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="wealthai-vault-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }),
  { rateLimit: 'api' }
);
