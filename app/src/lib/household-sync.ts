/**
 * @fileoverview Collaborative Household Split-Ledger Bridge & Real-Time Sync.
 *
 * Implements strict double-entry collaborative accounting between Household shared expenses,
 * recurring household bills, member settlement confirmations, and the user's personal bank accounts.
 *
 * @module lib/household-sync
 */

import { ReadableStreamDefaultController } from 'stream/web';
import { db } from '@/db/client';
import { transactions, householdExpenses, householdMembers, householdSettlements, accounts } from '@/db/schema';
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
  householdSyncClients?: Map<number, Set<SyncClient>>;
};

if (!globalClients.householdSyncClients) {
  globalClients.householdSyncClients = new Map();
}

export const householdSyncClients = globalClients.householdSyncClients;

export function addHouseholdSyncClient(householdId: number, userId: number, controller: any): () => void {
  let clients = householdSyncClients.get(householdId);
  if (!clients) {
    clients = new Set();
    householdSyncClients.set(householdId, clients);
  }
  const client: SyncClient = { controller, userId };
  clients.add(client);

  return () => {
    clients?.delete(client);
    if (clients && clients.size === 0) {
      householdSyncClients.delete(householdId);
    }
  };
}

export function broadcastHouseholdUpdate(householdId: number, payload: { type: string; data?: any }): void {
  const clients = householdSyncClients.get(householdId);
  if (!clients || clients.size === 0) return;

  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify(payload)}\n\n`;
  const encoded = encoder.encode(message);

  clients.forEach((client) => {
    try {
      client.controller.enqueue(encoded);
    } catch {
      // Stream disconnected
    }
  });
}

// ────────────────────────────────────────────────────────────
// 2. ATOMIC COLLABORATIVE LEDGER BRIDGE
// ────────────────────────────────────────────────────────────

export interface SyncHouseholdExpenseInput {
  householdId: number;
  expenseId: number;
  totalAmount: number;
  category: string;
  description: string;
  payerUserId: number;
  fundingAccountId?: number | null;
  personalShareAmount: number;
  currentUserId: number;
  date?: string;
}

/**
 * Synchronizes a household expense to the paying member's personal ledger.
 */
export async function syncHouseholdExpenseToPersonalLedger(
  input: SyncHouseholdExpenseInput
): Promise<{ linkedTransactionId?: number; reimbursementStatus: 'none' | 'receivable' | 'payable' }> {
  const {
    householdId,
    expenseId,
    totalAmount,
    category,
    description,
    payerUserId,
    fundingAccountId,
    personalShareAmount,
    currentUserId,
    date = new Date().toISOString().split('T')[0],
  } = input;

  const isPayer = payerUserId === currentUserId;

  if (isPayer && fundingAccountId) {
    const reimbursementStatus: 'none' | 'receivable' =
      totalAmount > personalShareAmount ? 'receivable' : 'none';

    // Check for existing transaction linked to this household expense
    const existing = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, currentUserId),
          eq(transactions.collaborativeSourceType, 'household'),
          eq(transactions.collaborativeExpenseId, String(expenseId))
        )
      )
      .limit(1);

    let linkedTransactionId: number;

    if (existing.length > 0) {
      const prevTx = existing[0];
      const delta = prevTx.amount - totalAmount;

      if (prevTx.accountId === fundingAccountId) {
        if (delta !== 0) {
          await AccountRepository.updateBalance(fundingAccountId, delta);
        }
      } else {
        if (prevTx.accountId) {
          await AccountRepository.updateBalance(prevTx.accountId, prevTx.amount);
        }
        await AccountRepository.updateBalance(fundingAccountId, -totalAmount);
      }

      await TransactionRepository.update(currentUserId, prevTx.id, {
        amount: totalAmount,
        personalShareAmount,
        reimbursementStatus,
        category: category || 'Bills & Utilities',
        description: description || 'Household expense',
        date,
        accountId: fundingAccountId,
      });

      linkedTransactionId = prevTx.id;
    } else {
      const newTx = await TransactionRepository.create({
        userId: currentUserId,
        type: 'expense',
        amount: totalAmount,
        personalShareAmount,
        reimbursementStatus,
        collaborativeSourceType: 'household',
        collaborativeSourceId: String(householdId),
        collaborativeExpenseId: String(expenseId),
        accountId: fundingAccountId,
        category: category || 'Bills & Utilities',
        description: description || 'Household expense',
        date,
      });

      // Deduct full amount paid from the linked personal account
      await AccountRepository.updateBalance(fundingAccountId, -totalAmount);
      linkedTransactionId = newTx.id;
    }

    return { linkedTransactionId, reimbursementStatus };
  }

  return {
    reimbursementStatus: isPayer ? 'none' : 'payable',
  };
}

/**
 * Reverses account balance impact and deletes linked transaction when a household expense is deleted.
 */
export async function deleteHouseholdExpensePersonalLedger(
  expenseId: number,
  userId: number
): Promise<void> {
  const existing = await db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.collaborativeSourceType, 'household'),
        eq(transactions.collaborativeExpenseId, String(expenseId))
      )
    )
    .limit(1);

  if (existing.length > 0) {
    const tx = existing[0];
    if (tx.accountId) {
      await AccountRepository.updateBalance(tx.accountId, tx.amount);
    }
    await TransactionRepository.delete(userId, tx.id);
  }
}

/**
 * Records a confirmed settlement transfer on the personal bank account of the paying or receiving member.
 * Marked with `isSettlementTransfer = 1` so bank balance updates accurately without altering monthly P&L.
 */
export async function recordHouseholdSettlementTransfer(params: {
  householdId: number;
  settlementId: number;
  userId: number;
  amount: number;
  isPayer: boolean;
  accountId?: number | null;
  counterpartName?: string;
  date?: string;
}): Promise<number | undefined> {
  const {
    householdId,
    settlementId,
    userId,
    amount,
    isPayer,
    accountId,
    counterpartName,
    date = new Date().toISOString().split('T')[0],
  } = params;

  if (!accountId) return undefined;

  const desc = isPayer
    ? `Household settlement paid to ${counterpartName || 'member'}`
    : `Household settlement received from ${counterpartName || 'member'}`;

  const createdTx = await TransactionRepository.create({
    userId,
    type: isPayer ? 'transfer' : 'earning',
    amount,
    personalShareAmount: 0,
    reimbursementStatus: 'settled',
    collaborativeSourceType: 'household',
    collaborativeSourceId: String(householdId),
    collaborativeExpenseId: String(settlementId),
    isSettlementTransfer: 1,
    accountId,
    category: 'Transfer',
    description: desc,
    date,
  });

  const balanceDelta = isPayer ? -amount : amount;
  await AccountRepository.updateBalance(accountId, balanceDelta);

  return createdTx.id;
}

// ────────────────────────────────────────────────────────────
// 3. COLLABORATIVE RECEIVABLES & PAYABLES SUMMARY
// ────────────────────────────────────────────────────────────

/**
 * Calculates total household receivables and payables for a user.
 */
export async function getHouseholdReceivablesAndPayables(
  userId: number
): Promise<{ receivables: number; payables: number }> {
  // Receivables from user's paid expenses where reimbursementStatus is 'receivable'
  const recResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${transactions.amount} - COALESCE(${transactions.personalShareAmount}, 0)), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.collaborativeSourceType, 'household'),
        eq(transactions.reimbursementStatus, 'receivable')
      )
    );

  // Payables from unsettled pending settlements where user is the debtor/payer
  const payResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${householdSettlements.amount}), 0)`,
    })
    .from(householdSettlements)
    .where(
      and(
        eq(householdSettlements.payerId, userId),
        eq(householdSettlements.status, 'pending')
      )
    );

  return {
    receivables: Number(recResult[0]?.total ?? 0),
    payables: Number(payResult[0]?.total ?? 0),
  };
}
