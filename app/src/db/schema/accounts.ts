/**
 * @fileoverview Drizzle ORM schema for the `accounts` table.
 *
 * Tracks individual cash, bank, card, or mobile wallets belonging to a user,
 * maintaining a running balance.
 *
 * @module db/schema/accounts
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const accounts = sqliteTable(
  'accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['cash', 'bank', 'card', 'mobile_wallet', 'other'],
    }).notNull(),
    currency: text('currency').notNull().default('BDT'),
    openingBalance: real('opening_balance').notNull().default(0),
    currentBalance: real('current_balance').notNull().default(0),
    colorTag: text('color_tag').notNull().default('#136dec'),
    isArchived: integer('is_archived').notNull().default(0),
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_accounts_user').on(table.userId),
    index('idx_accounts_archive').on(table.isArchived),
  ]
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
