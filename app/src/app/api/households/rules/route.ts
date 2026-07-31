export const dynamic = 'force-dynamic';

/**
 * @fileoverview Household recurring split rules API.
 *
 * GET  — List recurring split rules for a household
 * POST — Create a recurring split rule
 * DELETE — Delete a recurring split rule
 *
 * @module api/households/rules
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { HouseholdRepository } from '@/repositories/household.repository';
import { db } from '@/db/client';
import { householdMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const CreateRuleSchema = z.object({
  householdId: z.number().int().positive(),
  name: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().min(1).max(50).default('Bills & Utilities'),
  splitType: z.enum(['equal', 'percentage', 'fixed']).default('equal'),
  splitShares: z.string().optional(),
  frequency: z.enum(['monthly', 'biweekly', 'weekly']).default('monthly'),
  dayOfMonth: z.number().int().min(1).max(28).default(1),
  nextRunDate: z.string().optional(),
});

/**
 * GET /api/households/rules?householdId=123
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const url = new URL(request.url);
    const householdId = parseInt(url.searchParams.get('householdId') || '0');
    if (!householdId) {
      return NextResponse.json({ error: 'householdId required' }, { status: 400 });
    }

    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const rules = await HouseholdRepository.findSplitRules(householdId);
    return NextResponse.json({ rules });
  })
);

/**
 * POST /api/households/rules
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = CreateRuleSchema.parse(body);

    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, validated.householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const rule = await HouseholdRepository.createSplitRule({
      ...validated,
      createdByUserId: userId,
    });

    return NextResponse.json(rule, { status: 201 });
  })
);

/**
 * DELETE /api/households/rules?id=123&householdId=456
 */
export const DELETE = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const url = new URL(request.url);
    const id = parseInt(url.searchParams.get('id') || '0');
    const householdId = parseInt(url.searchParams.get('householdId') || '0');

    if (!id || !householdId) {
      return NextResponse.json({ error: 'id and householdId required' }, { status: 400 });
    }

    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    await HouseholdRepository.deleteSplitRule(id, householdId);
    return NextResponse.json({ success: true });
  })
);
