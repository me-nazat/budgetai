export const dynamic = 'force-dynamic';

/**
 * @fileoverview Cron endpoint for processing household recurring split rules.
 *
 * Runs daily via Vercel cron. Finds householdSplitRules where nextRunDate <= today,
 * creates a household expense for each, and advances the nextRunDate.
 *
 * @security Vercel CRON_SECRET header validation (matches existing cron pattern).
 *
 * @module api/cron/household-splits
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { householdSplitRules, householdExpenses, householdMembers, module20UpcomingSettlements } from '@/db/schema';
import { PushService } from '@/services/push.service';
import { eq, and, lte, sql } from 'drizzle-orm';

/**
 * Advances the next run date based on frequency.
 */
function advanceRunDate(current: string, frequency: 'monthly' | 'biweekly' | 'weekly', dayOfMonth?: number | null): string {
  const date = new Date(current);

  switch (frequency) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 28) {
        date.setDate(dayOfMonth);
      }
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
  }

  return date.toISOString().split('T')[0];
}

export async function GET(request: NextRequest) {
  // Verify cron secret (same pattern as push-check)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const results = { processed: 0, errors: 0 };

  try {
    // Find all active rules where nextRunDate <= today
    const dueRules = await db
      .select()
      .from(householdSplitRules)
      .where(
        and(
          eq(householdSplitRules.active, 1),
          lte(householdSplitRules.nextRunDate, today)
        )
      );

    for (const rule of dueRules) {
      try {
        // Create a household expense for this recurring split
        await db.insert(householdExpenses).values({
          householdId: rule.householdId,
          userId: rule.createdByUserId,
          description: `[Auto-Split] ${rule.name}`,
          amount: rule.amount,
          category: rule.category,
          splitBetween: rule.splitType === 'equal' ? 'all' : rule.splitShares || 'all',
        });

        // Advance nextRunDate
        const nextDate = advanceRunDate(
          rule.nextRunDate || today,
          rule.frequency as 'monthly' | 'biweekly' | 'weekly',
          rule.dayOfMonth
        );

        await db
          .update(householdSplitRules)
          .set({ nextRunDate: nextDate })
          .where(eq(householdSplitRules.id, rule.id));

        // Create upcoming_settlement rows for members
        try {
          const members = await db
            .select({ userId: householdMembers.userId })
            .from(householdMembers)
            .where(eq(householdMembers.householdId, rule.householdId));

          let parsedShares: Record<string, number> = {};
          if (rule.splitShares) {
            try {
              parsedShares = JSON.parse(rule.splitShares);
            } catch {
              parsedShares = {};
            }
          }

          const otherMembers = members.filter((m) => m.userId !== rule.createdByUserId);
          for (const m of otherMembers) {
            let shareAmount = 0;
            if (rule.splitType === 'equal') {
              shareAmount = members.length > 0 ? Math.round((rule.amount / members.length) * 100) / 100 : 0;
            } else if (rule.splitType === 'percentage') {
              const pct = parsedShares[String(m.userId)] || 0;
              shareAmount = Math.round(((rule.amount * pct) / 100) * 100) / 100;
            } else if (rule.splitType === 'fixed') {
              shareAmount = parsedShares[String(m.userId)] || 0;
            }

            if (shareAmount > 0) {
              const settlementId = `settle_cron_${rule.id}_${m.userId}_${Date.now()}`;
              await db.insert(module20UpcomingSettlements).values({
                id: settlementId,
                householdId: rule.householdId,
                fromUserId: m.userId,
                toUserId: rule.createdByUserId,
                amount: shareAmount,
                dueDate: nextDate,
                status: 'pending',
              });

              // Send push notification
              await PushService.sendToUser(m.userId, {
                title: `Auto-Split Bill: ${rule.name}`,
                body: `Your share of ${rule.name} is $${shareAmount.toFixed(2)}.`,
                url: `/household/${rule.householdId}`,
              }).catch(() => {});
            }
          }
        } catch (subError) {
          console.warn(`[cron/household-splits] Could not generate upcoming settlements for rule ${rule.id}:`, subError);
        }

        results.processed++;
      } catch (ruleError) {
        console.error(`[cron/household-splits] Error processing rule ${rule.id}:`, ruleError);
        results.errors++;
      }
    }
  } catch (error) {
    console.error('[cron/household-splits] Fatal error:', error);
    return NextResponse.json({ error: 'Internal error', results }, { status: 500 });
  }

  console.log('[cron/household-splits] Results:', results);
  return NextResponse.json({ success: true, results });
}
