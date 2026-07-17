export const dynamic = 'force-dynamic';

/**
 * @fileoverview Households API — V1 (Invite/Feed, no shared budgets).
 *
 * GET — List user's households
 * POST — Create a new household
 *
 * @module api/households
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { households, householdMembers, householdExpenses, users } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import crypto from 'crypto';

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * GET /api/households
 */
export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (_request, { userId }) => {
    // Get all households the user is a member of
    const memberships = await db
      .select({
        householdId: householdMembers.householdId,
        role: householdMembers.role,
        householdName: households.name,
        inviteCode: households.inviteCode,
        createdBy: households.createdBy,
        createdAt: households.createdAt,
      })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, userId));

    // For each household, get members and recent expenses
    const result = await Promise.all(
      memberships.map(async (m) => {
        const members = await db
          .select({
            userId: householdMembers.userId,
            role: householdMembers.role,
            joinedAt: householdMembers.joinedAt,
            name: users.name,
            email: users.email,
          })
          .from(householdMembers)
          .innerJoin(users, eq(householdMembers.userId, users.id))
          .where(eq(householdMembers.householdId, m.householdId));

        const recentExpenses = await db
          .select()
          .from(householdExpenses)
          .where(eq(householdExpenses.householdId, m.householdId))
          .orderBy(desc(householdExpenses.createdAt))
          .limit(20);

        return {
          id: m.householdId,
          name: m.householdName,
          inviteCode: m.inviteCode,
          role: m.role,
          createdAt: m.createdAt,
          members,
          recentExpenses,
        };
      })
    );

    return NextResponse.json({ households: result });
  })
);

/**
 * POST /api/households
 */
export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const validated = CreateSchema.parse(body);

    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const [household] = await db
      .insert(households)
      .values({
        name: validated.name,
        inviteCode,
        createdBy: userId,
      })
      .returning();

    // Add creator as owner
    await db.insert(householdMembers).values({
      householdId: household.id,
      userId,
      role: 'owner',
    });

    return NextResponse.json({
      id: household.id,
      name: household.name,
      inviteCode,
      message: 'Household created',
    }, { status: 201 });
  }),
  { rateLimit: 'api' }
);
