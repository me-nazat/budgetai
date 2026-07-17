export const dynamic = 'force-dynamic';

/**
 * @fileoverview Household expenses API.
 *
 * POST — Add a shared expense to a household
 *
 * @module api/households/expenses
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { householdExpenses, householdMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
