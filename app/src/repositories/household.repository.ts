import { db } from '@/db/client';
import {
  households,
  householdMembers,
  householdExpenses,
  householdSettlements,
  householdCategoryCaps,
  users,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface SettlementRecommendation {
  payerId: number;
  payerName: string;
  payeeId: number;
  payeeName: string;
  amount: number;
}

export class HouseholdRepository {
  /** Get household by ID */
  static async getHouseholdById(householdId: number) {
    const [hh] = await db.select().from(households).where(eq(households.id, householdId));
    return hh || null;
  }

  /** Get household for user */
  static async getHouseholdForUser(userId: number) {
    const members = await db
      .select({
        household: households,
        role: householdMembers.role,
      })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, userId));
    return members[0] || null;
  }

  /** Get household members with user details */
  static async getMembers(householdId: number) {
    return await db
      .select({
        id: householdMembers.id,
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

  /** Get household expenses */
  static async getExpenses(householdId: number) {
    return await db
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
      .orderBy(sql`${householdExpenses.createdAt} DESC`);
  }

  /** Log a household expense */
  static async addExpense(data: {
    householdId: number;
    userId: number;
    description: string;
    amount: number;
    category?: string;
    splitBetween?: string;
  }) {
    const [expense] = await db
      .insert(householdExpenses)
      .values({
        householdId: data.householdId,
        userId: data.userId,
        description: data.description,
        amount: data.amount,
        category: data.category || 'Other',
        splitBetween: data.splitBetween || 'all',
      })
      .returning();
    return expense;
  }

  /** Calculate net-settlements for a household (Algorithmic Net-Settlement Engine) */
  static async calculateNetSettlements(householdId: number): Promise<SettlementRecommendation[]> {
    const members = await this.getMembers(householdId);
    const expenses = await this.getExpenses(householdId);
    const settlements = await db
      .select()
      .from(householdSettlements)
      .where(and(eq(householdSettlements.householdId, householdId), eq(householdSettlements.status, 'settled')));

    if (members.length < 2) return [];

    const memberMap = new Map<number, string>();
    const balances = new Map<number, number>();

    members.forEach((m) => {
      memberMap.set(m.userId, m.userName);
      balances.set(m.userId, 0);
    });

    // 1. Calculate expense shares
    for (const exp of expenses) {
      let targetUserIds = members.map((m) => m.userId);
      if (exp.splitBetween !== 'all') {
        try {
          const parsed = JSON.parse(exp.splitBetween);
          if (Array.isArray(parsed) && parsed.length > 0) {
            targetUserIds = parsed;
          }
        } catch {
          // fallback to all
        }
      }

      const share = exp.amount / targetUserIds.length;

      // Payer gets credit
      balances.set(exp.userId, (balances.get(exp.userId) || 0) + exp.amount);

      // Participants get debited
      targetUserIds.forEach((uid) => {
        balances.set(uid, (balances.get(uid) || 0) - share);
      });
    }

    // 2. Adjust for prior settled payments
    for (const s of settlements) {
      balances.set(s.payerId, (balances.get(s.payerId) || 0) + s.amount);
      balances.set(s.payeeId, (balances.get(s.payeeId) || 0) - s.amount);
    }

    // 3. Debt simplification algorithm (Greedy balance matching)
    const debtors: { userId: number; amount: number }[] = [];
    const creditors: { userId: number; amount: number }[] = [];

    balances.forEach((bal, userId) => {
      if (bal < -0.01) {
        debtors.push({ userId, amount: -bal });
      } else if (bal > 0.01) {
        creditors.push({ userId, amount: bal });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const recommendations: SettlementRecommendation[] = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settlementAmount = Math.min(debtor.amount, creditor.amount);

      if (settlementAmount > 0.01) {
        recommendations.push({
          payerId: debtor.userId,
          payerName: memberMap.get(debtor.userId) || `User #${debtor.userId}`,
          payeeId: creditor.userId,
          payeeName: memberMap.get(creditor.userId) || `User #${creditor.userId}`,
          amount: Math.round(settlementAmount * 100) / 100,
        });
      }

      debtor.amount -= settlementAmount;
      creditor.amount -= settlementAmount;

      if (debtor.amount <= 0.01) i++;
      if (creditor.amount <= 0.01) j++;
    }

    return recommendations;
  }

  /** Log a settlement payment */
  static async recordSettlement(data: {
    householdId: number;
    payerId: number;
    payeeId: number;
    amount: number;
  }) {
    const [settlement] = await db
      .insert(householdSettlements)
      .values({
        householdId: data.householdId,
        payerId: data.payerId,
        payeeId: data.payeeId,
        amount: data.amount,
        status: 'settled',
        settledAt: new Date().toISOString(),
      })
      .returning();
    return settlement;
  }

  /** Get household category caps */
  static async getCategoryCaps(householdId: number) {
    return await db
      .select()
      .from(householdCategoryCaps)
      .where(eq(householdCategoryCaps.householdId, householdId));
  }

  /** Upsert category cap */
  static async setCategoryCap(data: {
    householdId: number;
    category: string;
    capAmount: number;
    allocatedByUserId: number;
  }) {
    const existing = await db
      .select()
      .from(householdCategoryCaps)
      .where(
        and(
          eq(householdCategoryCaps.householdId, data.householdId),
          eq(householdCategoryCaps.category, data.category)
        )
      );

    if (existing.length > 0) {
      const [updated] = await db
        .update(householdCategoryCaps)
        .set({
          capAmount: data.capAmount,
          allocatedByUserId: data.allocatedByUserId,
        })
        .where(eq(householdCategoryCaps.id, existing[0].id))
        .returning();
      return updated;
    }

    const [inserted] = await db
      .insert(householdCategoryCaps)
      .values(data)
      .returning();
    return inserted;
  }
}
