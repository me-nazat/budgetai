import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/**
 * Module 26: Statement Pages for Multi-Page PDF Statements
 */
export const module26StatementPages = sqliteTable(
  'module_26_statement_pages',
  {
    id: text('id').primaryKey(),
    statementId: text('statement_id').notNull(),
    pageNumber: integer('page_number').notNull(),
    rawText: text('raw_text'),
    parsedJson: text('parsed_json'),
    parseStatus: text('parse_status', { enum: ['pending', 'parsed', 'failed'] })
      .notNull()
      .default('pending'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m26_statement_pages_stmt').on(table.statementId, table.pageNumber),
  ]
);

/**
 * Module 26: Commit Log for Statement Reconciliation Batches
 */
export const module26CommitLog = sqliteTable(
  'module_26_commit_log',
  {
    id: text('id').primaryKey(),
    batchId: text('batch_id').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    statementId: text('statement_id').notNull(),
    rowsCommitted: integer('rows_committed').notNull().default(0),
    startedAt: integer('started_at').default(sql`(unixepoch())`),
    finishedAt: integer('finished_at'),
    status: text('status', { enum: ['in_progress', 'committed', 'rolled_back'] })
      .notNull()
      .default('in_progress'),
  },
  (table) => [
    index('idx_m26_commit_log_batch').on(table.batchId),
    index('idx_m26_commit_log_user').on(table.userId),
  ]
);

export type Module26StatementPage = typeof module26StatementPages.$inferSelect;
export type NewModule26StatementPage = typeof module26StatementPages.$inferInsert;

export type Module26CommitLog = typeof module26CommitLog.$inferSelect;
export type NewModule26CommitLog = typeof module26CommitLog.$inferInsert;
