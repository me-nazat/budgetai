import { db } from '@/db/client';
import { statementImportBatches, transactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

export interface ParsedStatementRow {
  date: string;
  name: string;
  amount: number;
  type: 'expense' | 'earning';
  category: string;
  confidenceScore: number;
  duplicateHash: string;
  isExistingDuplicate?: boolean;
}

export class StatementRepository {
  /** Create statement import batch record */
  static async createBatch(data: {
    userId: number;
    bankName: string;
    fileName: string;
    totalRecords: number;
  }) {
    const [batch] = await db
      .insert(statementImportBatches)
      .values({
        userId: data.userId,
        bankName: data.bankName,
        fileName: data.fileName,
        totalRecords: data.totalRecords,
        status: 'completed',
      })
      .returning();
    return batch;
  }

  /** Compute cryptographic row hash to prevent duplicate entries */
  static generateRowHash(date: string, amount: number, description: string): string {
    const raw = `${date.trim()}_${Math.abs(amount).toFixed(2)}_${description.toLowerCase().trim()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /** Check existing database ledger for potential row matches */
  static async checkDuplicates(userId: number, rows: ParsedStatementRow[]): Promise<ParsedStatementRow[]> {
    const existingTransactions = await db
      .select({
        date: transactions.date,
        amount: transactions.amount,
        name: transactions.description,
      })
      .from(transactions)
      .where(eq(transactions.userId, userId));

    const existingHashes = new Set<string>();
    existingTransactions.forEach((tx) => {
      const hash = this.generateRowHash(tx.date, tx.amount, tx.name);
      existingHashes.add(hash);
    });

    return rows.map((row) => ({
      ...row,
      duplicateHash: this.generateRowHash(row.date, row.amount, row.name),
      isExistingDuplicate: existingHashes.has(
        this.generateRowHash(row.date, row.amount, row.name)
      ),
    }));
  }

  /** Commit batch of reconciled statement rows to ledger */
  static async commitReconciledTransactions(
    userId: number,
    rows: { name: string; amount: number; type: 'expense' | 'earning'; category: string; date: string }[]
  ) {
    const newTxEntries = rows.map((r) => ({
      userId,
      name: r.name,
      amount: r.amount,
      type: r.type,
      category: r.category || 'Other',
      date: r.date,
      source: 'bank_import',
    }));

    if (newTxEntries.length === 0) return [];

    return await db.insert(transactions).values(newTxEntries).returning();
  }
}
