export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  householdMembers,
  householdSplitRules,
  module20UpcomingSettlements,
  transactions,
  accounts,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

type RouteContext = { params: Promise<{ id: string; billId: string }> };

export const POST = apiHandler(
  withAuth<RouteContext>(async (request: NextRequest, { userId }, routeContext) => {
    const { id, billId } = await routeContext.params;
    const householdId = parseInt(id, 10);
    const ruleId = parseInt(billId, 10);

    if (isNaN(householdId) || isNaN(ruleId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 1. Verify membership
    const [membership] = await db
      .select()
      .from(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden: not a household member' }, { status: 403 });
    }

    // 2. Fetch bill rule
    const [rule] = await db
      .select()
      .from(householdSplitRules)
      .where(and(eq(householdSplitRules.id, ruleId), eq(householdSplitRules.householdId, householdId)))
      .limit(1);

    if (!rule) {
      return NextResponse.json({ error: 'Recurring bill not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const accountId = body.accountId ? Number(body.accountId) : null;

    // 3. Fetch all household members
    const allMembers = await db
      .select({ userId: householdMembers.userId })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId));

    const totalMembers = allMembers.length || 1;

    let parsedShares: Record<string, number> = {};
    try {
      if (rule.splitShares) parsedShares = JSON.parse(rule.splitShares);
    } catch {
      parsedShares = {};
    }

    // Compute user's personal share vs other members' shares
    let myShare = 0;
    const debtsToInsert: { fromUserId: number; amount: number }[] = [];

    allMembers.forEach((m) => {
      let memberShare = 0;
      if (rule.splitType === 'equal') {
        memberShare = Math.round((rule.amount / totalMembers) * 100) / 100;
      } else if (rule.splitType === 'percentage') {
        const pct = parsedShares[String(m.userId)] || 0;
        memberShare = Math.round(((rule.amount * pct) / 100) * 100) / 100;
      } else if (rule.splitType === 'fixed') {
        memberShare = parsedShares[String(m.userId)] || 0;
      }

      if (m.userId === userId) {
        myShare = memberShare;
      } else if (memberShare > 0) {
        debtsToInsert.push({ fromUserId: m.userId, amount: memberShare });
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const dueDateStr = dueDate.toISOString().split('T')[0];

    // 4. Record transaction in database
    const [insertedTx] = await db
      .insert(transactions)
      .values({
        userId,
        accountId: accountId || null,
        amount: rule.amount,
        type: 'expense',
        category: rule.category || 'Bills & Utilities',
        description: `Household Bill: ${rule.name}`,
        date: todayStr,
        personalShareAmount: myShare,
        reimbursementStatus: debtsToInsert.length > 0 ? 'receivable' : 'none',
        collaborativeSourceType: 'household',
        collaborativeSourceId: String(householdId),
      })
      .returning();

    // 5. If account is selected, deduct total amount from account balance
    if (accountId) {
      await db
        .update(accounts)
        .set({
          currentBalance: sql`${accounts.currentBalance} - ${rule.amount}`,
        })
        .where(eq(accounts.id, accountId));
    }

    // 6. Queue roommates' shares into settlement stack
    for (const debt of debtsToInsert) {
      await db.insert(module20UpcomingSettlements).values({
        id: randomUUID(),
        householdId,
        fromUserId: debt.fromUserId,
        toUserId: userId,
        amount: debt.amount,
        dueDate: dueDateStr,
        status: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      transactionId: insertedTx?.id,
      personalShare: myShare,
      owedToUser: rule.amount - myShare,
      settlementsQueued: debtsToInsert.length,
    });
  })
);
