/**
 * @fileoverview Directed Debt Simplification & Fair-Share Penny Allocation Engine.
 *
 * Implements:
 * 1. Largest-Remainder (Hamilton / Hare-Niemeyer) penny allocation for exact-cent splits.
 * 2. Greedy Cash Flow Minimization with integer minor-unit arithmetic (preventing 0.01 floating-point drift).
 * 3. Partial & completed settlement tracking with debt graph simplification metrics.
 *
 * @module lib/algorithms/minSettlement
 */

export interface BalanceNode {
  userId: string | number;
  userName?: string;
  netBalance: number; // Positive = Owed money (creditor), Negative = Owes money (debtor)
}

export interface OptimizedPayment {
  fromUserId: string | number;
  fromUserName?: string;
  fromId?: string | number;
  fromName?: string;
  toUserId: string | number;
  toUserName?: string;
  toId?: string | number;
  toName?: string;
  amount: number;
  currency?: string;
}

export interface CompletedSettlement {
  fromId: string | number;
  toId: string | number;
  amount: number;
}

export interface SimplifiedDebtGraphResult {
  memberBalances: BalanceNode[];
  rawTransactionsCount: number;
  simplifiedTransfers: OptimizedPayment[];
  transfersSavedCount: number;
}

export interface ParticipantShareInput {
  id: string | number;
  name?: string;
  weight?: number;
}

export interface AllocatedShare {
  id: string | number;
  name?: string;
  shareAmount: number;
  sharePercentage: number;
}

/**
 * Largest-Remainder (Hamilton / Hare-Niemeyer) penny allocation.
 * Guarantees that the sum of all allocated shares equals `totalAmount` down to the exact penny,
 * deterministically breaking fractional ties.
 *
 * @example
 * allocatePennyShares(100, [{ id: 1 }, { id: 2 }, { id: 3 }])
 * // Returns shares of 33.34, 33.33, 33.33 (sum = 100.00 exactly)
 */
export function allocatePennyShares(
  totalAmount: number,
  participants: ParticipantShareInput[]
): AllocatedShare[] {
  if (!participants || participants.length === 0) return [];

  const totalCents = Math.round(totalAmount * 100);
  if (totalCents <= 0) {
    return participants.map((p) => ({
      id: p.id,
      name: p.name,
      shareAmount: 0,
      sharePercentage: 0,
    }));
  }

  const weights = participants.map((p) => (typeof p.weight === 'number' && p.weight > 0 ? p.weight : 1.0));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Compute raw fractional cents and integer base quotas
  const rawQuotas = participants.map((p, idx) => {
    const fraction = weights[idx] / totalWeight;
    const exactCents = totalCents * fraction;
    const floorCents = Math.floor(exactCents);
    const remainder = exactCents - floorCents;
    return {
      participant: p,
      fraction,
      floorCents,
      remainder,
      originalIndex: idx,
    };
  });

  const allocatedSumCents = rawQuotas.reduce((sum, q) => sum + q.floorCents, 0);
  const surplusCents = totalCents - allocatedSumCents;

  // Sort descending by largest remainder; tie-break deterministically by ID/index
  const sorted = [...rawQuotas].sort((a, b) => {
    if (Math.abs(b.remainder - a.remainder) > 0.000001) {
      return b.remainder - a.remainder;
    }
    return String(a.participant.id).localeCompare(String(b.participant.id));
  });

  for (let i = 0; i < surplusCents && i < sorted.length; i++) {
    sorted[i].floorCents += 1;
  }

  // Restore original ordering
  sorted.sort((a, b) => a.originalIndex - b.originalIndex);

  return sorted.map((item) => ({
    id: item.participant.id,
    name: item.participant.name,
    shareAmount: item.floorCents / 100,
    sharePercentage: Math.round(item.fraction * 10000) / 100,
  }));
}

/**
 * Calculates minimum cash-flow settlement transfers using integer-cent arithmetic.
 * Fully backward-compatible: returns an array of OptimizedPayment with embedded
 * graph reduction metrics (`rawTransactionsCount`, `simplifiedTransfers`, `transfersSavedCount`).
 */
export function calculateMinSettlements(
  balances: BalanceNode[],
  completedSettlements: CompletedSettlement[] = [],
  rawTransactionsCount = 0,
  currency = 'BDT'
): OptimizedPayment[] & {
  rawTransactionsCount: number;
  simplifiedTransfers: OptimizedPayment[];
  transfersSavedCount: number;
} {
  // Deep-clone and adjust balances for completed settlements if any
  const balanceMap = new Map<string | number, { name: string; cents: number }>();
  for (const b of balances) {
    balanceMap.set(b.userId, {
      name: b.userName || `User #${b.userId}`,
      cents: Math.round(b.netBalance * 100),
    });
  }

  // Deduct completed settlements: payer owed less (-debt = +balance), payee is owed less
  for (const cs of completedSettlements) {
    const csCents = Math.round(cs.amount * 100);
    if (balanceMap.has(cs.fromId)) {
      const fromNode = balanceMap.get(cs.fromId)!;
      fromNode.cents += csCents;
    }
    if (balanceMap.has(cs.toId)) {
      const toNode = balanceMap.get(cs.toId)!;
      toNode.cents -= csCents;
    }
  }

  const debtors: { userId: string | number; name: string; cents: number }[] = [];
  const creditors: { userId: string | number; name: string; cents: number }[] = [];

  for (const [userId, node] of balanceMap.entries()) {
    if (node.cents < -1) {
      debtors.push({ userId, name: node.name, cents: Math.abs(node.cents) });
    } else if (node.cents > 1) {
      creditors.push({ userId, name: node.name, cents: node.cents });
    }
  }

  // Sort descending by magnitude (Greedy largest-debtor to largest-creditor)
  debtors.sort((a, b) => b.cents - a.cents);
  creditors.sort((a, b) => b.cents - a.cents);

  const payments: OptimizedPayment[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledCents = Math.min(debtor.cents, creditor.cents);
    if (settledCents >= 1) {
      payments.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.name,
        fromId: debtor.userId,
        fromName: debtor.name,
        toUserId: creditor.userId,
        toUserName: creditor.name,
        toId: creditor.userId,
        toName: creditor.name,
        amount: settledCents / 100,
        currency,
      });
    }

    debtor.cents -= settledCents;
    creditor.cents -= settledCents;

    if (debtor.cents < 1) i++;
    if (creditor.cents < 1) j++;
  }

  // Attach metrics directly to the returned array for seamless dual use
  const result = payments as OptimizedPayment[] & {
    rawTransactionsCount: number;
    simplifiedTransfers: OptimizedPayment[];
    transfersSavedCount: number;
  };

  const defaultRawCount = rawTransactionsCount > 0 ? rawTransactionsCount : Math.max(payments.length, (balances.length * (balances.length - 1)) / 2);
  result.rawTransactionsCount = defaultRawCount;
  result.simplifiedTransfers = payments;
  result.transfersSavedCount = Math.max(0, defaultRawCount - payments.length);

  return result;
}

/**
 * High-level Debt Simplification Graph Analyzer.
 */
export function simplifyDebtGraph(
  balances: BalanceNode[],
  completedSettlements: CompletedSettlement[] = [],
  rawTransactionsCount = 0,
  currency = 'BDT'
): SimplifiedDebtGraphResult {
  const transfers = calculateMinSettlements(balances, completedSettlements, rawTransactionsCount, currency);
  return {
    memberBalances: balances,
    rawTransactionsCount: transfers.rawTransactionsCount,
    simplifiedTransfers: transfers,
    transfersSavedCount: transfers.transfersSavedCount,
  };
}
