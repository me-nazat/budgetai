/**
 * @fileoverview Collaborative Tour Split-Ledger Bridge & Real-Time Sync.
 *
 * Implements strict double-entry collaborative accounting between Tour Group expenses
 * and the user's personal financial ledger (accounts & transactions), plus Server-Sent Events.
 *
 * @module lib/tour-sync
 */

import { ReadableStreamDefaultController } from 'stream/web';
import { db } from '@/db/client';
import { transactions, tourSpendings, tourParticipants, accounts } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { AccountRepository } from '@/repositories/account.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';

// ────────────────────────────────────────────────────────────
// 1. REAL-TIME SERVER-SENT EVENTS (SSE) STREAMING
// ────────────────────────────────────────────────────────────

type SyncClient = {
  controller: ReadableStreamDefaultController;
  userId: number;
};

const globalClients = globalThis as unknown as {
  tourSyncClients?: Map<number, Set<SyncClient>>;
};

if (!globalClients.tourSyncClients) {
  globalClients.tourSyncClients = new Map();
}

export const tourSyncClients = globalClients.tourSyncClients;

export function addSyncClient(tourId: number, userId: number, controller: any) {
  let clients = tourSyncClients.get(tourId);
  if (!clients) {
    clients = new Set();
    tourSyncClients.set(tourId, clients);
  }
  const client = { controller, userId };
  clients.add(client);

  return () => {
    clients?.delete(client);
    if (clients && clients.size === 0) {
      tourSyncClients.delete(tourId);
    }
  };
}

export function broadcastTourUpdate(tourId: number, payload: { type: string; data?: any }) {
  const clients = tourSyncClients.get(tourId);
  if (!clients || clients.size === 0) return;

  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = encoder.encode(message);

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // Stream closed; handled on cleanup
    }
  });
}

// ────────────────────────────────────────────────────────────
// 2. ATOMIC COLLABORATIVE LEDGER BRIDGE
// ────────────────────────────────────────────────────────────

export interface SyncTourSpendingInput {
  tourId: number;
  spendingId: number;
  totalAmount: number;
  category: string;
  description: string;
  date: string;
  payerParticipantId: number;
  linkedAccountId?: number | null;
  splitType?: string;
  splitBreakdownJson?: string | null;
  currentUserId: number;
}

export interface SyncTourSpendingResult {
  linkedTransactionId?: number;
  personalShareAmount: number;
  reimbursementStatus: 'none' | 'receivable' | 'payable' | 'settled';
  isPayer: boolean;
  userShareAmount: number;
}

/**
 * Parses user share amount from splitBreakdownJson or falls back to equal share.
 */
export function extractUserShare(
  totalAmount: number,
  userId: number,
  participantRows: Array<{ id: number; userId: number | null }>,
  splitBreakdownJson?: string | null
): { participantId: number | null; shareAmount: number } {
  const userParticipant = participantRows.find((p) => p.userId === userId);
  const participantId = userParticipant ? userParticipant.id : null;

  if (splitBreakdownJson) {
    try {
      const breakdown = JSON.parse(splitBreakdownJson);
      if (Array.isArray(breakdown) && breakdown.length > 0) {
        const item = breakdown.find(
          (b: any) =>
            (participantId && b.memberId === participantId) ||
            b.userId === userId ||
            b.id === participantId
        );
        if (item && typeof item.shareAmount === 'number') {
          return { participantId, shareAmount: Math.round(item.shareAmount * 100) / 100 };
        }
      }
    } catch {
      // Fallback to equal
    }
  }

  // Equal split fallback
  const count = Math.max(1, participantRows.length);
  const share = Math.round((totalAmount / count) * 100) / 100;
  return { participantId, shareAmount: share };
}

/**
 * Synchronizes a tour spending entry to the user's personal ledger atomically.
 */
export async function syncTourSpendingToPersonalLedger(
  input: SyncTourSpendingInput
): Promise<SyncTourSpendingResult> {
  const {
    tourId,
    spendingId,
    totalAmount,
    category,
    description,
    date,
    payerParticipantId,
    linkedAccountId,
    splitBreakdownJson,
    currentUserId,
  } = input;

  // Fetch participants for this tour to match userId with participantId
  const participants = await db
    .select({ id: tourParticipants.id, userId: tourParticipants.userId })
    .from(tourParticipants)
    .where(eq(tourParticipants.tourId, tourId));

  const { participantId: currentParticipantId, shareAmount: userShareAmount } = extractUserShare(
    totalAmount,
    currentUserId,
    participants,
    splitBreakdownJson
  );

  const isPayer = currentParticipantId !== null && currentParticipantId === payerParticipantId;

  // Case 1: Current user is the payer and linked a personal account
  if (isPayer && linkedAccountId) {
    const reimbursementStatus: 'none' | 'receivable' =
      totalAmount > userShareAmount ? 'receivable' : 'none';

    // Check for existing transaction linked to this tour spending
    const existing = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, currentUserId),
          eq(transactions.collaborativeSourceType, 'tour'),
          eq(transactions.collaborativeExpenseId, String(spendingId))
        )
      )
      .limit(1);

    let linkedTransactionId: number;

    if (existing.length > 0) {
      const prevTx = existing[0];
      const delta = prevTx.amount - totalAmount;

      // Adjust account balance by delta if account matches, or transfer between accounts
      if (prevTx.accountId === linkedAccountId) {
        if (delta !== 0) {
          await AccountRepository.updateBalance(linkedAccountId, delta);
        }
      } else {
        // Reverse old account and charge new account
        if (prevTx.accountId) {
          await AccountRepository.updateBalance(prevTx.accountId, prevTx.amount);
        }
        await AccountRepository.updateBalance(linkedAccountId, -totalAmount);
      }

      await TransactionRepository.update(currentUserId, prevTx.id, {
        amount: totalAmount,
        personalShareAmount: userShareAmount,
        reimbursementStatus,
        category: category || 'Travel',
        description: description || `Tour expense: ${description}`,
        date,
        accountId: linkedAccountId,
      });

      linkedTransactionId = prevTx.id;
    } else {
      // Create new personal transaction
      const newTx = await TransactionRepository.create({
        userId: currentUserId,
        type: 'expense',
        amount: totalAmount,
        personalShareAmount: userShareAmount,
        reimbursementStatus,
        collaborativeSourceType: 'tour',
        collaborativeSourceId: String(tourId),
        collaborativeExpenseId: String(spendingId),
        accountId: linkedAccountId,
        category: category || 'Travel',
        description: description || 'Tour expense',
        date,
      });

      // Deduct full out-of-pocket cash from the linked account
      await AccountRepository.updateBalance(linkedAccountId, -totalAmount);
      linkedTransactionId = newTx.id;
    }

    return {
      linkedTransactionId,
      personalShareAmount: userShareAmount,
      reimbursementStatus,
      isPayer: true,
      userShareAmount,
    };
  }

  // Case 2: Another member paid, but current user owes a share
  return {
    personalShareAmount: userShareAmount,
    reimbursementStatus: isPayer ? 'none' : 'payable',
    isPayer,
    userShareAmount,
  };
}

/**
 * Reverses account balance impact and removes the linked personal transaction when a tour spending is deleted.
 */
export async function deleteTourSpendingPersonalLedger(
  tourIdOrSpendingId: number,
  spendingIdOrUserId: number,
  maybeUserId?: number
): Promise<void> {
  const spendingId = maybeUserId !== undefined ? spendingIdOrUserId : tourIdOrSpendingId;
  const userId = maybeUserId !== undefined ? maybeUserId : spendingIdOrUserId;
  const existing = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.collaborativeSourceType, 'tour'),
        eq(transactions.collaborativeExpenseId, String(spendingId))
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const tx = existing[0];
    if (tx.accountId) {
      // Refund the cash back into the account
      await AccountRepository.updateBalance(tx.accountId, tx.amount);
    }
    await TransactionRepository.delete(userId, tx.id);
  }
}

/**
 * Records a tour debt settlement payback transfer between members.
 * Updates bank account balance without impacting monthly P&L or budget envelope consumption.
 */
export async function recordTourSettlementTransfer(params: {
  tourId: number;
  spendingId: number;
  userId: number;
  amount: number;
  isPayer: boolean;
  linkedAccountId?: number | null;
  counterpartName?: string;
  date?: string;
}): Promise<number | undefined> {
  const {
    tourId,
    spendingId,
    userId,
    amount,
    isPayer,
    linkedAccountId,
    counterpartName,
    date = new Date().toISOString().split('T')[0],
  } = params;

  if (!linkedAccountId) return undefined;

  const desc = isPayer
    ? `Tour debt settlement to ${counterpartName || 'member'}`
    : `Tour debt settlement received from ${counterpartName || 'member'}`;

  const createdTx = await TransactionRepository.create({
    userId,
    type: isPayer ? 'transfer' : 'earning',
    amount,
    personalShareAmount: 0,
    reimbursementStatus: 'settled',
    collaborativeSourceType: 'tour',
    collaborativeSourceId: String(tourId),
    collaborativeExpenseId: String(spendingId),
    isSettlementTransfer: 1,
    accountId: linkedAccountId,
    category: 'Transfer',
    description: desc,
    date,
  });

  // Adjust account balance: payer loses cash, receiver gains cash
  const balanceDelta = isPayer ? -amount : amount;
  await AccountRepository.updateBalance(linkedAccountId, balanceDelta);

  return createdTx.id;
}

// ────────────────────────────────────────────────────────────
// 3. TOUR KITTY / POOL SUMMARY & COLLABORATIVE RECEIVABLES
// ────────────────────────────────────────────────────────────

/**
 * Computes the real-time kitty balance for a tour from deposits and pool-funded spendings.
 */
export async function calculateTourKitty(tourId: number): Promise<{
  totalDeposited: number;
  totalSpentFromKitty: number;
  remainingKittyBalance: number;
}> {
  const rows = await db
    .select({
      entryType: tourSpendings.entryType,
      fundingSource: tourSpendings.fundingSource,
      amount: tourSpendings.amount,
      exchangeRateToTourBase: tourSpendings.exchangeRateToTourBase,
    })
    .from(tourSpendings)
    .where(eq(tourSpendings.tourId, tourId));

  let totalDeposited = 0;
  let totalSpentFromKitty = 0;

  for (const r of rows) {
    const rate = r.exchangeRateToTourBase || 1.0;
    const baseAmount = r.amount * rate;

    if (r.entryType === 'deposit') {
      totalDeposited += baseAmount;
    } else if (r.fundingSource === 'tour_pool' && r.entryType !== 'settlement') {
      totalSpentFromKitty += baseAmount;
    }
  }

  return {
    totalDeposited: Math.round(totalDeposited * 100) / 100,
    totalSpentFromKitty: Math.round(totalSpentFromKitty * 100) / 100,
    remainingKittyBalance: Math.round((totalDeposited - totalSpentFromKitty) * 100) / 100,
  };
}

/**
 * Retrieves unsettled tour payables where another member paid but the current user owes a share,
 * for inclusion in monthly category budget calculations.
 */
export async function getUnsettledTourPayablesForUser(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<Array<{ tourId: number; spendingId: number; category: string; amount: number; date: string }>> {
  // Find all participant IDs belonging to this user
  const userParticipants = await db
    .select({ id: tourParticipants.id, tourId: tourParticipants.tourId })
    .from(tourParticipants)
    .where(eq(tourParticipants.userId, userId));

  if (userParticipants.length === 0) return [];

  const tourIds = userParticipants.map((up) => up.tourId);
  const participantIds = new Set(userParticipants.map((up) => up.id));

  // Query tour spendings in date range where user was not the payer
  const query = db
    .select({
      id: tourSpendings.id,
      tourId: tourSpendings.tourId,
      amount: tourSpendings.amount,
      category: tourSpendings.category,
      date: tourSpendings.date,
      paidByParticipantId: tourSpendings.paidByParticipantId,
      splitBreakdownJson: tourSpendings.splitBreakdownJson,
      entryType: tourSpendings.entryType,
    })
    .from(tourSpendings)
    .where(
      and(
        inArray(tourSpendings.tourId, tourIds),
        eq(tourSpendings.entryType, 'expense'),
        startDate ? sql`DATE(${tourSpendings.date}) >= ${startDate}` : sql`1=1`,
        endDate ? sql`DATE(${tourSpendings.date}) <= ${endDate}` : sql`1=1`
      )
    );

  const spendings = await query;
  const payables: Array<{ tourId: number; spendingId: number; category: string; amount: number; date: string }> = [];

  for (const s of spendings) {
    if (participantIds.has(s.paidByParticipantId)) {
      continue; // User paid this out-of-pocket themselves
    }

    if (s.splitBreakdownJson) {
      try {
        const breakdown = JSON.parse(s.splitBreakdownJson);
        if (Array.isArray(breakdown)) {
          const item = breakdown.find(
            (b: any) => participantIds.has(b.memberId) || b.userId === userId
          );
          if (item && item.shareAmount > 0 && !item.isSettled) {
            payables.push({
              tourId: s.tourId,
              spendingId: s.id,
              category: s.category || 'Travel',
              amount: item.shareAmount,
              date: s.date,
            });
          }
        }
      } catch {
        // Skip corrupt JSON
      }
    }
  }

  return payables;
}

/**
 * Calculates total tour receivables (owed to user) and payables (owed by user).
 */
export async function getTourReceivablesAndPayables(
  userId: number
): Promise<{ receivables: number; payables: number }> {
  // Query all transactions where user has reimbursementStatus 'receivable'
  const recResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount} - COALESCE(${transactions.personalShareAmount}, 0)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.collaborativeSourceType, 'tour'),
        eq(transactions.reimbursementStatus, 'receivable')
      )
    );

  const payablesList = await getUnsettledTourPayablesForUser(userId);
  const payablesTotal = payablesList.reduce((sum, p) => sum + p.amount, 0);

  return {
    receivables: Number(recResult[0]?.total ?? 0),
    payables: Math.round(payablesTotal * 100) / 100,
  };
}
