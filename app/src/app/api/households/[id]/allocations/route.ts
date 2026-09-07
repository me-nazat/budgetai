export const dynamic = 'force-dynamic';

/**
 * @fileoverview Household budget cycle caps and per-category allocation wheel API.
 * Feature 10.1: Household Budget Caps & Per-Category Allocation Wheel.
 *
 * GET /api/households/[id]/allocations?yearMonth=YYYY-MM
 * PUT /api/households/[id]/allocations
 *
 * @module api/households/[id]/allocations
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  householdMembers,
  householdCategoryCaps,
  householdExpenses,
  module20HouseholdBudgetCycles,
  module20HouseholdCapAllocations,
  users,
} from '@/db/schema';
import { eq, and, like } from 'drizzle-orm';
import crypto from 'crypto';

type RouteContext = { params: Promise<{ id: string }> };

const PutAllocationsSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  totalCap: z.number().nonnegative(),
  caps: z.array(
    z.object({
      category: z.string().min(1).max(100),
      capAmount: z.number().nonnegative(),
      rolloverPolicy: z.enum(['none', 'next_month', 'pool']).default('none'),
    })
  ),
  allocations: z
    .array(
      z.object({
        category: z.string().min(1).max(100),
        capAmount: z.number().nonnegative(),
        contributedByUserId: z.number().int().positive().optional(),
      })
    )
    .optional(),
});

export const GET = apiHandler(
  withAuth<RouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    const { id } = await routeContext.params;
    const householdId = parseInt(id, 10);
    if (isNaN(householdId)) {
      return NextResponse.json({ error: 'Invalid household ID' }, { status: 400 });
    }

    // Verify household membership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: not a household member' }, { status: 403 });
    }

    const url = new URL(request.url);
    const yearMonth = url.searchParams.get('yearMonth') || new Date().toISOString().substring(0, 7);

    // Fetch or calculate cycle
    let [cycle] = await db
      .select()
      .from(module20HouseholdBudgetCycles)
      .where(
        and(
          eq(module20HouseholdBudgetCycles.householdId, householdId),
          eq(module20HouseholdBudgetCycles.yearMonth, yearMonth)
        )
      )
      .limit(1);

    const caps = await db
      .select()
      .from(householdCategoryCaps)
      .where(eq(householdCategoryCaps.householdId, householdId));

    if (!cycle) {
      const defaultTotal = caps.reduce((sum, c) => sum + (c.capAmount || 0), 0);
      const cycleId = `cycle_${householdId}_${yearMonth}`;
      await db.insert(module20HouseholdBudgetCycles).values({
        id: cycleId,
        householdId,
        yearMonth,
        totalCap: defaultTotal,
        status: 'active',
      }).onConflictDoNothing();

      const [created] = await db
        .select()
        .from(module20HouseholdBudgetCycles)
        .where(eq(module20HouseholdBudgetCycles.id, cycleId))
        .limit(1);
      cycle = created;
    }

    const allocations = cycle
      ? await db
          .select({
            id: module20HouseholdCapAllocations.id,
            cycleId: module20HouseholdCapAllocations.cycleId,
            category: module20HouseholdCapAllocations.category,
            capAmount: module20HouseholdCapAllocations.capAmount,
            contributedByUserId: module20HouseholdCapAllocations.contributedByUserId,
            contributorName: users.name,
          })
          .from(module20HouseholdCapAllocations)
          .leftJoin(users, eq(module20HouseholdCapAllocations.contributedByUserId, users.id))
          .where(eq(module20HouseholdCapAllocations.cycleId, cycle.id))
      : [];

    // Sum member transactions for this household in this cycle
    const expenses = await db
      .select({
        id: householdExpenses.id,
        userId: householdExpenses.userId,
        amount: householdExpenses.amount,
        category: householdExpenses.category,
        createdAt: householdExpenses.createdAt,
      })
      .from(householdExpenses)
      .where(
        and(
          eq(householdExpenses.householdId, householdId),
          like(householdExpenses.createdAt, `${yearMonth}%`)
        )
      );

    const memberSpending: Record<number, { totalSpent: number; byCategory: Record<string, number> }> = {};
    for (const exp of expenses) {
      if (!memberSpending[exp.userId]) {
        memberSpending[exp.userId] = { totalSpent: 0, byCategory: {} };
      }
      memberSpending[exp.userId].totalSpent += exp.amount;
      memberSpending[exp.userId].byCategory[exp.category] =
        (memberSpending[exp.userId].byCategory[exp.category] || 0) + exp.amount;
    }

    return NextResponse.json({
      cycle: cycle || {
        id: `cycle_${householdId}_${yearMonth}`,
        householdId,
        yearMonth,
        totalCap: 0,
        status: 'active',
      },
      caps,
      allocations,
      memberSpending,
    });
  })
);

export const PUT = apiHandler(
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
    const parsed = PutAllocationsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { yearMonth, totalCap, caps, allocations } = parsed.data;
    const cycleId = `cycle_${householdId}_${yearMonth}`;

    // Upsert budget cycle
    const [existingCycle] = await db
      .select()
      .from(module20HouseholdBudgetCycles)
      .where(eq(module20HouseholdBudgetCycles.id, cycleId))
      .limit(1);

    if (existingCycle) {
      await db
        .update(module20HouseholdBudgetCycles)
        .set({ totalCap })
        .where(eq(module20HouseholdBudgetCycles.id, cycleId));
    } else {
      await db.insert(module20HouseholdBudgetCycles).values({
        id: cycleId,
        householdId,
        yearMonth,
        totalCap,
        status: 'active',
      });
    }

    // Update category caps
    for (const cap of caps) {
      const [existingCap] = await db
        .select()
        .from(householdCategoryCaps)
        .where(
          and(
            eq(householdCategoryCaps.householdId, householdId),
            eq(householdCategoryCaps.category, cap.category)
          )
        )
        .limit(1);

      if (existingCap) {
        await db
          .update(householdCategoryCaps)
          .set({
            capAmount: cap.capAmount,
            rolloverPolicy: cap.rolloverPolicy,
            allocatedByUserId: userId,
          })
          .where(eq(householdCategoryCaps.id, existingCap.id));
      } else {
        await db.insert(householdCategoryCaps).values({
          householdId,
          category: cap.category,
          capAmount: cap.capAmount,
          rolloverPolicy: cap.rolloverPolicy,
          allocatedByUserId: userId,
        });
      }
    }

    // Update member allocations if provided
    if (allocations && allocations.length > 0) {
      for (const alloc of allocations) {
        const allocId = `alloc_${cycleId}_${alloc.category}_${alloc.contributedByUserId || userId}`;
        await db
          .insert(module20HouseholdCapAllocations)
          .values({
            id: allocId,
            cycleId,
            category: alloc.category,
            capAmount: alloc.capAmount,
            contributedByUserId: alloc.contributedByUserId || userId,
          })
          .onConflictDoUpdate({
            target: module20HouseholdCapAllocations.id,
            set: { capAmount: alloc.capAmount },
          });
      }
    }

    return NextResponse.json({
      success: true,
      cycleId,
      totalCap,
    });
  })
);
