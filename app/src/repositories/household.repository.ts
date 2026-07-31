/**
 * @fileoverview Household repository — pure data access layer.
 *
 * Handles database operations for households, household_members,
 * household_expenses, household_category_caps, and household_settlements.
 *
 * @module repositories/household.repository
 */

import { db } from '@/db/client';
import {
  households,
  householdMembers,
  householdExpenses,
  householdCategoryCaps,
  householdSettlements,
  users,
  type Household,
  type HouseholdMember,
  type HouseholdExpense,
  type HouseholdCategoryCap,
  type HouseholdSettlement,
} from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export class HouseholdRepository {
  /**
   * Find household by ID.
   */
  static async findById(id: number): Promise<Household | null> {
    const [row] = await db.select().from(households).where(eq(households.id, id)).limit(1);
    return row || null;
  }

  /**
   * Find household by unique invite code.
   */
  static async findByInviteCode(code: string): Promise<Household | null> {
    const [row] = await db.select().from(households).where(eq(households.inviteCode, code)).limit(1);
    return row || null;
  }

  /**
   * Find all households for a user.
   */
  static async findByUserId(userId: number): Promise<Household[]> {
    const memberRows = await db
      .select({ householdId: householdMembers.householdId })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId));

    if (memberRows.length === 0) return [];
    const ids = memberRows.map((m) => m.householdId);

    return db.select().from(households).where(inArray(households.id, ids));
  }

  /**
   * Create a new household space.
   */
  static async createHousehold(name: string, inviteCode: string, createdBy: number): Promise<Household> {
    const [created] = await db
      .insert(households)
      .values({ name, inviteCode, createdBy })
      .returning();

    // Auto-add creator as owner
    await db.insert(householdMembers).values({
      householdId: created.id,
      userId: createdBy,
      role: 'owner',
    });

    return created;
  }

  /**
   * Get members of a household with user profiles.
   */
  static async findMembers(householdId: number) {
    return db
      .select({
        id: householdMembers.id,
        householdId: householdMembers.householdId,
        userId: householdMembers.userId,
        role: householdMembers.role,
        joinedAt: householdMembers.joinedAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(householdMembers)
      .innerJoin(users, eq(householdMembers.userId, users.id))
      .where(eq(householdMembers.householdId, householdId));
  }

  /**
   * Add a member to a household.
   */
  static async addMember(householdId: number, userId: number, role: 'owner' | 'member' = 'member'): Promise<HouseholdMember> {
    const [member] = await db
      .insert(householdMembers)
      .values({ householdId, userId, role })
      .returning();
    return member;
  }

  /**
   * Remove a member from a household.
   */
  static async removeMember(householdId: number, userId: number): Promise<boolean> {
    await db
      .delete(householdMembers)
      .where(and(eq(householdMembers.householdId, householdId), eq(householdMembers.userId, userId)));
    return true;
  }

  /**
   * Get all household expenses.
   */
  static async findExpenses(householdId: number) {
    return db
      .select({
        id: householdExpenses.id,
        householdId: householdExpenses.householdId,
        userId: householdExpenses.userId,
        description: householdExpenses.description,
        amount: householdExpenses.amount,
        category: householdExpenses.category,
        splitBetween: householdExpenses.splitBetween,
        createdAt: householdExpenses.createdAt,
        userName: users.name,
      })
      .from(householdExpenses)
      .innerJoin(users, eq(householdExpenses.userId, users.id))
      .where(eq(householdExpenses.householdId, householdId))
      .orderBy(householdExpenses.createdAt);
  }

  /**
   * Log a new household expense.
   */
  static async createExpense(
    householdId: number,
    userId: number,
    description: string,
    amount: number,
    category: string = 'Other',
    splitBetween: string = 'all'
  ): Promise<HouseholdExpense> {
    const [expense] = await db
      .insert(householdExpenses)
      .values({ householdId, userId, description, amount, category, splitBetween })
      .returning();
    return expense;
  }

  /**
   * Delete a household expense.
   */
  static async deleteExpense(expenseId: number, householdId: number): Promise<boolean> {
    await db
      .delete(householdExpenses)
      .where(and(eq(householdExpenses.id, expenseId), eq(householdExpenses.householdId, householdId)));
    return true;
  }

  /**
   * Get all settlements for a household.
   */
  static async findSettlements(householdId: number) {
    return db
      .select()
      .from(householdSettlements)
      .where(eq(householdSettlements.householdId, householdId))
      .orderBy(householdSettlements.createdAt);
  }

  /**
   * Create or log a settlement transfer.
   */
  static async createSettlement(
    householdId: number,
    payerId: number,
    payeeId: number,
    amount: number,
    status: 'pending' | 'settled' = 'pending'
  ): Promise<HouseholdSettlement> {
    const [settlement] = await db
      .insert(householdSettlements)
      .values({
        householdId,
        payerId,
        payeeId,
        amount,
        status,
        settledAt: status === 'settled' ? new Date().toISOString() : null,
      })
      .returning();
    return settlement;
  }

  /**
   * Mark a settlement as settled.
   */
  static async markSettlementAsSettled(settlementId: number): Promise<HouseholdSettlement | null> {
    const [updated] = await db
      .update(householdSettlements)
      .set({
        status: 'settled',
        settledAt: new Date().toISOString(),
      })
      .where(eq(householdSettlements.id, settlementId))
      .returning();
    return updated || null;
  }

  /**
   * Get category caps for a household.
   */
  static async findCategoryCaps(householdId: number): Promise<HouseholdCategoryCap[]> {
    return db
      .select()
      .from(householdCategoryCaps)
      .where(eq(householdCategoryCaps.householdId, householdId));
  }

  /**
   * Upsert a category cap.
   */
  static async setCategoryCap(
    householdId: number,
    category: string,
    capAmount: number,
    allocatedByUserId: number
  ): Promise<HouseholdCategoryCap> {
    const [existing] = await db
      .select()
      .from(householdCategoryCaps)
      .where(and(eq(householdCategoryCaps.householdId, householdId), eq(householdCategoryCaps.category, category)));

    if (existing) {
      const [updated] = await db
        .update(householdCategoryCaps)
        .set({ capAmount, allocatedByUserId })
        .where(eq(householdCategoryCaps.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(householdCategoryCaps)
      .values({ householdId, category, capAmount, allocatedByUserId })
      .returning();
    return created;
  }

  /**
   * Check whether an expense exceeds category cap for a household.
   * Returns current spent, cap amount, and whether cap is exceeded.
   */
  static async checkCategoryCap(householdId: number, category: string, newExpenseAmount: number) {
    const [cap] = await db
      .select()
      .from(householdCategoryCaps)
      .where(and(eq(householdCategoryCaps.householdId, householdId), eq(householdCategoryCaps.category, category)));

    if (!cap) return { capExceeded: false, currentSpent: 0, capAmount: 0 };

    const expenses = await db
      .select({ amount: householdExpenses.amount })
      .from(householdExpenses)
      .where(and(eq(householdExpenses.householdId, householdId), eq(householdExpenses.category, category)));

    const currentSpent = expenses.reduce((acc, e) => acc + e.amount, 0);
    const projectedSpent = currentSpent + newExpenseAmount;

    return {
      capExceeded: projectedSpent > cap.capAmount,
      currentSpent,
      projectedSpent,
      capAmount: cap.capAmount,
    };
  }

  /**
   * Get all recurring split rules for a household.
   */
  static async findSplitRules(householdId: number) {
    const { householdSplitRules } = await import('@/db/schema');
    return db
      .select()
      .from(householdSplitRules)
      .where(eq(householdSplitRules.householdId, householdId));
  }

  /**
   * Create a recurring split rule.
   */
  static async createSplitRule(data: {
    householdId: number;
    name: string;
    amount: number;
    category?: string;
    splitType?: 'equal' | 'percentage' | 'fixed';
    splitShares?: string;
    frequency?: 'monthly' | 'biweekly' | 'weekly';
    dayOfMonth?: number;
    nextRunDate?: string;
    createdByUserId: number;
  }) {
    const { householdSplitRules } = await import('@/db/schema');
    const [rule] = await db
      .insert(householdSplitRules)
      .values({
        householdId: data.householdId,
        name: data.name,
        amount: data.amount,
        category: data.category || 'Bills & Utilities',
        splitType: data.splitType || 'equal',
        splitShares: data.splitShares || null,
        frequency: data.frequency || 'monthly',
        dayOfMonth: data.dayOfMonth || 1,
        nextRunDate: data.nextRunDate || new Date().toISOString().split('T')[0],
        createdByUserId: data.createdByUserId,
      })
      .returning();
    return rule;
  }

  /**
   * Delete a split rule.
   */
  static async deleteSplitRule(ruleId: number, householdId: number) {
    const { householdSplitRules } = await import('@/db/schema');
    await db
      .delete(householdSplitRules)
      .where(and(eq(householdSplitRules.id, ruleId), eq(householdSplitRules.householdId, householdId)));
    return true;
  }
}
