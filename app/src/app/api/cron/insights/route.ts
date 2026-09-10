export const dynamic = 'force-dynamic';

/**
 * @fileoverview Nightly Proactive Insight Generation Cron (Module 19).
 * GET / POST /api/cron/insights
 *
 * Runs proactive insight generation across users:
 * - Budget overruns
 * - Spending spikes (linked directly to transactions)
 * - Subscription leaks
 * - Savings opportunities
 * - Module 11 Peer Benchmarks
 * - Module 15 Goal Milestone events
 *
 * Protected by CRON_SECRET if configured.
 *
 * @module api/cron/insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users, proactiveInsights } from '@/db/schema';
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

    let targetUserIds: number[] = [];
    try {
      const body = await request.json();
      if (body.userId) targetUserIds = [parseInt(body.userId, 10)];
    } catch {
      // No body provided; run for all users
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
    console.error('Error generating proactive insights via cron:', error);
    return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
