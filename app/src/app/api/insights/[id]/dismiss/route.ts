export const dynamic = 'force-dynamic';

/**
 * @fileoverview Dismiss Insight & Feedback API Route (Module 19).
 * POST /api/insights/[id]/dismiss — Marks a proactive insight as dismissed
 * and records user feedback ('helpful', 'not_helpful', 'dismissed') in module_29_insight_feedback.
 *
 * @module api/insights/[id]/dismiss
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  proactiveInsights,
  module29InsightFeedback,
  aiInsightsCache,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const POST = apiHandler(
  withAuth<{ params: Promise<{ id: string }> }>(
    async (request: NextRequest, { userId }, context) => {
      try {
        const { id } = await context.params;
        let feedback: 'helpful' | 'not_helpful' | 'dismissed' = 'dismissed';

        try {
          const body = await request.json();
          if (body.feedback && ['helpful', 'not_helpful', 'dismissed'].includes(body.feedback)) {
            feedback = body.feedback;
          }
        } catch {
          // No body provided; default to 'dismissed'
        }

        // 1. Update proactiveInsights if exists
        await db
          .update(proactiveInsights)
          .set({ isDismissed: 1 })
          .where(and(eq(proactiveInsights.id, id), eq(proactiveInsights.userId, userId)));

        // 2. Also dismiss in aiInsightsCache if matching numeric ID
        const numId = parseInt(id, 10);
        if (!isNaN(numId)) {
          await db
            .update(aiInsightsCache)
            .set({ isDismissed: 1 })
            .where(and(eq(aiInsightsCache.id, numId), eq(aiInsightsCache.userId, userId)));
        }

        // 3. Record feedback in module_29_insight_feedback
        await db.insert(module29InsightFeedback).values({
          id: `fb_${randomUUID()}`,
          userId,
          insightId: id,
          feedback,
        });

        return NextResponse.json({
          success: true,
          message: 'Insight dismissed and feedback saved.',
          feedback,
        });
      } catch (err: any) {
        console.error('Error dismissing insight:', err);
        return NextResponse.json(
          { error: err.message || 'Failed to dismiss insight' },
          { status: 500 }
        );
      }
    }
  )
);
