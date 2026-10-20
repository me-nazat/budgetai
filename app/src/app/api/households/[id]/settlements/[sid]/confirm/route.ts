export const dynamic = 'force-dynamic';

/**
 * @fileoverview Confirm / mark paid an upcoming settlement for a household.
 * Feature 10.2: Recurring Auto-Split Bills + Settlement Workflow.
 *
 * POST /api/households/[id]/settlements/[sid]/confirm
 *
 * @module api/households/[id]/settlements/[sid]/confirm
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  householdMembers,
  householdSettlements,
  module20UpcomingSettlements,
  users,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { PushService } from '@/services/push.service';
import {
  recordHouseholdSettlementTransfer,
  broadcastHouseholdUpdate,
} from '@/lib/household-sync';

type RouteContext = { params: Promise<{ id: string; sid: string }> };

export const POST = apiHandler(
  withAuth<RouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    const { id, sid } = await routeContext.params;
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

    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId ? Number(body.accountId) : null;

    // Find upcoming settlement
    const [upcoming] = await db
      .select()
      .from(module20UpcomingSettlements)
      .where(
        and(
          eq(module20UpcomingSettlements.id, sid),
          eq(module20UpcomingSettlements.householdId, householdId)
        )
      )
      .limit(1);

    if (!upcoming) {
      return NextResponse.json({ error: 'Settlement not found' }, { status: 404 });
    }

    // Update upcoming status to paid
    await db
      .update(module20UpcomingSettlements)
      .set({ status: 'paid' })
      .where(eq(module20UpcomingSettlements.id, sid));

    const isPayer = upcoming.fromUserId === userId;

    // Record in householdSettlements
    const [settlement] = await db
      .insert(householdSettlements)
      .values({
        householdId,
        payerId: upcoming.fromUserId,
        payeeId: upcoming.toUserId,
        amount: upcoming.amount,
        status: 'settled',
        settledAt: new Date().toISOString(),
        payerAccountId: isPayer ? accountId : null,
        payeeAccountId: !isPayer ? accountId : null,
        settlementAccountId: accountId,
      })
      .returning();

    // If an account was linked, record settlement transfer on personal bank ledger
    let linkedTxId: number | undefined;
    if (accountId) {
      const counterpartId = isPayer ? upcoming.toUserId : upcoming.fromUserId;
      const [counterpart] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, counterpartId))
        .limit(1);

      linkedTxId = await recordHouseholdSettlementTransfer({
        householdId,
        settlementId: settlement.id,
        userId,
        amount: upcoming.amount,
        isPayer,
        accountId,
        counterpartName: counterpart?.name,
        date: new Date().toISOString().split('T')[0],
      });

      if (linkedTxId) {
        await db
          .update(householdSettlements)
          .set({ linkedTransactionId: linkedTxId })
          .where(eq(householdSettlements.id, settlement.id));
      }
    }

    // Broadcast SSE update
    broadcastHouseholdUpdate(householdId, {
      type: 'SETTLEMENT_CONFIRMED',
      data: {
        settlementId: sid,
        status: 'paid',
        amount: upcoming.amount,
        linkedTransactionId: linkedTxId,
      },
    });

    // Notify payer that settlement was confirmed
    try {
      const [payee] = await db.select({ name: users.name }).from(users).where(eq(users.id, upcoming.toUserId)).limit(1);
      await PushService.sendToUser(upcoming.fromUserId, {
        title: 'Settlement Confirmed Paid',
        body: `${payee?.name || 'Payee'} confirmed receipt of your $${upcoming.amount.toFixed(2)} payment.`,
        url: `/household/${householdId}`,
      });
    } catch (err) {
      console.warn('[settlement-confirm] Push failed:', err);
    }

    return NextResponse.json({
      success: true,
      settlementId: sid,
      status: 'paid',
      linkedTransactionId: linkedTxId,
    });
  })
);
