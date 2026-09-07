export const dynamic = 'force-dynamic';

/**
 * @fileoverview Proactive AI Insights API Route (Module 19).
 * GET /api/coach/insights — Fetches active proactive insights from proactive_insights table,
 * sorted by severity (CRITICAL > WARNING > INFO) and generated timestamp.
 *
 * @module api/coach/insights
 */

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { db } from '@/db/client';
import { proactiveInsights } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateUserInsights } from '@/lib/ai/insightsGenerator';




export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  try {
    let items = await db
      .select()
      .from(proactiveInsights)
      .where(
        and(
          eq(proactiveInsights.userId, userId),
          eq(proactiveInsights.isDismissed, 0)
        )
      )
      .orderBy(desc(proactiveInsights.createdAt));

    // If zero active insights exist in database, generate initial batch
    if (items.length === 0) {
      const generated = await generateUserInsights(userId);
      const nowEpoch = Math.floor(Date.now() / 1000);

      for (const gen of generated) {
        await db.insert(proactiveInsights).values({
          id: `pi_${randomUUID()}`,
          userId,
          insightType: gen.insightType,
          severity: gen.severity,
          title: gen.title,
          message: gen.message,
          actionLink: gen.actionLink,
          isDismissed: 0,
          generatedAt: nowEpoch,
        });
      }

      items = await db
        .select()
        .from(proactiveInsights)
        .where(
          and(
            eq(proactiveInsights.userId, userId),
            eq(proactiveInsights.isDismissed, 0)
          )
        )
        .orderBy(desc(proactiveInsights.createdAt));
    }

    // Sort: CRITICAL first, then WARNING, then INFO
    const severityWeight: Record<string, number> = {
      CRITICAL: 3,
      WARNING: 2,
      INFO: 1,
    };

    items.sort((a, b) => {
      const weightA = severityWeight[a.severity.toUpperCase()] || 0;
      const weightB = severityWeight[b.severity.toUpperCase()] || 0;
      return weightB - weightA;
    });

    return apiSuccess({
      insights: items.map((item) => ({
        id: item.id,
        type: item.insightType,
        insightType: item.insightType,
        severity: item.severity,
        title: item.title,
        message: item.message,
        description: item.message,
        actionLink: item.actionLink,
        generatedAt: item.generatedAt,
        createdAt: item.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('Error fetching proactive insights:', err);
    return apiError(new Error(err.message || 'Failed to fetch insights'));
  }
});
