/**
 * @fileoverview Drizzle ORM schema for Module 22: Tax Tag Suggestions,
 * Fiscal Report Shares (Accountant Read-Only Token), and Missing Receipts Log.
 *
 * Implements Module 12 extensions (Features 12.1 & 12.2).
 *
 * @module db/schema/tax-modules22
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { taxCategories, taxDeductions } from './tax-vault';

export const module22TaxTagSuggestions = sqliteTable(
  'module_22_tax_tag_suggestions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    transactionPattern: text('transaction_pattern').notNull(),
    suggestedCategoryId: text('suggested_category_id')
      .notNull()
      .references(() => taxCategories.id, { onDelete: 'cascade' }),
    hitCount: integer('hit_count').notNull().default(1),
    lastUsedAt: integer('last_used_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m22_tag_suggestions_user').on(table.userId),
    index('idx_m22_tag_suggestions_pattern').on(table.transactionPattern),
  ]
);

export const module22FiscalReportShares = sqliteTable(
  'module_22_fiscal_report_shares',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taxYear: integer('tax_year').notNull(),
    token: text('token').notNull().unique(),
    expiresAt: integer('expires_at').notNull(),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: integer('last_viewed_at'),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    index('idx_m22_report_shares_token').on(table.token),
    index('idx_m22_report_shares_user').on(table.userId, table.taxYear),
  ]
);

export const module22MissingReceiptsLog = sqliteTable(
  'module_22_missing_receipts_log',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deductionId: text('deduction_id')
      .references(() => taxDeductions.id, { onDelete: 'cascade' }),
    flaggedAt: integer('flagged_at').default(sql`(unixepoch())`),
    reason: text('reason').notNull(),
  },
  (table) => [
    index('idx_m22_missing_receipts_user').on(table.userId),
  ]
);

export type Module22TaxTagSuggestion = typeof module22TaxTagSuggestions.$inferSelect;
export type NewModule22TaxTagSuggestion = typeof module22TaxTagSuggestions.$inferInsert;

export type Module22FiscalReportShare = typeof module22FiscalReportShares.$inferSelect;
export type NewModule22FiscalReportShare = typeof module22FiscalReportShares.$inferInsert;

export type Module22MissingReceiptsLog = typeof module22MissingReceiptsLog.$inferSelect;
export type NewModule22MissingReceiptsLog = typeof module22MissingReceiptsLog.$inferInsert;
