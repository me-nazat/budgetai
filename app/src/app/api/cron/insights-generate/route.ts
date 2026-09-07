export const dynamic = 'force-dynamic';

/**
 * @fileoverview Nightly Proactive Insight Generation Cron (Module 19).
 * GET / POST /api/cron/insights-generate
 *
 * Scans transactions from the last 30 days, current budget ceilings, and recurring obligations.
 * Uses Gemini (or rule-based financial heuristic fallback) to synthesize up to 3 proactive insights:
 * - SPENDING_SPIKE (Warning)
 * - SUBSCRIPTION_LEAK (Warning / Info)
 * - BUDGET_OVERRUN (Critical / Warning)
 * - SAVINGS_OPPORTUNITY (Info)
 *
 * Respects negative user feedback from module_29_insight_feedback.
 *
 * @module api/cron/insights-generate
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import {
  users,
  proactiveInsights,
} from '@/db/schema';
import { randomUUID } from 'crypto';
import { generateUserInsights } from '@/lib/ai/insightsGenerator';


export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized cron dispatch' }, { status: 401 });
      }
    }

    // Check if called for a specific user via JSON body
    let targetUserIds: number[] = [];
    try {
      const body = await request.json();
      if (body.userId) targetUserIds = [parseInt(body.userId, 10)];
    } catch {
      // No JSON body; run for all users
    }

    if (targetUserIds.length === 0) {
      const allUsers = await db.select({ id: users.id }).from(users).limit(100);
      targetUserIds = allUsers.map((u) => u.id);
    }

    const nowEpoch = Math.floor(Date.now() / 1000);
    let totalGenerated = 0;

    for (const uId of targetUserIds) {
      const insights = await generateUserInsights(uId);

      for (const item of insights) {
        await db.insert(proactiveInsights).values({
          id: `pi_${randomUUID()}`,
          userId: uId,
          insightType: item.insightType,
          severity: item.severity,
          title: item.title,
          message: item.message,
          actionLink: item.actionLink,
          isDismissed: 0,
          generatedAt: nowEpoch,
        });
        totalGenerated++;
      }
    }

    return NextResponse.json({
      success: true,
      totalUsersProcessed: targetUserIds.length,
      insightsGenerated: totalGenerated,
      timestamp: nowEpoch,
    });
  } catch (error: any) {
    console.error('Error generating proactive insights:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
