/**
 * @fileoverview Directed Debt Simplification algorithm (Greedy Cash Flow Minimization).
 * Collapses N-person debt networks into the absolute minimum number of settlement payments.
 */

export interface BalanceNode {
  userId: string | number;
  userName?: string;
  netBalance: number; // Positive = Owed money, Negative = Owes money
}

export interface OptimizedPayment {
  fromUserId: string | number;
  fromUserName?: string;
  toUserId: string | number;
  toUserName?: string;
  amount: number;
}

export function calculateMinSettlements(balances: BalanceNode[]): OptimizedPayment[] {
  const debtors: { userId: string | number; name: string; amount: number }[] = [];
  const creditors: { userId: string | number; name: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.netBalance < -0.01) {
      debtors.push({
        userId: b.userId,
        name: b.userName || `User #${b.userId}`,
        amount: Math.abs(b.netBalance),
      });
    } else if (b.netBalance > 0.01) {
      creditors.push({
        userId: b.userId,
        name: b.userName || `User #${b.userId}`,
        amount: b.netBalance,
      });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const payments: OptimizedPayment[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const settledAmount = Math.min(debtor.amount, creditor.amount);
    if (settledAmount > 0.01) {
      payments.push({
        fromUserId: debtor.userId,
        fromUserName: debtor.name,
        toUserId: creditor.userId,
        toUserName: creditor.name,
        amount: Math.round(settledAmount * 100) / 100,
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount < 0.01) i++;
    if (creditor.amount < 0.01) j++;
  }

  return payments;
}
