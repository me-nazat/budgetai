import { db } from '@/db/client';
import { roundUpSettings, goalMilestones, savingsGoals } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class RoundUpRepository {
  /** Get user round-up settings */
  static async getSettings(userId: number) {
    const [settings] = await db
      .select()
      .from(roundUpSettings)
      .where(eq(roundUpSettings.userId, userId));
    return (
      settings || {
        id: 0,
        userId,
        enabled: 1,
        roundingTier: 1.0,
        multiplier: 1.0,
        targetGoalId: null,
      }
    );
  }

  /** Upsert user round-up settings */
  static async saveSettings(data: {
    userId: number;
    enabled?: number;
    roundingTier?: number;
    multiplier?: number;
    targetGoalId?: number | null;
  }) {
    const existing = await db
      .select()
      .from(roundUpSettings)
      .where(eq(roundUpSettings.userId, data.userId));

    if (existing.length > 0) {
      const [updated] = await db
        .update(roundUpSettings)
        .set({
          ...data,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(roundUpSettings.id, existing[0].id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(roundUpSettings)
      .values({
        userId: data.userId,
        enabled: data.enabled ?? 1,
        roundingTier: data.roundingTier ?? 1.0,
        multiplier: data.multiplier ?? 1.0,
        targetGoalId: data.targetGoalId ?? null,
      })
      .returning();
    return inserted;
  }

  /** Calculate round-up amount for spent transaction value */
  static calculateRoundUp(amount: number, tier: number = 1.0, multiplier: number = 1.0): number {
    if (amount <= 0) return 0;
    const remainder = amount % tier;
    if (remainder === 0) return 0;
    const baseRoundUp = tier - remainder;
    return Math.round(baseRoundUp * multiplier * 100) / 100;
  }

  /** Record goal milestone reached */
  static async recordMilestone(goalId: number, percentage: number) {
    const [existing] = await db
      .select()
      .from(goalMilestones)
      .where(
        and(
          eq(goalMilestones.goalId, goalId),
          eq(goalMilestones.milestonePercentage, percentage)
        )
      );

    if (!existing) {
      const [milestone] = await db
        .insert(goalMilestones)
        .values({
          goalId,
          milestonePercentage: percentage,
        })
        .returning();
      return milestone;
    }
    return existing;
  }

  /** Get achieved milestones for a goal */
  static async getMilestones(goalId: number) {
    return await db
      .select()
      .from(goalMilestones)
      .where(eq(goalMilestones.goalId, goalId))
      .orderBy(goalMilestones.milestonePercentage);
  }

  /** Process automatic round-up sweep for an expense transaction (Module 15) */
  static async processRoundUpForExpense(userId: number, expenseAmount: number) {
    const settings = await this.getSettings(userId);
    if (!settings || !settings.enabled || !settings.targetGoalId) return null;

    const roundUpDiff = this.calculateRoundUp(
      expenseAmount,
      settings.roundingTier || 1.0,
      settings.multiplier || 1.0
    );

    if (roundUpDiff <= 0) return null;

    // Fetch target goal
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, settings.targetGoalId), eq(savingsGoals.userId, userId)));

    if (!goal) return null;

    const newSavedAmount = (goal.savedAmount || 0) + roundUpDiff;

    // Update goal saved amount
    await db
      .update(savingsGoals)
      .set({ savedAmount: newSavedAmount })
      .where(eq(savingsGoals.id, goal.id));

    // Check milestone hit (25%, 50%, 75%, 100%)
    const pct = Math.floor((newSavedAmount / goal.targetAmount) * 100);
    const thresholds = [100, 75, 50, 25];
    for (const t of thresholds) {
      if (pct >= t && (goal.lastMilestoneHit || 0) < t) {
        await db
          .update(savingsGoals)
          .set({ lastMilestoneHit: t })
          .where(eq(savingsGoals.id, goal.id));
        await this.recordMilestone(goal.id, t);
        break;
      }
    }

    return { roundUpDiff, newSavedAmount, goalId: goal.id };
  }
}
