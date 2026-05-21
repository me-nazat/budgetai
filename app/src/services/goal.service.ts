/**
 * @fileoverview Goal service — business logic for savings goals.
 *
 * @module services/goal.service
 */

import { GoalRepository, type UpdateGoalInput } from '@/repositories/goal.repository';
import { AuditService } from '@/services/audit.service';
import { validateInput } from '@/lib/types/api';
import { CreateGoalDTO, UpdateGoalDTO, type GoalResponseDTO } from '@/lib/types/dto';
import { NotFoundError, ErrorCode } from '@/lib/types/errors';

/**
 * GoalService — business logic for savings goals.
 */
export class GoalService {
  /**
   * Retrieves all goals for a user with calculated progress.
   *
   * @param userId - The user's ID.
   * @returns Array of goals with progress percentages.
   */
  static async getAll(userId: number): Promise<GoalResponseDTO[]> {
    const goals = await GoalRepository.findAll(userId);

    return goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      deadline: g.deadline,
      progress: g.targetAmount > 0
        ? Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100))
        : 0,
      createdAt: g.createdAt ?? undefined,
    }));
  }

  /**
   * Creates a new savings goal.
   *
   * @param userId - The user's ID.
   * @param data - Raw input data.
   * @param ctx - Request context.
   * @returns The created goal.
   */
  static async create(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<GoalResponseDTO> {
    const validated = validateInput(CreateGoalDTO, data);

    const goal = await GoalRepository.create({
      userId,
      name: validated.name,
      targetAmount: validated.targetAmount,
      savedAmount: validated.savedAmount,
      deadline: validated.deadline,
    });

    AuditService.logCreate(
      userId,
      'goal',
      goal.id,
      { name: validated.name, targetAmount: validated.targetAmount },
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: goal.id,
      name: goal.name,
      targetAmount: goal.targetAmount,
      savedAmount: goal.savedAmount,
      deadline: goal.deadline,
      progress: 0,
      createdAt: goal.createdAt ?? undefined,
    };
  }

  /**
   * Updates a savings goal.
   *
   * @param userId - The user's ID.
   * @param data - Raw input data.
   * @param ctx - Request context.
   * @returns The updated goal.
   */
  static async update(
    userId: number,
    data: unknown,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<GoalResponseDTO> {
    const validated = validateInput(UpdateGoalDTO, data);

    const oldGoal = await GoalRepository.findById(userId, validated.id);
    if (!oldGoal) {
      throw new NotFoundError('Goal not found', ErrorCode.GOAL_NOT_FOUND);
    }

    const updateData: UpdateGoalInput = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.targetAmount !== undefined) updateData.targetAmount = validated.targetAmount;
    if (validated.savedAmount !== undefined) updateData.savedAmount = validated.savedAmount;
    if (validated.deadline !== undefined) updateData.deadline = validated.deadline;

    const updated = await GoalRepository.update(userId, validated.id, updateData);
    if (!updated) {
      throw new NotFoundError('Goal not found after update', ErrorCode.GOAL_NOT_FOUND);
    }

    AuditService.logUpdate(
      userId,
      'goal',
      validated.id,
      { name: oldGoal.name, targetAmount: oldGoal.targetAmount, savedAmount: oldGoal.savedAmount },
      { name: updated.name, targetAmount: updated.targetAmount, savedAmount: updated.savedAmount },
      ctx.ip,
      ctx.userAgent
    );

    return {
      id: updated.id,
      name: updated.name,
      targetAmount: updated.targetAmount,
      savedAmount: updated.savedAmount,
      deadline: updated.deadline,
      progress: updated.targetAmount > 0
        ? Math.min(100, Math.round((updated.savedAmount / updated.targetAmount) * 100))
        : 0,
      createdAt: updated.createdAt ?? undefined,
    };
  }

  /**
   * Deletes a savings goal.
   *
   * @param userId - The user's ID.
   * @param id - The goal ID.
   * @param ctx - Request context.
   */
  static async delete(
    userId: number,
    id: number,
    ctx: { ip?: string; userAgent?: string } = {}
  ): Promise<void> {
    const deleted = await GoalRepository.delete(userId, id);
    if (!deleted) {
      throw new NotFoundError('Goal not found', ErrorCode.GOAL_NOT_FOUND);
    }

    AuditService.logDelete(
      userId,
      'goal',
      id,
      { name: deleted.name, targetAmount: deleted.targetAmount },
      ctx.ip,
      ctx.userAgent
    );
  }
}
