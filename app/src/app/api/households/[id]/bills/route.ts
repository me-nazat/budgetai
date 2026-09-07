export const dynamic = 'force-dynamic';

/**
 * @fileoverview Household recurring auto-split bills API.
 * Feature 10.2: Recurring Auto-Split Bills + Settlement Workflow.
 *
 * GET    /api/households/[id]/bills — List recurring bills and member share previews
 * POST   /api/households/[id]/bills — Create new recurring auto-split bill
 * DELETE /api/households/[id]/bills?ruleId=123 — Remove recurring bill rule
 *
 * @module api/households/[id]/bills
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  householdMembers,
  householdSplitRules,
  users,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';

type RouteContext = { params: Promise<{ id: string }> };

const CreateBillSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  category: z.string().min(1).max(50).default('Bills & Utilities'),
  frequency: z.enum(['monthly', 'biweekly', 'weekly']).default('monthly'),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  splitType: z.enum(['equal', 'percentage', 'fixed']).default('equal'),
  splitShares: z.record(z.string(), z.number()).optional(),
});

export const GET = apiHandler(
  withAuth<RouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const householdId = parseInt(id, 10);
    if (isNaN(householdId)) {
      return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 });
    }

    // Verify membership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: not a household member' }, { status: 403 });
    }

    const members = await db
      .select({
        userId: householdMembers.userId,
        role: householdMembers.role,
        userName: users.name,
        userEmail: users.email,
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(eq(householdMembers.householdId, householdId));

    const rules = await db
      .select()
      .from(householdSplitRules)
      .where(eq(householdSplitRules.householdId, householdId));

    // Calculate per-member share preview for each rule
    const rulesWithPreviews = rules.map((rule) => {
      let parsedShares: Record<string, number> = {};
      try {
        if (rule.splitShares) parsedShares = JSON.parse(rule.splitShares);
      } catch {
        parsedShares = {};
      }

      const memberShares = members.map((m) => {
        let shareAmount = 0;
        if (rule.splitType === 'equal') {
          shareAmount = members.length > 0 ? Math.round((rule.amount / members.length) * 100) / 100 : 0;
        } else if (rule.splitType === 'percentage') {
          const pct = parsedShares[String(m.userId)] || 0;
          shareAmount = Math.round(((rule.amount * pct) / 100) * 100) / 100;
        } else if (rule.splitType === 'fixed') {
          shareAmount = parsedShares[String(m.userId)] || 0;
        }
        return {
          userId: m.userId,
          name: m.userName,
          shareAmount,
        };
      });

      return {
        ...rule,
        sharesPreview: memberShares,
      };
    });

    return NextResponse.json({ rules: rulesWithPreviews, members });
  })
);

export const POST = apiHandler(
  withAuth<RouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const householdId = parseInt(id, 10);
    if (isNaN(householdId)) {
      return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 });
    }

    // Verify membership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: not a household member' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = CreateBillSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { name, amount, category, frequency, dayOfMonth, splitType, splitShares } = parsed.data;

    // Validate percentage / fixed sums
    if (splitType === 'percentage' && splitShares) {
      const sumPct = Object.values(splitShares).reduce((acc, val) => acc + val, 0);
      if (Math.abs(sumPct - 100) > 0.5) {
        return NextResponse.json({ error: 'Percentage split shares must sum to 100%' }, { status: 400 });
      }
    } else if (splitType === 'fixed' && splitShares) {
      const sumFixed = Object.values(splitShares).reduce((acc, val) => acc + val, 0);
      if (Math.abs(sumFixed - amount) > 0.05) {
        return NextResponse.json({ error: `Fixed split shares must sum to total bill amount ($${amount})` }, { status: 400 });
      }
    }

    // Calculate initial nextRunDate
    const today = new Date();
    const runDate = new Date(today.getFullYear(), today.getMonth(), dayOfMonth);
    if (runDate <= today) {
      runDate.setMonth(runDate.getMonth() + 1);
    }
    const nextRunDate = runDate.toISOString().split('T')[0];

    const [created] = await db
      .insert(householdSplitRules)
      .values({
        householdId,
        name,
        amount,
        category,
        splitType,
        splitShares: splitShares ? JSON.stringify(splitShares) : null,
        frequency,
        dayOfMonth,
        nextRunDate,
        active: 1,
        createdByUserId: userId,
      })
      .returning();

    return NextResponse.json({ success: true, rule: created }, { status: 201 });
  })
);

export const DELETE = apiHandler(
  withAuth<RouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const householdId = parseInt(id, 10);
    if (isNaN(householdId)) {
      return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 });
    }

    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: not a household member' }, { status: 403 });
    }

    const url = new URL(request.url);
    const ruleId = parseInt(url.searchParams.get('ruleId') || '0', 10);
    if (!ruleId) {
      return NextResponse.json({ error: 'ruleId required' }, { status: 400 });
    }

    await db
      .delete(householdSplitRules)
      .where(and(eq(householdSplitRules.id, ruleId), eq(householdSplitRules.householdId, householdId)));

    return NextResponse.json({ success: true });
  })
);
