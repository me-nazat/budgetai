import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const householdLedgers = sqliteTable(
  'household_ledgers',
  {
    id: text('id').primaryKey(),
    householdId: text('household_id').notNull(),
    categoryId: text('category_id'),
    name: text('name').notNull(),
    splitMode: text('split_mode').notNull().default('EQUAL'), // 'EQUAL', 'PRO_RATA', 'CUSTOM'
    createdAt: integer('created_at').default(sql`(unixepoch())`),
    updatedAt: integer('updated_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_household_ledgers_household').on(table.householdId),
  ]
);

export const householdSplits = sqliteTable(
  'household_splits',
  {
    id: text('id').primaryKey(),
    expenseId: text('expense_id').notNull(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    owedAmount: real('owed_amount').notNull(),
    paidAmount: real('paid_amount').notNull().default(0.0),
    percentageShare: real('percentage_share').notNull(),
    isSettled: integer('is_settled').notNull().default(0),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_household_splits_expense').on(table.expenseId),
    index('idx_household_splits_user').on(table.userId, table.isSettled),
  ]
);

export type HouseholdLedger = typeof householdLedgers.$inferSelect;
export type NewHouseholdLedger = typeof householdLedgers.$inferInsert;

export type HouseholdSplit = typeof householdSplits.$inferSelect;
export type NewHouseholdSplit = typeof householdSplits.$inferInsert;
