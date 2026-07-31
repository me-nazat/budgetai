import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { transactions } from './transactions';

export const taxCategories = sqliteTable('tax_categories', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(), // 'SCH_C_OFFICE', 'SCH_C_TRAVEL', 'MEALS_50'
  name: text('name').notNull(),
  deductiblePercentage: real('deductible_percentage').notNull().default(1.0),
  jurisdiction: text('jurisdiction').notNull().default('US_IRS'),
  description: text('description'),
});

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
    status: text('status').notNull().default('VERIFIED'), // 'POTENTIAL', 'VERIFIED', 'REJECTED'
    notes: text('notes'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_tax_deductions_user_year').on(table.userId, table.createdAt),
  ]
);

export type TaxCategory = typeof taxCategories.$inferSelect;
export type NewTaxCategory = typeof taxCategories.$inferInsert;

export type TaxDeduction = typeof taxDeductions.$inferSelect;
export type NewTaxDeduction = typeof taxDeductions.$inferInsert;
