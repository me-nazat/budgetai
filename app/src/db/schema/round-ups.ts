import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { accounts } from './accounts';
import { transactions } from './transactions';

export const roundUpRules = sqliteTable('round_up_rules', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sourceAccountId: integer('source_account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  targetGoalId: text('target_goal_id').notNull(),
  multiplier: real('multiplier').notNull().default(1.0), // 1.0, 2.0, 5.0
  minimumSweepThreshold: real('minimum_sweep_threshold').notNull().default(5.0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export const roundUpTransfers = sqliteTable(
  'round_up_transfers',
  {
    id: text('id').primaryKey(),
    ruleId: text('rule_id')
      .notNull()
      .references(() => roundUpRules.id, { onDelete: 'cascade' }),
    transactionId: integer('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    rawDelta: real('raw_delta').notNull(),
    multipliedAmount: real('multiplied_amount').notNull(),
    status: text('status').notNull().default('PENDING'), // 'PENDING', 'SWEPT', 'CANCELLED'
    sweptAt: integer('swept_at'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_round_up_pending').on(table.ruleId, table.status),
  ]
);

export type RoundUpRule = typeof roundUpRules.$inferSelect;
export type NewRoundUpRule = typeof roundUpRules.$inferInsert;

export type RoundUpTransfer = typeof roundUpTransfers.$inferSelect;
export type NewRoundUpTransfer = typeof roundUpTransfers.$inferInsert;
