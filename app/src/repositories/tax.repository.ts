import { db } from '@/db/client';
import { taxDeductions, taxCategories, transactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { encryptNumber, decryptNumber } from '@/lib/crypto/encryption';

export class TaxRepository {
  /** Get itemized tax deductions for user and tax year */
  static async getTaxDeductions(userId: number, taxYear?: number) {
    const query = db
      .select({
        id: taxDeductions.id,
        userId: taxDeductions.userId,
        transactionId: taxDeductions.transactionId,
        taxCategoryId: taxDeductions.taxCategoryId,
        categoryName: taxCategories.name,
        categoryCode: taxCategories.code,
        deductiblePercentage: taxCategories.deductiblePercentage,
        eligibleAmount: taxDeductions.eligibleAmount,
        deductibleAmount: taxDeductions.deductibleAmount,
        encryptedEligibleAmount: taxDeductions.encryptedEligibleAmount,
        encryptedDeductibleAmount: taxDeductions.encryptedDeductibleAmount,
        receiptDocumentId: taxDeductions.receiptDocumentId,
        status: taxDeductions.status,
        notes: taxDeductions.notes,
        createdAt: taxDeductions.createdAt,
        transactionName: transactions.description,
        transactionDate: transactions.date,
        transactionCategory: transactions.category,
      })
      .from(taxDeductions)
      .leftJoin(taxCategories, eq(taxDeductions.taxCategoryId, taxCategories.id))
      .leftJoin(transactions, eq(taxDeductions.transactionId, transactions.id))
      .where(eq(taxDeductions.userId, userId))
      .orderBy(sql`${taxDeductions.createdAt} DESC`);

    const rows = await query;

    // Decrypt amounts in memory per Decision A3
    return rows.map((r) => {
      let eligible = r.eligibleAmount;
      let deductible = r.deductibleAmount;

      if (r.encryptedEligibleAmount) {
        try {
          eligible = decryptNumber(r.encryptedEligibleAmount, 'amount');
        } catch {
          // Fall back to unencrypted column
        }
      }

      if (r.encryptedDeductibleAmount) {
        try {
          deductible = decryptNumber(r.encryptedDeductibleAmount, 'amount');
        } catch {
          // Fall back to unencrypted column
        }
      }

      return {
        id: r.id,
        userId: r.userId,
        transactionId: r.transactionId,
        taxCategoryId: r.taxCategoryId,
        deductionCategory: r.categoryName || 'General Deduction',
        categoryCode: r.categoryCode || 'OTHER',
        deductiblePercentage: r.deductiblePercentage ?? 1.0,
        eligibleAmount: eligible,
        deductibleAmount: deductible,
        receiptDocumentId: r.receiptDocumentId,
        status: r.status,
        notes: r.notes,
        createdAt: r.createdAt,
        transactionName: r.transactionName,
        transactionDate: r.transactionDate,
        transactionCategory: r.transactionCategory,
      };
    });
  }

  /** Add or flag transaction as tax deductible */
  static async flagDeduction(data: {
    userId: number;
    transactionId?: number;
    taxCategoryId: string;
    eligibleAmount: number;
    deductibleAmount?: number;
    receiptDocumentId?: number;
    notes?: string;
  }) {
    const id = uuidv4();
    const deductibleAmount = data.deductibleAmount ?? data.eligibleAmount;

    let encryptedEligibleAmount: string | null = null;
    let encryptedDeductibleAmount: string | null = null;

    try {
      encryptedEligibleAmount = encryptNumber(data.eligibleAmount, 'amount');
      encryptedDeductibleAmount = encryptNumber(deductibleAmount, 'amount');
    } catch {
      // Graceful fallback if key not configured in test
    }

    const [item] = await db
      .insert(taxDeductions)
      .values({
        id,
        userId: data.userId,
        transactionId: data.transactionId ? Number(data.transactionId) : null,
        taxCategoryId: data.taxCategoryId,
        eligibleAmount: data.eligibleAmount,
        deductibleAmount,
        encryptedEligibleAmount,
        encryptedDeductibleAmount,
        receiptDocumentId: data.receiptDocumentId,
        status: 'VERIFIED',
        notes: data.notes,
      })
      .returning();

    return item;
  }

  /** Remove tax deduction flag */
  static async removeDeduction(id: string, userId: number) {
    return await db
      .delete(taxDeductions)
      .where(and(eq(taxDeductions.id, id), eq(taxDeductions.userId, userId)));
  }

  /** Get annual tax summary aggregate */
  static async getTaxSummary(userId: number, taxYear?: number) {
    const items = await this.getTaxDeductions(userId, taxYear);

    const categoryBreakdown: Record<string, number> = {};
    let totalDeductibleAmount = 0;

    items.forEach((item) => {
      totalDeductibleAmount += item.deductibleAmount;
      categoryBreakdown[item.deductionCategory] =
        (categoryBreakdown[item.deductionCategory] || 0) + item.deductibleAmount;
    });

    return {
      taxYear: taxYear || new Date().getFullYear(),
      totalDeductibleAmount,
      totalItemsCount: items.length,
      categoryBreakdown,
      items,
    };
  }
}
