/**
 * @fileoverview Debt service — coordinates debt logic, syncs recurring transactions, and writes audit logs.
 */

import { db } from '@/db/client';
import { recurringTransactions, type NewDebt } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { DebtRepository } from '@/repositories/debt.repository';
import { AuditService } from './audit.service';

function computeNextDueDate(dueDay: number | null): string {
  const now = new Date();
  if (dueDay === null || dueDay === undefined || dueDay < 1 || dueDay > 31) {
    // Return today formatted as YYYY-MM-DD
    return now.toISOString().slice(0, 10);
  }

  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexed

  // Check if we already passed the due day this month
  if (now.getDate() > dueDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  // Create target date safely
  const target = new Date(year, month, dueDay);
  return target.toISOString().slice(0, 10);
}

export class DebtService {
  /**
   * Fetches all debts for a user.
   */
  static async getDebts(userId: number) {
    return DebtRepository.findAllByUserId(userId);
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

    // Handle linkage updates
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
      // Sync recurring payment amounts or names
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
