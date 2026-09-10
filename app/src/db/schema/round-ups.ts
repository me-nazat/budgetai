/**
 * @fileoverview Round-up savings schema — rules, transfers, escrow sweeps,
 * and stretch goal suggestions.
 *
 * Consolidates:
 * - Gen 2: round-ups.ts (roundUpRules, roundUpTransfers)
 * - Gen 3: roundups-modules25.ts (module25RoundUpSweeps, module25StretchGoalSuggestions)
 *
 * @module db/schema/round-ups
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { accounts } from './accounts';
import { transactions } from './transactions';
import { savingsGoals } from './index';

/* ───────────────────────────────────────────────────────────────
   ROUND-UP RULES (Gen 2)
   ─────────────────────────────────────────────────────────────── */

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

export type RoundUpRule = typeof roundUpRules.$inferSelect;
export type NewRoundUpRule = typeof roundUpRules.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   ROUND-UP TRANSFERS (Gen 2)
   ─────────────────────────────────────────────────────────────── */

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
    sweepWindowId: text('sweep_window_id'),
    sweptAt: integer('swept_at'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_round_up_pending').on(table.ruleId, table.status),
  ]
);

export type RoundUpTransfer = typeof roundUpTransfers.$inferSelect;
export type NewRoundUpTransfer = typeof roundUpTransfers.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   ROUND-UP SWEEPS (ex roundups-modules25.ts Gen 3)
   SQL table name preserved: module_25_round_up_sweeps
   ─────────────────────────────────────────────────────────────── */

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

export type Module25RoundUpSweep = typeof module25RoundUpSweeps.$inferSelect;
export type NewModule25RoundUpSweep = typeof module25RoundUpSweeps.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   STRETCH GOAL SUGGESTIONS (ex roundups-modules25.ts Gen 3)
   SQL table name preserved: module_25_stretch_goal_suggestions
   ─────────────────────────────────────────────────────────────── */

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

export type Module25StretchGoalSuggestion = typeof module25StretchGoalSuggestions.$inferSelect;
export type NewModule25StretchGoalSuggestion = typeof module25StretchGoalSuggestions.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   GOAL MILESTONES (Gen 1 / Module 15 Event Log)
   ─────────────────────────────────────────────────────────────── */

export const goalMilestones = sqliteTable(
  'goal_milestones',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    goalId: integer('goal_id')
      .notNull()
      .references(() => savingsGoals.id, { onDelete: 'cascade' }),
    milestonePercentage: integer('milestone_percentage').notNull(),
    achievedAt: text('achieved_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_goal_milestones_goal').on(table.goalId),
  ]
);

export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type NewGoalMilestone = typeof goalMilestones.$inferInsert;


