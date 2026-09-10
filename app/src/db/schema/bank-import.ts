/**
 * @fileoverview Canonical Bank Statement Import Schema (Module 16).
 *
 * Preserves the canonical Gen 1 review queue with:
 * - 4-way resolution enum: 'pending' | 'kept_both' | 'merged' | 'discarded'
 * - Floating-point match confidence scoring [0.0 - 1.0]
 * - Direct foreign key linkage to existing transactions
 *
 * @module db/schema/bank-import
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { transactions } from './transactions';

/* ───────────────────────────────────────────────────────────────
   STATEMENT IMPORT BATCHES (Canonical Module 16)
   ─────────────────────────────────────────────────────────────── */

export const statementImportBatches = sqliteTable(
  'statement_import_batches',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bankName: text('bank_name').notNull(),
    fileName: text('file_name').notNull(),
    totalRecords: integer('total_records').notNull().default(0),
    status: text('status').notNull().default('completed'),
    reconciliationStatus: text('reconciliation_status').notNull().default('UNRECONCILED'),
    openingBalance: real('opening_balance'),
    closingBalance: real('closing_balance'),
    periodStart: text('period_start'),
    periodEnd: text('period_end'),
    sourceFileToken: text('source_file_token'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_statement_batches_user').on(table.userId),
  ]
);

export type StatementImportBatch = typeof statementImportBatches.$inferSelect;
export type NewStatementImportBatch = typeof statementImportBatches.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   BANK IMPORT REVIEW QUEUE (Canonical Module 16)
   ─────────────────────────────────────────────────────────────── */

export const bankImportReviewQueue = sqliteTable(
  'bank_import_review_queue',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    importBatchId: integer('import_batch_id'),
    parsedRowData: text('parsed_row_data').notNull(),
    possibleMatchTransactionId: integer('possible_match_transaction_id')
      .references(() => transactions.id, { onDelete: 'set null' }),
    matchConfidence: real('match_confidence').notNull().default(0.5),
    resolution: text('resolution', { enum: ['pending', 'kept_both', 'merged', 'discarded'] })
      .notNull()
      .default('pending'),
    resolvedAt: text('resolved_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_bank_import_review_user').on(table.userId, table.resolution),
  ]
);

export type BankImportReviewQueueItem = typeof bankImportReviewQueue.$inferSelect;
export type NewBankImportReviewQueueItem = typeof bankImportReviewQueue.$inferInsert;
