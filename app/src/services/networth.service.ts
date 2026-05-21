/**
 * @fileoverview Net worth service — business logic for net worth tracking.
 *
 * @module services/networth.service
 */

import { NetWorthRepository } from '@/repositories/networth.repository';
import { AuditService } from '@/services/audit.service';
import { validateInput } from '@/lib/types/api';
import { CreateNetWorthDTO, type NetWorthResponseDTO } from '@/lib/types/dto';
import { NotFoundError, ErrorCode } from '@/lib/types/errors';

/**
 * NetWorthService — business logic for net worth snapshots.
 */
export class NetWorthService {
  /**
   * Retrieves all net worth entries for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of net worth response DTOs.
   */
  static async getAll(userId: number): Promise<NetWorthResponseDTO[]> {
    const records = await NetWorthRepository.findAll(userId);

    return records.map((r) => ({
      id: r.id,
      amount: r.amount,
      note: r.note || '',
      createdAt: r.createdAt,
    }));
  }

  /**
   * Creates a new net worth snapshot.
   *
   * @param userId - The user's ID.
   * @param data - Raw input data.
   * @param ctx - Request context.
   * @returns The created net worth entry.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<NetWorthResponseDTO> {
    const validated = validateInput(CreateNetWorthDTO, data);

    const record = await NetWorthRepository.create({
      userId,
      amount: validated.amount,
      note: validated.note,
    });

    AuditService.logCreate(
      userId,
      'networth',
      record.id,
      { amount: validated.amount },
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: record.id,
      amount: record.amount,
      note: record.note || '',
      createdAt: record.createdAt,
    };
  }

  /**
   * Deletes a net worth entry.
   *
   * @param userId - The user's ID.
   * @param id - The entry ID.
   * @param ctx - Request context.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const deleted = await NetWorthRepository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError('Net worth entry not found');
    }

    AuditService.logDelete(
      userId,
      'networth',
      id,
      { amount: deleted.amount },
      ctx.ip,
      ctx.userAgent
    );
  }
}
