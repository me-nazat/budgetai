/**
 * @fileoverview Automation rules service — coordinates business logic for auto-categorization.
 */

import { AutomationRulesRepository } from '@/repositories/automation-rules.repository';
import { AuditService } from '@/services/audit.service';
import { db } from '@/db/client';
import { transactions, automationAuditLog } from '@/db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { z } from 'zod';

export const createRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100),
  triggerType: z.enum(['description_contains']),
  triggerValue: z.string().min(1, 'Trigger value is required').max(200),
  actionType: z.enum(['set_category']),
  actionValue: z.string().min(1, 'Action value is required').max(100),
});

export const updateRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100).optional(),
  triggerType: z.enum(['description_contains']).optional(),
  triggerValue: z.string().min(1, 'Trigger value is required').max(200).optional(),
  actionType: z.enum(['set_category']).optional(),
  actionValue: z.string().min(1, 'Action value is required').max(100).optional(),
  active: z.union([z.literal(0), z.literal(1)]).optional(),
});

export interface AutomationMatchResult {
  category: string;
  matchedRuleName: string | null;
  matchedRuleId: number | null;
}

export class AutomationRulesService {
  /**
   * Fetches all rules for a user.
   */
  static async getRules(userId: number) {
    return AutomationRulesRepository.findAllByUserId(userId);
  }

  /**
   * Creates a new automation rule.
   */
  static async createRule(
    userId: number,
    data: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const validated = createRuleSchema.parse(data);
    const rule = await AutomationRulesRepository.create({
      userId,
      ...validated,
      active: 1,
    });

    AuditService.logCreate(
      userId,
      'automation_rule',
      rule.id,
      {
        name: rule.name,
        triggerType: rule.triggerType,
        triggerValue: rule.triggerValue,
        actionType: rule.actionType,
        actionValue: rule.actionValue,
        active: rule.active,
      },
      ip,
      userAgent
    );

    return rule;
  }

  /**
   * Updates an existing automation rule.
   */
  static async updateRule(
    userId: number,
    id: number,
    data: unknown,
    ip?: string,
    userAgent?: string
  ) {
    const validated = updateRuleSchema.parse(data);
    
    const existing = await AutomationRulesRepository.findById(id, userId);
    if (!existing) {
      throw new Error('Automation rule not found');
    }

    const updated = await AutomationRulesRepository.update(id, userId, validated);
    if (!updated) {
      throw new Error('Failed to update automation rule');
    }

    AuditService.logUpdate(
      userId,
      'automation_rule',
      id,
      {
        name: existing.name,
        triggerType: existing.triggerType,
        triggerValue: existing.triggerValue,
        actionType: existing.actionType,
        actionValue: existing.actionValue,
        active: existing.active,
      },
      {
        name: updated.name,
        triggerType: updated.triggerType,
        triggerValue: updated.triggerValue,
        actionType: updated.actionType,
        actionValue: updated.actionValue,
        active: updated.active,
      },
      ip,
      userAgent
    );

    return updated;
  }

  /**
   * Deletes an automation rule.
   */
  static async deleteRule(
    userId: number,
    id: number,
    ip?: string,
    userAgent?: string
  ) {
    const existing = await AutomationRulesRepository.findById(id, userId);
    if (!existing) {
      throw new Error('Automation rule not found');
    }

    const success = await AutomationRulesRepository.delete(id, userId);
    if (!success) {
      throw new Error('Failed to delete automation rule');
    }

    AuditService.logDelete(
      userId,
      'automation_rule',
      id,
      {
        name: existing.name,
        triggerType: existing.triggerType,
        triggerValue: existing.triggerValue,
        actionType: existing.actionType,
        actionValue: existing.actionValue,
        active: existing.active,
      },
      ip,
      userAgent
    );

    return true;
  }

  /**
   * Evaluates description against user's active rules and assigns category.
   */
  static async applyRules(
    userId: number,
    description: string,
    currentCategory: string
  ): Promise<AutomationMatchResult> {
    if (!description) {
      return { category: currentCategory, matchedRuleName: null, matchedRuleId: null };
    }

    try {
      const activeRules = await AutomationRulesRepository.findActiveByUserId(userId);
      const normalizedDesc = description.toLowerCase();

      for (const rule of activeRules) {
        if (rule.triggerType === 'description_contains') {
          const triggerVal = rule.triggerValue.toLowerCase();
          if (normalizedDesc.includes(triggerVal)) {
            return {
              category: rule.actionValue,
              matchedRuleName: rule.name,
              matchedRuleId: rule.id,
            };
          }
        }
      }
    } catch (err) {
      console.error('Error applying automation rules:', err);
    }

    return { category: currentCategory, matchedRuleName: null, matchedRuleId: null };
  }

  /**
   * Evaluates and applies active automation rules to all uncategorized transactions.
   */
  static async runRulesOnUncategorized(userId: number) {
    const activeRules = await AutomationRulesRepository.findActiveByUserId(userId);
    if (activeRules.length === 0) {
      return { processed: 0, updated: 0 };
    }

    const txs = await db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          or(
            isNull(transactions.category),
            eq(transactions.category, ''),
            eq(transactions.category, 'Other'),
            eq(transactions.category, 'Uncategorized')
          )
        )
      );

    let updatedCount = 0;
    for (const tx of txs) {
      const match = await this.applyRules(userId, tx.description, tx.category || 'Other');
      if (match.matchedRuleId && match.category !== tx.category) {
        await db
          .update(transactions)
          .set({ category: match.category })
          .where(eq(transactions.id, tx.id));

        await db.insert(automationAuditLog).values({
          userId,
          ruleId: match.matchedRuleId,
          transactionId: tx.id,
          actionPerformed: `Auto-categorized as ${match.category}`,
          previousValue: tx.category || 'Other',
          newValue: match.category,
          undone: 0,
        });

        updatedCount++;
      }
    }

    return { processed: txs.length, updated: updatedCount };
  }
}
