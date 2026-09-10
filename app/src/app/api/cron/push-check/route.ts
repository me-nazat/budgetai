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
import { users, budgets, savingsGoals, recurringTransactions, debts, module28PushScheduledJobs, transactions } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
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

        // ─── Module 18: Smart Payday Alignment & Upcoming Subscriptions ───
        // Detect recurring salary/income pattern from transactions
        const recentSalaries = await db
          .select({ date: transactions.date })
          .from(transactions)
          .where(and(eq(transactions.userId, userId), eq(transactions.type, 'earning')))
          .orderBy(desc(transactions.date))
          .limit(10);

        let typicalPayDay: number | null = null;
        if (recentSalaries.length >= 2) {
          const days = recentSalaries.map(s => new Date(s.date).getDate());
          const counts: Record<number, number> = {};
          days.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
          const topDay = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
          if (topDay && topDay[1] >= 2) {
            typicalPayDay = parseInt(topDay[0], 10);
          }
        }

        const isPaydayWindow = typicalPayDay !== null && Math.abs(now.getDate() - typicalPayDay) <= 2;
        const daysAhead = isPaydayWindow ? 7 : 3;
        const windowLimitDate = new Date(now);
        windowLimitDate.setDate(windowLimitDate.getDate() + daysAhead);

        const todayStr = now.toISOString().split('T')[0];
        const futureStr = windowLimitDate.toISOString().split('T')[0];

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
          const title = isPaydayWindow
            ? `💰 Payday Aligned: ${sub.name} Due Soon`
            : `📅 Upcoming: ${sub.name}`;
          const body = isPaydayWindow
            ? `Your typical payday is here! ${sub.name} (৳${sub.amount.toFixed(2)}) is due on ${sub.nextDate}.`
            : `${sub.name} (৳${sub.amount.toFixed(2)}) is due on ${sub.nextDate}.`;

          await PushService.sendToUser(userId, {
            title,
            body,
            tag: 'subscriptions',
            url: '/recurring-subscriptions',
          });
          results.subscriptionReminders++;
        }

        // ─── Module 18: Debt Payoff / Due Date Reminders ───
        const debtsList = await db
          .select()
          .from(debts)
          .where(and(eq(debts.userId, userId), gte(debts.balance, 0.01)));

        const currentDay = now.getDate();
        for (const debt of debtsList) {
          if (debt.dueDayOfMonth && Math.abs(debt.dueDayOfMonth - currentDay) <= 3) {
            // Near payoff check: balance within 1.25x minimum payment
            const isNearPayoff = debt.balance <= Math.max(debt.minimumPayment * 1.25, 2000);

            if (isNearPayoff) {
              await PushService.sendToUser(userId, {
                title: `🎉 Last Payment Approaching: ${debt.name}`,
                body: `Last payment on this debt is due soon 🎉 Only ৳${debt.balance.toFixed(2)} remaining to become completely debt-free!`,
                tag: `debt-final-${debt.id}`,
                url: '/debts',
              });
            } else {
              await PushService.sendToUser(userId, {
                title: `💳 Debt Payment Due: ${debt.name}`,
                body: `Minimum payment for "${debt.name}" is due on day ${debt.dueDayOfMonth} of the month.`,
                tag: 'debts',
                url: '/debts',
              });
            }
            results.subscriptionReminders++;
          }
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

    // ─── Module 28: Scheduled Push Jobs Queue Drain ───
    const currentEpoch = Math.floor(Date.now() / 1000);
    const pendingJobs = await db
      .select()
      .from(module28PushScheduledJobs)
      .where(
        and(
          eq(module28PushScheduledJobs.status, 'pending'),
          lte(module28PushScheduledJobs.runAt, currentEpoch)
        )
      )
      .limit(50);

    for (const job of pendingJobs) {
      try {
        const payload = JSON.parse(job.payloadJson);
        await PushService.sendToUser(job.userId, {
          title: payload.title || 'WealthAI Scheduled Alert',
          body: payload.body || 'You have an upcoming financial obligation.',
          tag: payload.tag || 'calendar-reminder',
          url: payload.url || '/recurring',
        });

        await db
          .update(module28PushScheduledJobs)
          .set({
            status: 'sent',
            sentAt: Math.floor(Date.now() / 1000),
          })
          .where(eq(module28PushScheduledJobs.id, job.id));

        (results as any).scheduledJobsSent = ((results as any).scheduledJobsSent || 0) + 1;
      } catch (jobErr) {
        console.error(`[cron/push-check] Error executing scheduled push job ${job.id}:`, jobErr);
        await db
          .update(module28PushScheduledJobs)
          .set({ status: 'failed' })
          .where(eq(module28PushScheduledJobs.id, job.id));
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
