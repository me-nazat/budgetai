/**
 * @fileoverview Tax feature schema — categories, deductions, AI tag suggestions,
 * and accountant-facing fiscal report share tokens.
 *
 * Consolidates:
 * - Gen 2: tax-vault.ts (taxCategories, taxDeductions)
 * - Gen 3: tax-modules22.ts (module22TaxTagSuggestions, module22FiscalReportShares)
 *
 * @module db/schema/tax-vault
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { transactions } from './transactions';

/* ───────────────────────────────────────────────────────────────
   TAX CATEGORIES (Gen 2)
   ─────────────────────────────────────────────────────────────── */

export const taxCategories = sqliteTable('tax_categories', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // 'SCH_C_OFFICE', 'SCH_C_TRAVEL', 'MEALS_50'
  name: text('name').notNull(),
  deductiblePercentage: real('deductible_percentage').notNull().default(1.0),
  jurisdiction: text('jurisdiction').notNull().default('US_IRS'),
  description: text('description'),
});

export type TaxCategory = typeof taxCategories.$inferSelect;
export type NewTaxCategory = typeof taxCategories.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   TAX DEDUCTIONS (Gen 2)
   ─────────────────────────────────────────────────────────────── */

export const taxDeductions = sqliteTable(
  'tax_deductions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    transactionId: integer('transaction_id')
      .unique()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    taxCategoryId: text('tax_category_id')
      .notNull()
      .references(() => taxCategories.id),
    eligibleAmount: real('eligible_amount').notNull(),
    deductibleAmount: real('deductible_amount').notNull(),
    encryptedEligibleAmount: text('encrypted_eligible_amount'),
    encryptedDeductibleAmount: text('encrypted_deductible_amount'),
    jurisdiction: text('jurisdiction').notNull().default('US_IRS'),
    receiptDocumentId: integer('receipt_document_id'),
    status: text('status').notNull().default('VERIFIED'), // 'POTENTIAL', 'VERIFIED', 'REJECTED'
    notes: text('notes'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_tax_deductions_user_year').on(table.userId, table.createdAt),
  ]
);

export type TaxDeduction = typeof taxDeductions.$inferSelect;
export type NewTaxDeduction = typeof taxDeductions.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   TAX TAG SUGGESTIONS (ex tax-modules22.ts Gen 3)
   SQL table name preserved: module_22_tax_tag_suggestions
   ─────────────────────────────────────────────────────────────── */

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

export type Module22TaxTagSuggestion = typeof module22TaxTagSuggestions.$inferSelect;
export type NewModule22TaxTagSuggestion = typeof module22TaxTagSuggestions.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   FISCAL REPORT SHARES (ex tax-modules22.ts Gen 3)
   SQL table name preserved: module_22_fiscal_report_shares
   ─────────────────────────────────────────────────────────────── */

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

export type Module22FiscalReportShare = typeof module22FiscalReportShares.$inferSelect;
export type NewModule22FiscalReportShare = typeof module22FiscalReportShares.$inferInsert;



