export const dynamic = 'force-dynamic';

/**
 * @fileoverview Cron endpoint for checking budget thresholds and sending push notifications.
 *
 * Triggered by Vercel cron schedule. Checks:
 * - Budget overspend alerts (>80% and >100%)
 * - Upcoming subscription renewals (within 3 days)
 * - Goal milestones (50%, 75%, 100% reached)
 * - Cash flow forecast danger zone (projected negative balance)
 *
 * @security
 * - Vercel cron routes are protected by the CRON_SECRET header.
 * - No user authentication required (runs as system).
 *
 * @module api/cron/push-check
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users, budgets, savingsGoals, recurringTransactions } from '@/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { PushService } from '@/services/push.service';
import { PushRepository } from '@/repositories/push.repository';
import { queryOne } from '@/lib/db';

/**
 * GET /api/cron/push-check
 *
 * Vercel cron-triggered endpoint. Validates CRON_SECRET in production.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = {
    budgetAlerts: 0,
    subscriptionReminders: 0,
    goalMilestones: 0,
    forecastAlerts: 0,
    errors: 0,
  };

  try {
    // Get all users with push subscriptions
    const allSubs = await PushRepository.listAll();
    const userIds = [...new Set(allSubs.map(s => s.userId))];

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    for (const userId of userIds) {
      try {
        // ─── Budget Overspend Alerts ───
        const userBudgets = await db
          .select()
          .from(budgets)
          .where(
            and(
              eq(budgets.userId, userId),
              eq(budgets.month, currentMonth),
              eq(budgets.year, currentYear)
            )
          );

        for (const budget of userBudgets) {
          // Fetch actual spending for this category/month
          // Using raw query since we need an aggregate with date filtering
          const { queryOne } = await import('@/lib/db');
          const spending = await queryOne<{ total: number }>(
            `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
             WHERE user_id = ? AND type = 'expense' AND category = ?
             AND strftime('%m', date) = ? AND strftime('%Y', date) = ?`,
            [userId, budget.category,
             String(currentMonth).padStart(2, '0'),
             String(currentYear)]
          );

          const total = spending?.total || 0;
          const pct = budget.monthlyLimit > 0 ? (total / budget.monthlyLimit) * 100 : 0;

          if (pct >= 100) {
            await PushService.sendToUser(userId, {
              title: `🚨 Budget Exceeded: ${budget.category}`,
              body: `You've spent ${Math.round(pct)}% of your ${budget.category} budget this month.`,
              tag: 'budget',
              url: '/budget',
            });
            results.budgetAlerts++;
          } else if (pct >= 80) {
            await PushService.sendToUser(userId, {
              title: `⚠️ Budget Warning: ${budget.category}`,
              body: `You've used ${Math.round(pct)}% of your ${budget.category} budget.`,
              tag: 'budget',
              url: '/budget',
            });
            results.budgetAlerts++;
          }
        }

        // ─── Upcoming Subscription Renewals ───
        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        const todayStr = now.toISOString().split('T')[0];
        const futureStr = threeDaysFromNow.toISOString().split('T')[0];

        const upcomingRecurring = await db
          .select()
          .from(recurringTransactions)
          .where(
            and(
              eq(recurringTransactions.userId, userId),
              eq(recurringTransactions.active, 1),
              eq(recurringTransactions.type, 'expense'),
              gte(recurringTransactions.nextDate, todayStr),
              lte(recurringTransactions.nextDate, futureStr)
            )
          );

        for (const sub of upcomingRecurring) {
          await PushService.sendToUser(userId, {
            title: `📅 Upcoming: ${sub.name}`,
            body: `${sub.name} (${sub.amount.toFixed(2)}) is due on ${sub.nextDate}.`,
            tag: 'subscriptions',
            url: '/recurring-subscriptions',
          });
          results.subscriptionReminders++;
        }

        // ─── Goal Milestones ───
        const goals = await db
          .select()
          .from(savingsGoals)
          .where(eq(savingsGoals.userId, userId));

        for (const goal of goals) {
          if (goal.targetAmount <= 0) continue;
          const pct = (goal.savedAmount / goal.targetAmount) * 100;
          const milestones = [100, 75, 50];
          for (const milestone of milestones) {
            if (pct >= milestone && pct < milestone + 5) {
              await PushService.sendToUser(userId, {
                title: pct >= 100
                  ? `🎉 Goal Reached: ${goal.name}!`
                  : `🏁 ${milestone}% — ${goal.name}`,
                body: pct >= 100
                  ? `Congratulations! You've reached your savings goal!`
                  : `You're ${milestone}% of the way to your "${goal.name}" goal.`,
                tag: 'goals',
                url: '/wealth-goals',
              });
              results.goalMilestones++;
              break;
            }
          }
        }
        // ─── Cash Flow Forecast Danger Zone ───
        const forecastCheck = await queryOne<{ totalIncome: number; totalExpense: number }>(
          `SELECT
            COALESCE(SUM(CASE WHEN type='earning' THEN amount ELSE 0 END), 0) as totalIncome,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as totalExpense
           FROM transactions
           WHERE user_id = ? AND date >= date('now', '-30 days')`,
          [userId]
        );

        if (forecastCheck) {
          const monthlyNet = forecastCheck.totalIncome - forecastCheck.totalExpense;
          // If user is spending more than earning, project 30 days ahead
          if (monthlyNet < 0) {
            await PushService.sendToUser(userId, {
              title: '⚠️ Cash Flow Alert',
              body: `At your current pace, you're spending $${Math.abs(monthlyNet).toFixed(0)} more than you earn monthly. Review your forecast.`,
              tag: 'budget',
              url: '/forecast',
              requireInteraction: true,
            });
            results.forecastAlerts++;
          }
        }

      } catch (userError) {
        console.error(`[cron/push-check] Error processing user ${userId}:`, userError);
        results.errors++;
      }
    }
  } catch (error) {
    console.error('[cron/push-check] Fatal error:', error);
    return NextResponse.json(
      { error: 'Internal error', results },
      { status: 500 }
    );
  }

  console.log('[cron/push-check] Results:', results);
  return NextResponse.json({ success: true, results });
}
