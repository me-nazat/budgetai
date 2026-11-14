export const dynamic = 'force-dynamic';

/**
 * @fileoverview Data import API with diff/preview.
 *
 * POST — Import user data from a JSON export file
 *
 * Strategy:
 * - Validates JSON structure against known export format
 * - Returns a preview of what will be imported (counts)
 * - If `?confirm=true`, actually commits the import
 *
 * @security
 * - Only the authenticated user can import data.
 * - Existing data is NOT deleted — imports are additive.
 *
 * @module api/import
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { run } from '@/lib/db';

interface ImportData {
  exportedAt: string;
  version: string;
  data: {
    transactions?: Array<{
      type: string; category: string; description: string;
      amount: number; date: string;
    }>;
    budgets?: Array<{
      category: string; monthly_limit: number; month: number; year: number;
    }>;
    savingsGoals?: Array<{
      name: string; target_amount: number; saved_amount: number; deadline?: string;
    }>;
    netWorth?: Array<{
      amount: number; note?: string; created_at?: string;
    }>;
    recurringTransactions?: Array<{
      name: string; type: string; amount: number; category: string;
      frequency: string; next_date: string; active: number;
    }>;
    customCategories?: Array<{
      name: string; type: string; icon?: string; color?: string;
    }>;
  };
}

/**
 * POST /api/import?confirm=true|false
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const { searchParams } = new URL(request.url);
    const confirm = searchParams.get('confirm') === 'true';
    const body = await request.json() as ImportData;

    // Validate structure
    if (!body.data || typeof body.data !== 'object') {
      return NextResponse.json(
        { error: 'Invalid import file: missing "data" field' },
        { status: 400 }
      );
    }

    const preview = {
      transactions: body.data.transactions?.length || 0,
      budgets: body.data.budgets?.length || 0,
      savingsGoals: body.data.savingsGoals?.length || 0,
      netWorth: body.data.netWorth?.length || 0,
      recurringTransactions: body.data.recurringTransactions?.length || 0,
      customCategories: body.data.customCategories?.length || 0,
    };

    const totalRecords = Object.values(preview).reduce((a, b) => a + b, 0);

    if (totalRecords === 0) {
      return NextResponse.json(
        { error: 'Import file contains no data to import' },
        { status: 400 }
      );
    }

    // Preview mode — show what will be imported
    if (!confirm) {
      return NextResponse.json({
        mode: 'preview',
        preview,
        totalRecords,
        message: 'Send with ?confirm=true to commit the import. Existing data will NOT be deleted.',
      });
    }

    // Commit mode — actually import
    const results = { imported: 0, errors: 0 };

    try {
      // Import transactions
      if (body.data.transactions) {
        for (const t of body.data.transactions) {
          try {
            await run(
              'INSERT INTO transactions (user_id, type, category, description, amount, date) VALUES (?, ?, ?, ?, ?, ?)',
              [userId, t.type, t.category, t.description || '', t.amount, t.date]
            );
            results.imported++;
          } catch { results.errors++; }
        }
      }

      // Import budgets
      if (body.data.budgets) {
        for (const b of body.data.budgets) {
          try {
            await run(
              'INSERT INTO budgets (user_id, category, monthly_limit, month, year) VALUES (?, ?, ?, ?, ?)',
              [userId, b.category, b.monthly_limit, b.month, b.year]
            );
            results.imported++;
          } catch { results.errors++; }
        }
      }

      // Import savings goals
      if (body.data.savingsGoals) {
        for (const g of body.data.savingsGoals) {
          try {
            await run(
              'INSERT INTO savings_goals (user_id, name, target_amount, saved_amount, deadline) VALUES (?, ?, ?, ?, ?)',
              [userId, g.name, g.target_amount, g.saved_amount, g.deadline || null]
            );
            results.imported++;
          } catch { results.errors++; }
        }
      }

      // Import net worth entries
      if (body.data.netWorth) {
        for (const n of body.data.netWorth) {
          try {
            await run(
              'INSERT INTO net_worth (user_id, amount, note) VALUES (?, ?, ?)',
              [userId, n.amount, n.note || '']
            );
            results.imported++;
          } catch { results.errors++; }
        }
      }

      // Import recurring transactions
      if (body.data.recurringTransactions) {
        for (const r of body.data.recurringTransactions) {
          try {
            await run(
              'INSERT INTO recurring_transactions (user_id, name, type, amount, category, frequency, next_date, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [userId, r.name, r.type, r.amount, r.category, r.frequency, r.next_date, r.active ?? 1]
            );
            results.imported++;
          } catch { results.errors++; }
        }
      }

      // Import custom categories
      if (body.data.customCategories) {
        for (const c of body.data.customCategories) {
          try {
            await run(
              'INSERT INTO custom_categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)',
              [userId, c.name, c.type, c.icon || 'category', c.color || 'gray']
            );
            results.imported++;
          } catch { results.errors++; }
        }
      }
    } catch (error) {
      console.error('[import] Fatal error:', error);
      return NextResponse.json(
        { error: 'Import failed', results },
        { status: 500 }
      );
    }

    return NextResponse.json({
      mode: 'committed',
      results,
      message: `Imported ${results.imported} records successfully (${results.errors} errors).`,
    });
  }),
  { rateLimit: 'api' }
);
