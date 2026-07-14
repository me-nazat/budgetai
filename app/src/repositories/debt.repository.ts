/**
 * @fileoverview Debt repository — pure data access layer.
 *
 * Handles all database operations for the `debts` table using Drizzle ORM.
 * Provides transparent encryption/decryption of the sensitive balance field.
 */

import { db } from '@/db/client';
import { debts, type Debt, type NewDebt } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { encryptField, decryptField } from '@/lib/crypto/encryption';

export class DebtRepository {
  /**
   * Decrypts a debt's sensitive balance.
   */
  private static decryptDebt(debt: Debt): Debt {
    if (debt.encryptedBalance) {
      try {
        const decrypted = decryptField(debt.encryptedBalance, 'debt-balance');
        if (decrypted) {
          debt.balance = parseFloat(decrypted);
        }
      } catch (err) {
        console.error(`Failed to decrypt balance for debt ${debt.id}:`, err);
      }
    }
    return debt;
  }

  /**
   * Retrieves all debts for a user.
   */
  static async findAllByUserId(userId: number): Promise<Debt[]> {
    const list = await db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(debts.createdAt);
    return list.map(d => this.decryptDebt(d));
  }

  /**
   * Finds a single debt by ID.
   */
  static async findById(id: number, userId: number): Promise<Debt | null> {
    const [debt] = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .limit(1);
    if (!debt) return null;
    return this.decryptDebt(debt);
  }

  /**
   * Creates a new debt.
   */
  static async create(data: Omit<NewDebt, 'id' | 'createdAt'>): Promise<Debt> {
    const balanceStr = String(data.balance);
    const encrypted = encryptField(balanceStr, 'debt-balance');

    const [inserted] = await db
      .insert(debts)
      .values({
        ...data,
        encryptedBalance: encrypted,
      })
      .returning();

    return this.decryptDebt(inserted);
  }

  /**
   * Updates an existing debt.
   */
  static async update(
    id: number,
    userId: number,
    data: Partial<NewDebt>
  ): Promise<Debt | null> {
    const updateData = { ...data };
    if (data.balance !== undefined) {
      const balanceStr = String(data.balance);
      updateData.encryptedBalance = encryptField(balanceStr, 'debt-balance');
    }

    const [updated] = await db
      .update(debts)
      .set(updateData)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning();

    if (!updated) return null;
    return this.decryptDebt(updated);
  }

  /**
   * Deletes a debt.
   */
  static async delete(id: number, userId: number): Promise<boolean> {
    const res = await db
      .delete(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)))
      .returning();
    return res.length > 0;
  }
}
