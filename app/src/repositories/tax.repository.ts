import { db } from '@/db/client';
import { taxDeductionItems, transactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class TaxRepository {
  /** Get itemized tax deductions for user and tax year */
  static async getTaxDeductions(userId: number, taxYear: number) {
    return await db
      .select({
        id: taxDeductionItems.id,
        userId: taxDeductionItems.userId,
        transactionId: taxDeductionItems.transactionId,
        taxYear: taxDeductionItems.taxYear,
        deductionCategory: taxDeductionItems.deductionCategory,
        deductibleAmount: taxDeductionItems.deductibleAmount,
        receiptDocumentId: taxDeductionItems.receiptDocumentId,
        status: taxDeductionItems.status,
        createdAt: taxDeductionItems.createdAt,
        transactionName: transactions.description,
        transactionDate: transactions.date,
        transactionCategory: transactions.category,
      })
      .from(taxDeductionItems)
      .leftJoin(transactions, eq(taxDeductionItems.transactionId, transactions.id))
      .where(and(eq(taxDeductionItems.userId, userId), eq(taxDeductionItems.taxYear, taxYear)))
      .orderBy(sql`${taxDeductionItems.createdAt} DESC`);
  }

  /** Add or flag transaction as tax deductible */
  static async flagDeduction(data: {
    userId: number;
    transactionId?: number;
    taxYear: number;
    deductionCategory: string;
    deductibleAmount: number;
    receiptDocumentId?: number;
  }) {
    const [item] = await db
      .insert(taxDeductionItems)
      .values({
        userId: data.userId,
        transactionId: data.transactionId,
        taxYear: data.taxYear,
        deductionCategory: data.deductionCategory,
        deductibleAmount: data.deductibleAmount,
        receiptDocumentId: data.receiptDocumentId,
        status: 'verified',
      })
      .returning();
    return item;
  }

  /** Remove tax deduction flag */
  static async removeDeduction(id: number, userId: number) {
    return await db
      .delete(taxDeductionItems)
      .where(and(eq(taxDeductionItems.id, id), eq(taxDeductionItems.userId, userId)));
  }

  /** Get annual tax summary aggregate */
  static async getTaxSummary(userId: number, taxYear: number) {
    const items = await this.getTaxDeductions(userId, taxYear);

    const categoryBreakdown: Record<string, number> = {};
    let totalDeductibleAmount = 0;

    items.forEach((item) => {
      totalDeductibleAmount += item.deductibleAmount;
      categoryBreakdown[item.deductionCategory] =
        (categoryBreakdown[item.deductionCategory] || 0) + item.deductibleAmount;
    });

    return {
      taxYear,
      totalDeductibleAmount,
      totalItemsCount: items.length,
      categoryBreakdown,
      items,
    };
  }
}
