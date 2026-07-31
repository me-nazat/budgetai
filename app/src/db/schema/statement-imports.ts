import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { accounts } from './accounts';
import { transactions } from './transactions';

export const importedStatements = sqliteTable('imported_statements', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  statementPeriodStart: text('statement_period_start'),
  statementPeriodEnd: text('statement_period_end'),
  openingBalance: real('opening_balance'),
  closingBalance: real('closing_balance'),
  totalTransactionsCount: integer('total_transactions_count').notNull().default(0),
  reconciliationStatus: text('reconciliation_status').notNull().default('UNRECONCILED'), // 'UNRECONCILED', 'BALANCED', 'COMMITTED'
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

export const reconciliationQueue = sqliteTable(
  'reconciliation_queue',
  {
    id: text('id').primaryKey(),
    statementId: text('statement_id')
      .notNull()
      .references(() => importedStatements.id, { onDelete: 'cascade' }),
    transactionDate: text('transaction_date').notNull(),
    description: text('description').notNull(),
    amount: real('amount').notNull(),
    categorySuggestion: text('category_suggestion'),
    isDuplicate: integer('is_duplicate').notNull().default(0),
    matchedExistingTransactionId: integer('matched_existing_transaction_id')
      .references(() => transactions.id, { onDelete: 'set null' }),
    reviewStatus: text('review_status').notNull().default('PENDING'), // 'PENDING', 'APPROVED', 'REJECTED'
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_recon_queue_statement').on(table.statementId, table.reviewStatus),
  ]
);

export type ImportedStatement = typeof importedStatements.$inferSelect;
export type NewImportedStatement = typeof importedStatements.$inferInsert;

export type ReconciliationQueueItem = typeof reconciliationQueue.$inferSelect;
export type NewReconciliationQueueItem = typeof reconciliationQueue.$inferInsert;
