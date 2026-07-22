/**
 * @fileoverview Account service — business logic for account management.
 *
 * Handles CRUD and balance logic for multi-account wallet ledgers.
 *
 * @module services/account.service
 */

import { AccountRepository } from '@/repositories/account.repository';
import { type Account, type NewAccount } from '@/db/schema';
import { validateInput } from '@/lib/types/api';
import { CreateAccountDTO, UpdateAccountDTO } from '@/lib/types/dto';
import { NotFoundError } from '@/lib/types/errors';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';

export class AccountService {
  /**
   * Creates a new wallet account.
   */
  static async create(userId: number, data: unknown): Promise<Account> {
    const validated = validateInput(CreateAccountDTO, data);
    return AccountRepository.create({
      userId,
      ...validated,
    });
  }

  /**
   * Updates an existing account's details.
   */
  static async update(userId: number, id: number, data: unknown): Promise<Account> {
    const validated = validateInput(UpdateAccountDTO, data);
    const existing = await AccountRepository.findById(id, userId);
    if (!existing) {
      throw new NotFoundError('Account not found');
    }
    const { isArchived, ...rest } = validated;
    const updatePayload = {
      ...rest,
      ...(isArchived !== undefined ? { isArchived: isArchived ? 1 : 0 } : {}),
    };
    const updated = await AccountRepository.update(id, userId, updatePayload);
    if (!updated) throw new NotFoundError('Account not found');
    return updated;
  }

  /**
   * Lists all active accounts for a user.
   */
  static async list(userId: number, includeArchived = false): Promise<Account[]> {
    return AccountRepository.findAllByUserId(userId, includeArchived);
  }

  /**
   * Retrieves a single account details.
   */
  static async get(userId: number, id: number): Promise<Account> {
    const account = await AccountRepository.findById(id, userId);
    if (!account) throw new NotFoundError('Account not found');
    return account;
  }

  /**
   * Evaluates if account balance is below alert thresholds.
   */
  static async checkLowBalanceAlert(userId: number, accountId: number): Promise<void> {
    const account = await AccountRepository.findById(accountId, userId);
    if (!account) return;

    const threshold = account.currency === 'BDT' ? 1000 : 25;
    if (account.currentBalance < threshold) {
      const title = 'Low Wallet Balance';
      const message = `Your account "${account.name}" has a low balance of ${account.currency} ${account.currentBalance.toFixed(2)}.`;

      // Trigger standard notifications
      await NotificationService.createSystem(userId, 'warning', title, message);
      await PushService.sendToUser(userId, {
        title,
        body: message,
        tag: 'budget',
      }).catch((e) => console.error('[push-service] Failed to send low balance alert push:', e));
    }
  }
}
