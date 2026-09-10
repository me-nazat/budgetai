/**
 * @fileoverview Round-Up Savings Repository for Module 15.
 *
 * Implements:
 * - Configuration of round-up rules backed by live roundUpRules table
 * - 30-day recent spending preview calculation
 * - Micro-savings sweep engine updating encrypted savings goal balances
 * - Milestone event logging (25%, 50%, 75%, 100%) in goalMilestones
 * - Proactive notification dispatch to Insights Hub
 *
 * @module repositories/roundUp.repository
 */

import { db } from '@/db/client';
import {
  roundUpRules,
  roundUpTransfers,
  goalMilestones,
  savingsGoals,
  transactions,
  accounts,
  proactiveInsights,
} from '@/db/schema';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { encryptNumber, decryptNumber, isEncrypted } from '@/lib/crypto/encryption';

export interface RoundUpRuleDTO {
  id: string;
  userId: number;
  sourceAccountId: number;
  targetGoalId: string;
  multiplier: number;
  minimumSweepThreshold: number;
  isActive: boolean;
}

export class RoundUpRepository {
  /**
   * Get active user round-up rule from roundUpRules.
   */
  static async getRule(userId: number): Promise<RoundUpRuleDTO | null> {
    const [rule] = await db
      .select()
      .from(roundUpRules)
      .where(eq(roundUpRules.userId, userId))
      .limit(1);

    if (!rule) return null;

    return {
      id: rule.id,
      userId: rule.userId,
      sourceAccountId: rule.sourceAccountId,
      targetGoalId: rule.targetGoalId,
      multiplier: rule.multiplier,
      minimumSweepThreshold: rule.minimumSweepThreshold,
      isActive: Boolean(rule.isActive),
    };
  }

  /**
   * Compatibility wrapper for getSettings returning standard settings format.
   */
  static async getSettings(userId: number) {
    const rule = await this.getRule(userId);
    if (!rule) {
      return {
        id: 0,
        userId,
        enabled: 0,
        roundingTier: 1.0,
        multiplier: 1.0,
        targetGoalId: null,
      };
    }

    return {
      id: rule.id,
      userId: rule.userId,
      enabled: rule.isActive ? 1 : 0,
      roundingTier: 1.0,
      multiplier: rule.multiplier,
      targetGoalId: parseInt(rule.targetGoalId, 10) || null,
      sourceAccountId: rule.sourceAccountId,
      minimumSweepThreshold: rule.minimumSweepThreshold,
    };
  }

  /**
   * Upsert round-up rule into canonical roundUpRules table.
   */
  static async saveRule(data: {
    userId: number;
    sourceAccountId?: number;
    targetGoalId: string | number;
    multiplier?: number;
    minimumSweepThreshold?: number;
    isActive?: boolean;
  }) {
    const existing = await db
      .select()
      .from(roundUpRules)
      .where(eq(roundUpRules.userId, data.userId))
      .limit(1);

    let resolvedAccountId = data.sourceAccountId;
    if (!resolvedAccountId) {
      const [acc] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.userId, data.userId))
        .limit(1);
      resolvedAccountId = acc?.id || 1;
    }

    const targetGoalStr = String(data.targetGoalId);
    const mult = data.multiplier ?? 1.0;
    const threshold = data.minimumSweepThreshold ?? 5.0;
    const active = data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1;
    const now = Math.floor(Date.now() / 1000);

    if (existing.length > 0) {
      const [updated] = await db
        .update(roundUpRules)
        .set({
          sourceAccountId: resolvedAccountId,
          targetGoalId: targetGoalStr,
          multiplier: mult,
          minimumSweepThreshold: threshold,
          isActive: active,
          updatedAt: now,
        })
        .where(eq(roundUpRules.id, existing[0].id))
        .returning();

      return updated;
    }

    const [inserted] = await db
      .insert(roundUpRules)
      .values({
        id: `rur_${crypto.randomUUID()}`,
        userId: data.userId,
        sourceAccountId: resolvedAccountId,
        targetGoalId: targetGoalStr,
        multiplier: mult,
        minimumSweepThreshold: threshold,
        isActive: active,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return inserted;
  }

  /**
   * Compatibility wrapper for saveSettings.
   */
  static async saveSettings(data: {
    userId: number;
    enabled?: number;
    roundingTier?: number;
    multiplier?: number;
    targetGoalId?: number | null;
  }) {
    return this.saveRule({
      userId: data.userId,
      targetGoalId: data.targetGoalId ? String(data.targetGoalId) : '1',
      multiplier: data.multiplier,
      isActive: data.enabled !== undefined ? Boolean(data.enabled) : true,
    });
  }

  /**
   * Calculate round-up amount for spent transaction value.
   */
  static calculateRoundUp(amount: number, tier: number = 1.0, multiplier: number = 1.0): number {
    if (amount <= 0) return 0;
    const remainder = amount % tier;
    if (remainder === 0) return 0;
    const baseRoundUp = tier - remainder;
    return Math.round(baseRoundUp * multiplier * 100) / 100;
  }

  /**
   * Calculate 30-day live spending round-up preview without mutating database.
   */
  static async calculate30DayPreview(userId: number, multiplier: number = 1.0, tier: number = 1.0) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

    const recentTxns = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'expense'),
          gte(transactions.date, dateStr)
        )
      );

    let projectedSweepTotal = 0;
    for (const tx of recentTxns) {
      projectedSweepTotal += this.calculateRoundUp(tx.amount, tier, multiplier);
    }

    return {
      expenseCount: recentTxns.length,
      projectedMonthlySweep: Math.round(projectedSweepTotal * 100) / 100,
      multiplier,
    };
  }

  /**
   * Record goal milestone reached in event log table.
   */
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

  /**
   * Get achieved milestones for a goal.
   */
  static async getMilestones(goalId: number) {
    return await db
      .select()
      .from(goalMilestones)
      .where(eq(goalMilestones.goalId, goalId))
      .orderBy(goalMilestones.milestonePercentage);
  }

  /**
   * Process automatic round-up sweep for an expense transaction (Module 15).
   * Updates encrypted savings goal balance and triggers milestone events.
   */
  static async processRoundUpForExpense(userId: number, expenseAmount: number, transactionId?: number) {
    const rule = await this.getRule(userId);
    if (!rule || !rule.isActive || !rule.targetGoalId) return null;

    const roundUpDiff = this.calculateRoundUp(
      expenseAmount,
      1.0,
      rule.multiplier || 1.0
    );

    if (roundUpDiff <= 0) return null;

    const goalIdNum = parseInt(rule.targetGoalId, 10);
    if (isNaN(goalIdNum)) return null;

    // Fetch target goal
    const [goal] = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, goalIdNum), eq(savingsGoals.userId, userId)));

    if (!goal) return null;

    // Decrypt current saved amount
    let currentSaved = goal.savedAmount || 0;
    if (goal.encryptedSavedAmount && isEncrypted(goal.encryptedSavedAmount)) {
      try {
        currentSaved = decryptNumber(goal.encryptedSavedAmount, 'amount');
      } catch {
        currentSaved = goal.savedAmount || 0;
      }
    }

    const newSavedAmount = Math.round((currentSaved + roundUpDiff) * 100) / 100;
    const encryptedNewSaved = encryptNumber(newSavedAmount, 'amount');

    // 1. Record sweep transfer in roundUpTransfers
    const transferId = `trans_${crypto.randomUUID()}`;
    await db.insert(roundUpTransfers).values({
      id: transferId,
      ruleId: rule.id,
      transactionId: transactionId || 1,
      rawDelta: Math.round((roundUpDiff / (rule.multiplier || 1.0)) * 100) / 100,
      multipliedAmount: roundUpDiff,
      status: 'SWEPT',
      sweptAt: Math.floor(Date.now() / 1000),
    });

    // 2. Update goal saved amount with encryption
    await db
      .update(savingsGoals)
      .set({
        savedAmount: newSavedAmount,
        encryptedSavedAmount: encryptedNewSaved,
      })
      .where(eq(savingsGoals.id, goal.id));

    // 3. Check milestone threshold crossing (25%, 50%, 75%, 100%)
    let newlyHitMilestone: number | null = null;
    if (goal.targetAmount > 0) {
      const pct = Math.floor((newSavedAmount / goal.targetAmount) * 100);
      const thresholds = [100, 75, 50, 25];
      for (const t of thresholds) {
        if (pct >= t && (goal.lastMilestoneHit || 0) < t) {
          await db
            .update(savingsGoals)
            .set({ lastMilestoneHit: t })
            .where(eq(savingsGoals.id, goal.id));

          await this.recordMilestone(goal.id, t);
          newlyHitMilestone = t;

          // Surface milestone achievement into proactive insights feed
          try {
            await db.insert(proactiveInsights).values({
              id: `ins_${crypto.randomUUID()}`,
              userId,
              insightType: 'SAVINGS_OPPORTUNITY',
              severity: 'INFO',
              title: `🎉 Goal Milestone Reached: ${t}%!`,
              message: `Congratulations! Your micro-savings round-ups just helped you hit ${t}% of your goal "${goal.name}".`,
              actionLink: '/wealth-goals',
              isDismissed: 0,
              generatedAt: Math.floor(Date.now() / 1000),
            });
          } catch {
            // Ignore insight logging error
          }
          break;
        }
      }
    }

    return {
      roundUpDiff,
      newSavedAmount,
      goalId: goal.id,
      milestoneHit: newlyHitMilestone,
    };
  }
}
