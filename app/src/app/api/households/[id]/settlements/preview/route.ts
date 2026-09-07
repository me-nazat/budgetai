export const dynamic = 'force-dynamic';

/**
 * @fileoverview Household settlement preview and automated settlement generation API.
 * Feature 10.2: Recurring Auto-Split Bills + Settlement Workflow.
 *
 * GET  /api/households/[id]/settlements/preview — Computes net balances & minimal settlement plan
 * POST /api/households/[id]/settlements/preview — Generates upcoming settlement rows & notifications
 *
 * @module api/households/[id]/settlements/preview
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  householdMembers,
  householdExpenses,
  householdSettlements,
  module20UpcomingSettlements,
  users,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { calculateMinSettlements, BalanceNode } from '@/lib/algorithms/minSettlement';
import { PushService } from '@/services/push.service';
import crypto from 'crypto';

type RouteContext = { params: Promise<{ id: string }> };

async function computeHouseholdBalances(householdId: number): Promise<{
  balanceNodes: BalanceNode[];
  membersMap: Map<number, string>;
}> {
  const members = await db
    .select({
      userId: householdMembers.userId,
      userName: users.name,
    })
    .from(householdMembers)
    .innerJoin(users, eq(householdMembers.userId, users.id))
    .where(eq(householdMembers.householdId, householdId));

  const membersMap = new Map<number, string>();
  members.forEach((m) => membersMap.set(m.userId, m.userName || `User #${m.userId}`));

  if (members.length === 0) {
    return { balanceNodes: [], membersMap };
  }

  // 1. Calculate total paid by each user in household expenses
  const expenses = await db
    .select({
      userId: householdExpenses.userId,
      amount: householdExpenses.amount,
      splitBetween: householdExpenses.splitBetween,
    })
    .from(householdExpenses)
    .where(eq(householdExpenses.householdId, householdId));

  const netMap = new Map<number, number>();
  members.forEach((m) => netMap.set(m.userId, 0));

  for (const exp of expenses) {
    // Payer gets positive balance for the full amount
    netMap.set(exp.userId, (netMap.get(exp.userId) || 0) + exp.amount);

    // If split between all equally:
    const splitCount = members.length;
    const equalShare = splitCount > 0 ? exp.amount / splitCount : 0;
    for (const m of members) {
      netMap.set(m.userId, (netMap.get(m.userId) || 0) - equalShare);
    }
  }

  // 2. Adjust for already settled payments
  const settledPayments = await db
    .select()
    .from(householdSettlements)
    .where(
      and(
        eq(householdSettlements.householdId, householdId),
        eq(householdSettlements.status, 'settled')
      )
    );

  for (const s of settledPayments) {
    netMap.set(s.payerId, (netMap.get(s.payerId) || 0) + s.amount);
    netMap.set(s.payeeId, (netMap.get(s.payeeId) || 0) - s.amount);
  }

  const balanceNodes: BalanceNode[] = Array.from(netMap.entries()).map(([userId, netBalance]) => ({
    userId,
    userName: membersMap.get(userId) || `User #${userId}`,
    netBalance: Math.round(netBalance * 100) / 100,
  }));

  return { balanceNodes, membersMap };
}

export const GET = apiHandler(
  withAuth<RouteContext>(async (_request: NextRequest, { userId }, routeContext) => {
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

    const { balanceNodes, membersMap } = await computeHouseholdBalances(householdId);
    const minSettlements = calculateMinSettlements(balanceNodes);

    const upcomingSettlements = await db
      .select({
        id: module20UpcomingSettlements.id,
        householdId: module20UpcomingSettlements.householdId,
        fromUserId: module20UpcomingSettlements.fromUserId,
        toUserId: module20UpcomingSettlements.toUserId,
        amount: module20UpcomingSettlements.amount,
        dueDate: module20UpcomingSettlements.dueDate,
        status: module20UpcomingSettlements.status,
        createdAt: module20UpcomingSettlements.createdAt,
      })
      .from(module20UpcomingSettlements)
      .where(eq(module20UpcomingSettlements.householdId, householdId));

    const upcomingWithNames = upcomingSettlements.map((s) => ({
      ...s,
      fromUserName: membersMap.get(s.fromUserId) || `User #${s.fromUserId}`,
      toUserName: membersMap.get(s.toUserId) || `User #${s.toUserId}`,
    }));

    return NextResponse.json({
      balances: balanceNodes,
      minSettlements,
      upcomingSettlements: upcomingWithNames,
    });
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

    const { balanceNodes, membersMap } = await computeHouseholdBalances(householdId);
    const minSettlements = calculateMinSettlements(balanceNodes);

    const body = await request.json().catch(() => ({}));
    const dueDate = body.dueDate || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];

    const createdRows = [];
    for (const payment of minSettlements) {
      const settlementId = `settle_${crypto.randomUUID()}`;
      await db.insert(module20UpcomingSettlements).values({
        id: settlementId,
        householdId,
        fromUserId: Number(payment.fromUserId),
        toUserId: Number(payment.toUserId),
        amount: payment.amount,
        dueDate,
        status: 'pending',
      });

      createdRows.push({
        id: settlementId,
        fromUserId: payment.fromUserId,
        fromUserName: payment.fromUserName,
        toUserId: payment.toUserId,
        toUserName: payment.toUserName,
        amount: payment.amount,
        dueDate,
        status: 'pending',
      });

      // Send push notification to payee
      try {
        await PushService.sendToUser(Number(payment.toUserId), {
          title: 'New Household Settlement Scheduled',
          body: `${payment.fromUserName || 'A member'} owes you $${payment.amount.toFixed(2)} for household expenses.`,
          url: `/household/${householdId}`,
        });
      } catch (err) {
        console.warn('[settlements] Failed to send push notification:', err);
      }
    }

    return NextResponse.json({
      success: true,
      minSettlements,
      upcomingSettlements: createdRows,
    });
  })
);
