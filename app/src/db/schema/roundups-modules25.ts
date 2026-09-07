import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { savingsGoals } from './index';

/**
 * Module 25: Escrow Sweeps for Micro-Savings Round-Ups
 */
export const module25RoundUpSweeps = sqliteTable(
  'module_25_round_up_sweeps',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ruleId: text('rule_id'),
    totalAmount: real('total_amount').notNull(),
    status: text('status', { enum: ['pending', 'completed', 'failed'] })
      .notNull()
      .default('pending'),
    sweptAt: integer('swept_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m25_sweeps_user').on(table.userId, table.status),
  ]
);

/**
 * Module 25: Stretch Goal Suggestions on Milestone 100% Completion
 */
export const module25StretchGoalSuggestions = sqliteTable(
  'module_25_stretch_goal_suggestions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceGoalId: integer('source_goal_id')
      .notNull()
      .references(() => savingsGoals.id, { onDelete: 'cascade' }),
    suggestedTarget: real('suggested_target').notNull(),
    suggestedDeadline: text('suggested_deadline').notNull(),
    acceptedAt: integer('accepted_at'),
    dismissedAt: integer('dismissed_at'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m25_stretch_goal_user').on(table.userId),
  ]
);

export type Module25RoundUpSweep = typeof module25RoundUpSweeps.$inferSelect;
export type NewModule25RoundUpSweep = typeof module25RoundUpSweeps.$inferInsert;

export type Module25StretchGoalSuggestion = typeof module25StretchGoalSuggestions.$inferSelect;
export type NewModule25StretchGoalSuggestion = typeof module25StretchGoalSuggestions.$inferInsert;
