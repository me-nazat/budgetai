export const dynamic = 'force-dynamic';

/**
 * @fileoverview Household expenses API — Extended with GET and DELETE.
 *
 * GET  — List expenses for a household
 * POST — Add a shared expense to a household
 * DELETE — Remove a household expense
 *
 * @module api/households/expenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { householdExpenses, householdMembers, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

const CreateExpenseSchema = z.object({
  householdId: z.number().int().positive(),
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  category: z.string().min(1).max(50).default('Other'),
  splitBetween: z.union([
    z.literal('all'),
    z.array(z.number()),
  ]).default('all'),
});

/**
 * GET /api/households/expenses?householdId=123
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const url = new URL(request.url);
    const householdId = parseInt(url.searchParams.get('householdId') || '0');
    if (!householdId) {
      return NextResponse.json({ error: 'householdId required' }, { status: 400 });
    }

    // Verify membership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 });
    }

    const expenses = await db
      .select({
        id: householdExpenses.id,
        householdId: householdExpenses.householdId,
        userId: householdExpenses.userId,
        description: householdExpenses.description,
        amount: householdExpenses.amount,
        category: householdExpenses.category,
        splitBetween: householdExpenses.splitBetween,
        createdAt: householdExpenses.createdAt,
        userName: users.name,
      })
      .from(householdExpenses)
      .innerJoin(users, eq(householdExpenses.userId, users.id))
      .where(eq(householdExpenses.householdId, householdId))
      .orderBy(desc(householdExpenses.createdAt));

    return NextResponse.json({ expenses });
  })
);

/**
 * POST /api/households/expenses
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = CreateExpenseSchema.parse(body);

    // Verify membership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, validated.householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this household' },
        { status: 403 }
      );
    }

    // Check category cap if force parameter is not true
    const force = body.force === true;
    if (!force) {
      const { HouseholdRepository } = await import('@/repositories/household.repository');
      const capCheck = await HouseholdRepository.checkCategoryCap(
        validated.householdId,
        validated.category,
        validated.amount
      );

      if (capCheck.capExceeded) {
        return NextResponse.json(
          {
            warning: 'Category budget cap exceeded',
            overCap: true,
            category: validated.category,
            currentSpent: capCheck.currentSpent,
            projectedSpent: capCheck.projectedSpent ?? 0,
            capAmount: capCheck.capAmount ?? 0,
            message: `Adding this $${validated.amount.toFixed(2)} expense will bring ${validated.category} total to $${(capCheck.projectedSpent ?? 0).toFixed(2)}, exceeding the $${(capCheck.capAmount ?? 0).toFixed(2)} cap.`,
          },
          { status: 202 }
        );
      }
    }

    const [expense] = await db
      .insert(householdExpenses)
      .values({
        householdId: validated.householdId,
        userId,
        description: validated.description,
        amount: validated.amount,
        category: validated.category,
        splitBetween: typeof validated.splitBetween === 'string'
          ? validated.splitBetween
          : JSON.stringify(validated.splitBetween),
      })
      .returning();

    return NextResponse.json(expense, { status: 201 });
  }),
  { rateLimit: 'api' }
);

/**
 * DELETE /api/households/expenses?id=123
 */
export const DELETE = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const url = new URL(request.url);
    const expenseId = parseInt(url.searchParams.get('id') || '0');
    if (!expenseId) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // Fetch the expense to verify ownership/membership
    const [expense] = await db
      .select()
      .from(householdExpenses)
      .where(eq(householdExpenses.id, expenseId))
      .limit(1);

    if (!expense) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify membership in the household
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, expense.householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    // Only the expense creator or household owner can delete
    if (expense.userId !== userId && membership.role !== 'owner') {
      return NextResponse.json({ error: 'Only the creator or household owner can delete' }, { status: 403 });
    }

    await db.delete(householdExpenses).where(eq(householdExpenses.id, expenseId));

    return NextResponse.json({ success: true });
  }),
  { rateLimit: 'api' }
);
