/**
 * @fileoverview Recurring transaction service — business logic for scheduled entries.
 *
 * @module services/recurring.service
 */

import { RecurringRepository, type CreateRecurringInput } from '@/repositories/recurring.repository';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AuditService } from '@/services/audit.service';
import { TransactionService } from '@/services/transaction.service';
import { AccountService } from '@/services/account.service';
import { validateInput } from '@/lib/types/api';
import { CreateRecurringDTO, type RecurringResponseDTO } from '@/lib/types/dto';
import { NotFoundError, ErrorCode } from '@/lib/types/errors';

/**
 * RecurringService — business logic for scheduled recurring transactions.
 */
export class RecurringService {
  /**
   * Retrieves all recurring transactions for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of recurring transaction DTOs.
   */
  static async getAll(userId: number): Promise<RecurringResponseDTO[]> {
    const records = await RecurringRepository.findAll(userId);

    return records.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      amount: r.amount,
      category: r.category,
      frequency: r.frequency,
      nextDate: r.nextDate,
      active: r.active ?? 1,
      createdAt: r.createdAt ?? undefined,
    }));
  }

  /**
   * Creates a new recurring transaction.
   *
   * @param userId - The user's ID.
   * @param data - Raw input data.
   * @param ctx - Request context.
   * @returns The created recurring transaction.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<RecurringResponseDTO> {
    const validated = validateInput(CreateRecurringDTO, data);

    const record = await RecurringRepository.create({
      userId,
      name: validated.name,
      type: validated.type,
      amount: validated.amount,
      category: validated.category,
      frequency: validated.frequency,
      nextDate: validated.nextDate,
    });

    AuditService.logCreate(
      userId,
      'recurring',
      record.id,
      { name: validated.name, amount: validated.amount, frequency: validated.frequency },
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: record.id,
      name: record.name,
      type: record.type,
      amount: record.amount,
      category: record.category,
      frequency: record.frequency,
      nextDate: record.nextDate,
      active: record.active ?? 1,
      createdAt: record.createdAt ?? undefined,
    };
  }

  /**
   * Deletes a recurring transaction.
   *
   * @param userId - The user's ID.
   * @param id - The record ID.
   * @param ctx - Request context.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const deleted = await RecurringRepository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError('Recurring transaction not found');
    }

    AuditService.logDelete(
      userId,
      'recurring',
      id,
      { name: deleted.name, amount: deleted.amount },
      ctx.ip,
      ctx.userAgent
    );
  }

  /**
   * Toggles the active/paused state of a recurring transaction.
   *
   * @param userId - The user's ID.
   * @param id - The record ID.
   * @param active - New active state.
   * @returns The updated record.
   */
  static async toggleActive(
    userId: number,
    id: number,
    active: boolean
  ): Promise<RecurringResponseDTO | undefined> {
    const result = await RecurringRepository.toggleActive(userId, id, active ? 1 : 0);
    if (!result) {
      throw new NotFoundError('Recurring transaction not found');
    }

    return {
      id: result.id,
      name: result.name,
      type: result.type,
      amount: result.amount,
      category: result.category,
      frequency: result.frequency,
      nextDate: result.nextDate,
      active: result.active ?? 1,
      createdAt: result.createdAt ?? undefined,
    };
  }

  /**
   * Processes all due recurring transactions.
   *
   * Called by a cron job or scheduled function. Creates actual
   * transactions for each due recurring entry and advances
   * the next execution date.
   *
   * @returns Number of transactions processed.
   */
  static async processDue(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const dueRecords = await RecurringRepository.findDue(today);
    let processed = 0;

    for (const record of dueRecords) {
      try {
        // Resolve primary account if available
        const userAccounts = await AccountService.list(record.userId);
        const accountId = userAccounts.length > 0 ? userAccounts[0].id : undefined;

        // Create the actual transaction through the service layer
        await TransactionService.create(record.userId, {
          type: record.type as 'expense' | 'earning',
          amount: record.amount,
          category: record.category,
          description: `[Auto] ${record.name}`,
          date: today,
          accountId,
        });

        // Calculate next execution date
        const nextDate = RecurringService.calculateNextDate(
          record.nextDate,
          record.frequency as 'weekly' | 'monthly' | 'yearly'
        );

        await RecurringRepository.updateNextDate(record.id, nextDate);
        processed++;
      } catch (error) {
        console.error(`[recurring] Failed to process ID ${record.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Calculates the next execution date based on frequency.
   *
   * @param currentDate - Current execution date (YYYY-MM-DD).
   * @param frequency - Recurrence frequency.
   * @returns Next execution date in YYYY-MM-DD format.
   *
   * @internal
   */
  private static calculateNextDate(
    currentDate: string,
    frequency: 'weekly' | 'monthly' | 'yearly'
  ): string {
    const d = new Date(currentDate + 'T00:00:00Z');

    switch (frequency) {
      case 'weekly':
        d.setUTCDate(d.getUTCDate() + 7);
        break;
      case 'monthly':
        d.setUTCMonth(d.getUTCMonth() + 1);
        break;
      case 'yearly':
        d.setUTCFullYear(d.getUTCFullYear() + 1);
        break;
    }

    return d.toISOString().split('T')[0];
  }
}
