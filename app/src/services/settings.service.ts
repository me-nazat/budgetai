/**
 * @fileoverview Settings service — business logic for user profile settings.
 *
 * @module services/settings.service
 */

import { UserRepository } from '@/repositories/user.repository';
import { AuditService } from '@/services/audit.service';
import { validateInput } from '@/lib/types/api';
import { UpdateSettingsDTO } from '@/lib/types/dto';
import { NotFoundError, ErrorCode } from '@/lib/types/errors';

/**
 * SettingsService — business logic for user profile and preferences.
 */
export class SettingsService {
  /**
   * Updates user settings/preferences.
   *
   * @param userId - The user's ID.
   * @param data - Raw input data.
   * @param ctx - Request context.
   * @returns The updated user profile.
   */
  static async update(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ) {
    const validated = validateInput(UpdateSettingsDTO, data);

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', ErrorCode.USER_NOT_FOUND);
    }

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.currency !== undefined) updateData.currency = validated.currency;
    if (validated.notifyBudget !== undefined) updateData.notifyBudget = validated.notifyBudget;
    if (validated.notifyOverspend !== undefined) updateData.notifyOverspend = validated.notifyOverspend;

    const updated = await UserRepository.updateProfile(userId, updateData);
    if (!updated) {
      throw new NotFoundError('User not found after update', ErrorCode.USER_NOT_FOUND);
    }

    AuditService.logUpdate(
      userId,
      'user',
      userId,
      { name: user.name, currency: user.currency },
      updateData,
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      currency: updated.currency || 'BDT',
      notifyBudget: updated.notifyBudget,
      notifyOverspend: updated.notifyOverspend,
    };
  }

  /**
   * Changes a user's password.
   *
   * @param userId - The user's ID.
   * @param currentPassword - The current password for verification.
   * @param newPassword - The new password.
   * @param ctx - Request context.
   */
  static async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const bcrypt = await import('bcryptjs');

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found', ErrorCode.USER_NOT_FOUND);
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      const { AuthenticationError } = await import('@/lib/types/errors');
      throw new AuthenticationError('Current password is incorrect', ErrorCode.INVALID_CREDENTIALS);
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await UserRepository.updatePassword(userId, newHash);

    // Revoke all other sessions for security
    await UserRepository.revokeAllSessions(userId);

    AuditService.logAction({
      userId,
      action: 'UPDATE',
      entityType: 'user',
      entityId: String(userId),
      metadata: { field: 'password', sessionsRevoked: true },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
}
