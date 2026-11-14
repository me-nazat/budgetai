export const dynamic = 'force-dynamic';

/**
 * @fileoverview Dashboard layout API.
 *
 * GET — Get user's widget layout preferences
 * PUT — Save widget ordering, hero widget, and visibility
 *
 * @module api/dashboard/layout
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { dashboardLayouts } from '@/db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_WIDGET_ORDER = [
  'net-worth',
  'monthly-spending',
  'budget-overview',
  'savings-goals',
  'recent-transactions',
  'income-vs-expense',
  'upcoming-bills',
  'investments-summary',
  'debt-progress',
  'ai-insights',
];

const UpdateSchema = z.object({
  widgetOrder: z.array(z.string()).optional(),
  heroWidget: z.string().nullable().optional(),
  hiddenWidgets: z.record(z.string(), z.boolean()).optional(),
});

/**
 * GET /api/dashboard/layout
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    const layouts = await db
      .select()
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId))
      .limit(1);

    if (layouts[0]) {
      return NextResponse.json({
        widgetOrder: JSON.parse(layouts[0].widgetOrder),
        heroWidget: layouts[0].heroWidget,
        hiddenWidgets: JSON.parse(layouts[0].hiddenWidgets || '{}'),
      });
    }

    // Return defaults
    return NextResponse.json({
      widgetOrder: DEFAULT_WIDGET_ORDER,
      heroWidget: null,
      hiddenWidgets: {},
    });
  })
);

/**
 * PUT /api/dashboard/layout
 */
export const PUT = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = UpdateSchema.parse(body);

    const existing = await db
      .select()
      .from(dashboardLayouts)
      .where(eq(dashboardLayouts.userId, userId))
      .limit(1);

    const data = {
      widgetOrder: validated.widgetOrder
        ? JSON.stringify(validated.widgetOrder)
        : undefined,
      heroWidget: validated.heroWidget !== undefined ? validated.heroWidget : undefined,
      hiddenWidgets: validated.hiddenWidgets
        ? JSON.stringify(validated.hiddenWidgets)
        : undefined,
      updatedAt: new Date().toISOString(),
    };

    // Filter out undefined values
    const setData = Object.fromEntries(
      Object.entries(data).filter(([, v]) => v !== undefined)
    );

    if (existing[0]) {
      await db
        .update(dashboardLayouts)
        .set(setData)
        .where(eq(dashboardLayouts.id, existing[0].id));
    } else {
      await db.insert(dashboardLayouts).values({
        userId,
        widgetOrder: validated.widgetOrder
          ? JSON.stringify(validated.widgetOrder)
          : JSON.stringify(DEFAULT_WIDGET_ORDER),
        heroWidget: validated.heroWidget || null,
        hiddenWidgets: validated.hiddenWidgets
          ? JSON.stringify(validated.hiddenWidgets)
          : '{}',
      });
    }

    return NextResponse.json({ message: 'Layout saved' });
  })
);
