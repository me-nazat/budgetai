/**
 * @fileoverview Debt service — coordinates debt logic, payoff simulations, payment ledger syncing, and audit logs.
 */

import { db } from '@/db/client';
import { recurringTransactions, accounts, type NewDebt, type Debt } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { DebtRepository } from '@/repositories/debt.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AccountRepository } from '@/repositories/account.repository';
import { AuditService } from './audit.service';

export interface DebtSimulationInput {
  id?: number;
  name: string;
  balance: number;
  interestRateApr: number;
  minimumPayment: number;
}

export interface SimulationMonthPoint {
  month: number;
  date: string;
  balance: number;
  interestPaid: number;
  principalPaid: number;
  totalInterestPaid: number;
}

export interface SimulationMilestone {
  month: number;
  date: string;
  debtId?: number;
  debtName: string;
  balancePaid: number;
}

export interface SimulationResult {
  strategy: 'snowball' | 'avalanche' | 'baseline';
  extraPayment: number;
  months: number;
  interest: number; // for test backward compatibility
  totalInterest: number;
  totalPrincipal: number;
  totalPaid: number;
  debtFreeDate: string;
  interestSaved: number;
  monthsSaved: number;
  points: { month: number; balance: number }[];
  timeline: SimulationMonthPoint[];
  milestones: SimulationMilestone[];
  payoffOrder: (number | string)[];
}

function computeNextDueDate(dueDay: number | null): string {
  const now = new Date();
  if (dueDay === null || dueDay === undefined || dueDay < 1 || dueDay > 31) {
    return now.toISOString().slice(0, 10);
  }

  let year = now.getFullYear();
  let month = now.getMonth();

  if (now.getDate() > dueDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const target = new Date(year, month, dueDay);
  return target.toISOString().slice(0, 10);
}

function formatYearMonth(offsetMonths: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Pure mathematical simulation engine for debt payoff under Snowball, Avalanche, and Baseline strategies.
 * Implements Full Cascade acceleration: When a debt is eliminated, its monthly payment rolls into the next priority debt.
 */
export function simulatePayoff(
  debtsList: DebtSimulationInput[],
  strategy: 'snowball' | 'avalanche' | 'baseline',
  extraPayment: number = 0
): SimulationResult {
  const list = debtsList.map((d, idx) => ({
    id: d.id ?? idx + 1,
    name: d.name,
    balance: Math.max(0, Number(d.balance) || 0),
    interestRateApr: Math.max(0, Number(d.interestRateApr) || 0),
    minimumPayment: Math.max(0, Number(d.minimumPayment) || 0),
    originalBalance: Math.max(0, Number(d.balance) || 0),
    isPaid: (Number(d.balance) || 0) <= 0,
  }));

  const startingTotal = list.reduce((sum, d) => sum + d.balance, 0);
  const totalMinCommitment = list.reduce((sum, d) => sum + d.minimumPayment, 0);

  let month = 0;
  let totalInterest = 0;
  const points: { month: number; balance: number }[] = [{ month: 0, balance: Math.round(startingTotal) }];
  const timeline: SimulationMonthPoint[] = [{
    month: 0,
    date: formatYearMonth(0),
    balance: Math.round(startingTotal),
    interestPaid: 0,
    principalPaid: 0,
    totalInterestPaid: 0,
  }];
  const milestones: SimulationMilestone[] = [];
  const payoffOrder: (number | string)[] = [];

  if (startingTotal <= 0) {
    return {
      strategy,
      extraPayment,
      months: 0,
      interest: 0,
      totalInterest: 0,
      totalPrincipal: 0,
      totalPaid: 0,
      debtFreeDate: formatYearMonth(0),
      interestSaved: 0,
      monthsSaved: 0,
      points,
      timeline,
      milestones,
      payoffOrder,
    };
  }

  while (month < 360) {
    const activeDebts = list.filter((d) => d.balance > 0);
    if (activeDebts.length === 0) break;
    month++;

    // 1. Accrue Monthly Interest
    let interestThisMonth = 0;
    for (const d of activeDebts) {
      const monthlyRate = d.interestRateApr / 100 / 12;
      const interest = d.balance * monthlyRate;
      d.balance += interest;
      interestThisMonth += interest;
    }
    totalInterest += interestThisMonth;

    // 2. Pay Minimums
    let minPaymentsMade = 0;
    for (const d of activeDebts) {
      const payment = Math.min(d.minimumPayment, d.balance);
      d.balance -= payment;
      minPaymentsMade += payment;
    }

    // 3. Calculate Available Surplus Pool (Full Cascade)
    // Under snowball/avalanche, the total committed monthly budget is maintained:
    // monthlyBudget = totalMinCommitment + extraPayment
    const actualExtra = strategy === 'baseline' ? 0 : extraPayment;
    let availablePool = 0;

    if (strategy === 'baseline') {
      availablePool = 0;
    } else {
      // Full cascade: whatever is remaining from the fixed monthly commitment
      availablePool = Math.max(0, (totalMinCommitment + actualExtra) - minPaymentsMade);
    }

    // 4. Apply Surplus to Target Debts
    const remainingActive = list.filter((d) => d.balance > 0);
    if (remainingActive.length > 0 && availablePool > 0) {
      if (strategy === 'avalanche') {
        // Avalanche: highest APR first, tie-break smallest balance
        remainingActive.sort((a, b) => {
          if (b.interestRateApr !== a.interestRateApr) {
            return b.interestRateApr - a.interestRateApr;
          }
          return a.balance - b.balance;
        });
      } else if (strategy === 'snowball') {
        // Snowball: lowest balance first, tie-break highest APR
        remainingActive.sort((a, b) => {
          if (a.balance !== b.balance) {
            return a.balance - b.balance;
          }
          return b.interestRateApr - a.interestRateApr;
        });
      }

      for (const target of remainingActive) {
        if (availablePool <= 0) break;
        const payment = Math.min(availablePool, target.balance);
        target.balance -= payment;
        availablePool -= payment;
      }
    }

    // 5. Detect and log milestones for newly eliminated debts
    for (const d of list) {
      if (d.balance <= 0.001 && !d.isPaid) {
        d.balance = 0;
        d.isPaid = true;
        payoffOrder.push(d.id);
        milestones.push({
          month,
          date: formatYearMonth(month),
          debtId: typeof d.id === 'number' ? d.id : undefined,
          debtName: d.name,
          balancePaid: d.originalBalance,
        });
      }
    }

    const currentTotal = list.reduce((sum, d) => sum + Math.max(0, d.balance), 0);
    const principalPaidThisMonth = startingTotal - currentTotal;

    points.push({ month, balance: Math.round(currentTotal) });
    timeline.push({
      month,
      date: formatYearMonth(month),
      balance: Math.round(currentTotal),
      interestPaid: Math.round(interestThisMonth),
      principalPaid: Math.round(principalPaidThisMonth),
      totalInterestPaid: Math.round(totalInterest),
    });

    if (currentTotal <= 0) break;
  }

  // Calculate comparison delta against baseline (if this run is not already baseline)
  let interestSaved = 0;
  let monthsSaved = 0;

  if (strategy !== 'baseline') {
    const baselineResult = simulatePayoff(debtsList, 'baseline', 0);
    interestSaved = Math.max(0, baselineResult.totalInterest - totalInterest);
    monthsSaved = Math.max(0, baselineResult.months - month);
  }

  return {
    strategy,
    extraPayment,
    months: month,
    interest: totalInterest,
    totalInterest,
    totalPrincipal: startingTotal,
    totalPaid: startingTotal + totalInterest,
    debtFreeDate: formatYearMonth(month),
    interestSaved,
    monthsSaved,
    points,
    timeline,
    milestones,
    payoffOrder,
  };
}

export class DebtService {
  /**
   * Fetches all debts for a user.
   */
  static async getDebts(userId: number): Promise<Debt[]> {
    return DebtRepository.findAllByUserId(userId);
  }

  /**
   * Simulates debt payoff scenarios for a user's active debts.
   */
  static async simulateForUser(
    userId: number,
    strategy: 'snowball' | 'avalanche' | 'baseline' = 'avalanche',
    extraPayment: number = 0
  ): Promise<SimulationResult> {
    const debts = await this.getDebts(userId);
    return simulatePayoff(debts, strategy, extraPayment);
  }

  /**
   * Records an atomic payment towards a debt liability:
   * 1. Deducts payment amount from checking/source account.
   * 2. Decrements liability balance.
   * 3. Creates an expense transaction categorized as "Debt Payment".
   * 4. Logs audit trail.
   */
  static async recordPayment(
    userId: number,
    debtId: number,
    data: {
      sourceAccountId: number;
      amount: number;
      date?: string;
      note?: string;
    },
    ip: string
  ) {
    const debt = await DebtRepository.findById(debtId, userId);
    if (!debt) {
      throw new Error('Debt liability not found');
    }

    const account = await AccountRepository.findById(data.sourceAccountId, userId);
    if (!account) {
      throw new Error('Source checking account not found');
    }

    const paymentAmount = Number(data.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    const newDebtBalance = Math.max(0, debt.balance - paymentAmount);
    const newAccountBalance = account.currentBalance - paymentAmount;
    const paymentDate = data.date || new Date().toISOString().slice(0, 10);
    const note = data.note || `Principal payment towards ${debt.name}`;

    // 1. Decrement debt balance
    const updatedDebt = await DebtRepository.update(debtId, userId, {
      balance: newDebtBalance,
    });

    // 2. Decrement account balance
    await AccountRepository.update(account.id, userId, {
      currentBalance: newAccountBalance,
    });

    // 3. Create linked ledger transaction
    const transaction = await TransactionRepository.create({
      userId,
      accountId: account.id,
      type: 'expense',
      amount: paymentAmount,
      category: 'Debt Payment',
      description: note,
      date: paymentDate,
    });

    // 4. Audit Log
    await AuditService.logAction({
      userId,
      action: 'UPDATE',
      entityType: 'debt',
      entityId: String(debtId),
      oldValue: { balance: debt.balance },
      newValue: {
        balance: newDebtBalance,
        paymentAmount,
        sourceAccountId: account.id,
        transactionId: transaction.id,
      },
      ip,
    });

    return {
      success: true,
      debt: updatedDebt,
      newAccountBalance,
      transaction,
    };
  }

  /**
   * Creates a new debt record.
   */
  static async createDebt(
    userId: number,
    data: {
      name: string;
      debtType: 'credit_card' | 'personal_loan' | 'student_loan' | 'bnpl' | 'other';
      balance: number;
      initialBalance?: number;
      interestRateApr: number;
      minimumPayment: number;
      dueDayOfMonth?: number | null;
      linkRecurring?: boolean;
    },
    ip: string
  ) {
    let linkedRecurringTransactionId: number | null = null;

    if (data.linkRecurring) {
      const nextDate = computeNextDueDate(data.dueDayOfMonth || null);
      const [recur] = await db
        .insert(recurringTransactions)
        .values({
          userId,
          name: `Minimum Payment: ${data.name}`,
          type: 'expense',
          amount: data.minimumPayment,
          category: 'Other',
          frequency: 'monthly',
          nextDate,
          active: 1,
        })
        .returning();
      linkedRecurringTransactionId = recur.id;
    }

    const initialBalanceVal = data.initialBalance !== undefined ? data.initialBalance : data.balance;

    const newDebt = await DebtRepository.create({
      userId,
      name: data.name,
      debtType: data.debtType,
      balance: data.balance,
      initialBalance: initialBalanceVal,
      interestRateApr: data.interestRateApr,
      minimumPayment: data.minimumPayment,
      dueDayOfMonth: data.dueDayOfMonth || null,
      linkedRecurringTransactionId,
    });

    await AuditService.logAction({
      userId,
      action: 'CREATE',
      entityType: 'debt',
      entityId: String(newDebt.id),
      newValue: newDebt,
      ip,
    });

    return newDebt;
  }

  /**
   * Updates an existing debt.
   */
  static async updateDebt(
    userId: number,
    id: number,
    data: {
      name?: string;
      debtType?: 'credit_card' | 'personal_loan' | 'student_loan' | 'bnpl' | 'other';
      balance?: number;
      initialBalance?: number;
      interestRateApr?: number;
      minimumPayment?: number;
      dueDayOfMonth?: number | null;
      linkRecurring?: boolean;
    },
    ip: string
  ) {
    const existing = await DebtRepository.findById(id, userId);
    if (!existing) {
      throw new Error('Debt not found');
    }

    let linkedRecurringTransactionId = existing.linkedRecurringTransactionId;

    if (data.linkRecurring && !linkedRecurringTransactionId) {
      const nextDate = computeNextDueDate(data.dueDayOfMonth !== undefined ? data.dueDayOfMonth : existing.dueDayOfMonth);
      const [recur] = await db
        .insert(recurringTransactions)
        .values({
          userId,
          name: `Minimum Payment: ${data.name || existing.name}`,
          type: 'expense',
          amount: data.minimumPayment !== undefined ? data.minimumPayment : existing.minimumPayment,
          category: 'Other',
          frequency: 'monthly',
          nextDate,
          active: 1,
        })
        .returning();
      linkedRecurringTransactionId = recur.id;
    } else if (data.linkRecurring === false && linkedRecurringTransactionId) {
      await db
        .delete(recurringTransactions)
        .where(eq(recurringTransactions.id, linkedRecurringTransactionId));
      linkedRecurringTransactionId = null;
    } else if (linkedRecurringTransactionId) {
      await db
        .update(recurringTransactions)
        .set({
          amount: data.minimumPayment !== undefined ? data.minimumPayment : existing.minimumPayment,
          name: `Minimum Payment: ${data.name || existing.name}`,
        })
        .where(eq(recurringTransactions.id, linkedRecurringTransactionId));
    }

    const updatePayload: Partial<NewDebt> = {};
    if (data.name !== undefined) updatePayload.name = data.name;
    if (data.debtType !== undefined) updatePayload.debtType = data.debtType;
    if (data.balance !== undefined) updatePayload.balance = data.balance;
    if (data.initialBalance !== undefined) updatePayload.initialBalance = data.initialBalance;
    if (data.interestRateApr !== undefined) updatePayload.interestRateApr = data.interestRateApr;
    if (data.minimumPayment !== undefined) updatePayload.minimumPayment = data.minimumPayment;
    if (data.dueDayOfMonth !== undefined) updatePayload.dueDayOfMonth = data.dueDayOfMonth;
    updatePayload.linkedRecurringTransactionId = linkedRecurringTransactionId;

    const updated = await DebtRepository.update(id, userId, updatePayload);

    await AuditService.logAction({
      userId,
      action: 'UPDATE',
      entityType: 'debt',
      entityId: String(id),
      oldValue: existing,
      newValue: updated,
      ip,
    });

    return updated;
  }

  /**
   * Deletes a debt record.
   */
  static async deleteDebt(userId: number, id: number, ip: string) {
    const existing = await DebtRepository.findById(id, userId);
    if (!existing) {
      throw new Error('Debt not found');
    }

    if (existing.linkedRecurringTransactionId) {
      await db
        .delete(recurringTransactions)
        .where(eq(recurringTransactions.id, existing.linkedRecurringTransactionId));
    }

    const success = await DebtRepository.delete(id, userId);

    await AuditService.logAction({
      userId,
      action: 'DELETE',
      entityType: 'debt',
      entityId: String(id),
      oldValue: existing,
      ip,
    });

    return success;
  }
}
