export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { AuditService } from '@/services/audit.service';
import { getClientIP } from '@/lib/security/rate-limiter';

const DEFAULT_DESKTOP_LAYOUT = [
  'net_worth',
  'quick_stats',
  'spending_trends',
  'top_categories',
  'predictive',
  'recent_activity',
  'budget_alerts',
  'intel_hub',
];

const DEFAULT_MOBILE_LAYOUT = [
  'net_worth',
  'quick_stats',
  'recent_activity',
  'budget_alerts',
  'intel_hub',
];

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const [user] = await db
      .select({
        dashboardLayout: users.dashboardLayout,
        mobileWidgetOrder: users.mobileWidgetOrder,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let desktop = DEFAULT_DESKTOP_LAYOUT;
    let mobile = DEFAULT_MOBILE_LAYOUT;

    if (user.dashboardLayout) {
      try {
        desktop = JSON.parse(user.dashboardLayout);
      } catch (e) {
        console.error('Failed to parse desktop layout:', e);
      }
    }

    if (user.mobileWidgetOrder) {
      try {
        mobile = JSON.parse(user.mobileWidgetOrder);
      } catch (e) {
        console.error('Failed to parse mobile layout:', e);
      }
    }

    return NextResponse.json({
      dashboardLayout: desktop,
      mobileWidgetOrder: mobile,
    });
  })
);

export const PUT = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { dashboardLayout, mobileWidgetOrder } = body;

    const [user] = await db
      .select({
        dashboardLayout: users.dashboardLayout,
        mobileWidgetOrder: users.mobileWidgetOrder,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updateData: Partial<typeof users.$inferInsert> = {};
    if (Array.isArray(dashboardLayout)) {
      updateData.dashboardLayout = JSON.stringify(dashboardLayout);
    }
    if (Array.isArray(mobileWidgetOrder)) {
      updateData.mobileWidgetOrder = JSON.stringify(mobileWidgetOrder);
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || undefined;

    AuditService.logUpdate(
      userId,
      'user',
      userId,
      {
        dashboardLayout: user.dashboardLayout,
        mobileWidgetOrder: user.mobileWidgetOrder,
      },
      updateData,
      ip,
      userAgent
    );

    return NextResponse.json({ success: true });
  })
);
