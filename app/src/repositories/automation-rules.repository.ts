/**
 * @fileoverview Automation rules repository — pure data access layer.
 *
 * Handles database operations for the `automation_rules` table using Drizzle ORM.
 */

import { db } from '@/db/client';
import { automationRules, type AutomationRule, type NewAutomationRule } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export class AutomationRulesRepository {
  /**
   * Retrieves all rules for a user.
   */
  static async findAllByUserId(userId: number): Promise<AutomationRule[]> {
    return db
      .select()
      .from(automationRules)
      .where(eq(automationRules.userId, userId))
      .orderBy(automationRules.createdAt);
  }

  /**
   * Retrieves active rules for a user.
   */
  static async findActiveByUserId(userId: number): Promise<AutomationRule[]> {
    return db
      .select()
      .from(automationRules)
      .where(and(eq(automationRules.userId, userId), eq(automationRules.active, 1)))
      .orderBy(automationRules.createdAt);
  }

  /**
   * Finds a single rule by ID.
   */
  static async findById(id: number, userId: number): Promise<AutomationRule | null> {
    const [rule] = await db
      .select()
      .from(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.userId, userId)))
      .limit(1);
    return rule || null;
  }

  /**
   * Creates a new automation rule.
   */
  static async create(data: Omit<NewAutomationRule, 'id' | 'createdAt'>): Promise<AutomationRule> {
    const [inserted] = await db
      .insert(automationRules)
      .values(data)
      .returning();
    return inserted;
  }

  /**
   * Updates an existing rule.
   */
  static async update(
    id: number,
    userId: number,
    data: Partial<NewAutomationRule>
  ): Promise<AutomationRule | null> {
    const [updated] = await db
      .update(automationRules)
      .set(data)
      .where(and(eq(automationRules.id, id), eq(automationRules.userId, userId)))
      .returning();
    return updated || null;
  }

  /**
   * Deletes a rule.
   */
  static async delete(id: number, userId: number): Promise<boolean> {
    const res = await db
      .delete(automationRules)
      .where(and(eq(automationRules.id, id), eq(automationRules.userId, userId)))
      .returning();
    return res.length > 0;
  }
}
