export const dynamic = 'force-dynamic';

/**
 * @fileoverview Household join API.
 *
 * POST — Join an existing household by invite code
 *
 * @module api/households/join
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { households, householdMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const JoinSchema = z.object({
  inviteCode: z.string().min(1).max(20),
});

/**
 * POST /api/households/join
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const { inviteCode } = JoinSchema.parse(body);

    // Find household by invite code
    const [household] = await db
      .select()
      .from(households)
      .where(eq(households.inviteCode, inviteCode.toUpperCase()))
      .limit(1);

    if (!household) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Check if already a member
    const [existing] = await db
      .select()
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, household.id),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: 'Already a member of this household' },
        { status: 409 }
      );
    }

    // Add as member
    await db.insert(householdMembers).values({
      householdId: household.id,
      userId,
      role: 'member',
    });

    return NextResponse.json({
      householdId: household.id,
      householdName: household.name,
      message: 'Joined household successfully',
    });
  }),
  { rateLimit: 'api' }
);
