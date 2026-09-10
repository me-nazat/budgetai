/**
 * @fileoverview Household feature schema — core households, members, expenses, ledgers, splits,
 * settlements, category caps, split rules, budget cycles, cap allocations, and upcoming settlements.
 *
 * Consolidates:
 * - Gen 1: index.ts Module 9 & 10 (households, householdMembers, householdExpenses,
 *          householdSettlements, householdCategoryCaps, householdSplitRules)
 * - Gen 2: household-splits.ts (householdLedgers, householdSplits)
 * - Gen 3: household-modules20.ts (module20HouseholdBudgetCycles, module20HouseholdCapAllocations, module20UpcomingSettlements)
 *
 * @module db/schema/household
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/* ───────────────────────────────────────────────────────────────
   HOUSEHOLDS — Shared family/household spaces (Module 9)
   ─────────────────────────────────────────────────────────────── */

/**
 * Households table — a shared financial space for families/roommates.
 */
export const households = sqliteTable('households', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  /** Display name (e.g., "Smith Family", "Apartment 4B"). */
  name: text('name').notNull(),

  /** Unique invite code for joining. */
  inviteCode: text('invite_code').notNull(),

  /** User who created this household. */
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Default split mode for new recurring bills or ad-hoc splits. */
  defaultSplitMode: text('default_split_mode', { enum: ['equal', 'pro_rata', 'custom'] })
    .notNull()
    .default('equal'),

  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;

/**
 * Household members — many-to-many between users and households.
 */
export const householdMembers = sqliteTable(
  'household_members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Role within the household. */
    role: text('role', { enum: ['owner', 'member'] }).notNull().default('member'),

    joinedAt: text('joined_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_hh_members_household').on(table.householdId),
    index('idx_hh_members_user').on(table.userId),
  ]
);

export type HouseholdMember = typeof householdMembers.$inferSelect;
export type NewHouseholdMember = typeof householdMembers.$inferInsert;

/**
 * Household expenses — shared expenses within a household.
 */
export const householdExpenses = sqliteTable(
  'household_expenses',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),

    /** The member who paid/logged the expense. */
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    description: text('description').notNull(),
    amount: real('amount').notNull(),
    category: text('category').notNull().default('Other'),

    /** Who should share this expense: 'all' or JSON array of user IDs. */
    splitBetween: text('split_between').notNull().default('all'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_hh_expenses_household').on(table.householdId, table.createdAt),
    index('idx_hh_expenses_user').on(table.userId),
  ]
);

export type HouseholdExpense = typeof householdExpenses.$inferSelect;
export type NewHouseholdExpense = typeof householdExpenses.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   HOUSEHOLD SETTLEMENTS (ex index.ts Gen 1 — Module 10)
   ─────────────────────────────────────────────────────────────── */

export const householdSettlements = sqliteTable(
  'household_settlements',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    payerId: integer('payer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    payeeId: integer('payee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    encryptedAmount: text('encrypted_amount'),
    sourceRuleId: integer('source_rule_id'),
    status: text('status', { enum: ['pending', 'settled'] }).notNull().default('pending'),
    settledAt: text('settled_at'),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_hh_settlements_household').on(table.householdId),
    index('idx_hh_settlements_payer').on(table.payerId),
  ]
);

export type HouseholdSettlement = typeof householdSettlements.$inferSelect;
export type NewHouseholdSettlement = typeof householdSettlements.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   HOUSEHOLD CATEGORY CAPS (ex index.ts Gen 1 — Module 10)
   ─────────────────────────────────────────────────────────────── */

export const householdCategoryCaps = sqliteTable(
  'household_category_caps',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    capAmount: real('cap_amount').notNull(),
    encryptedCapAmount: text('encrypted_cap_amount'),
    rolloverPolicy: text('rollover_policy', { enum: ['none', 'next_month', 'pool'] })
      .notNull()
      .default('none'),
    allocatedByUserId: integer('allocated_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_hh_caps_household').on(table.householdId, table.category),
  ]
);

export type HouseholdCategoryCap = typeof householdCategoryCaps.$inferSelect;
export type NewHouseholdCategoryCap = typeof householdCategoryCaps.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   HOUSEHOLD SPLIT RULES (ex index.ts Gen 1 — Module 10 Feature 2)
   ─────────────────────────────────────────────────────────────── */

/** Recurring auto-split rules for household bills */
export const householdSplitRules = sqliteTable(
  'household_split_rules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    /** Name of the recurring expense (e.g. "Rent", "Netflix", "Electricity") */
    name: text('name').notNull(),
    /** Amount of the recurring expense */
    amount: real('amount').notNull(),
    /** Expense category for the auto-generated transaction */
    category: text('category').notNull().default('Bills & Utilities'),
    /** How to split: 'equal' | 'percentage' | 'fixed' */
    splitType: text('split_type', { enum: ['equal', 'percentage', 'fixed'] }).notNull().default('equal'),
    /**
     * JSON object mapping userId -> share.
     * For 'equal': not used (all members split equally).
     * For 'percentage': { "1": 60, "2": 40 } (must sum to 100).
     * For 'fixed': { "1": 300, "2": 200 } (must sum to amount).
     */
    splitShares: text('split_shares'),
    /** Cron frequency: 'monthly' | 'biweekly' | 'weekly' */
    frequency: text('frequency', { enum: ['monthly', 'biweekly', 'weekly'] }).notNull().default('monthly'),
    /** Day of month for 'monthly' frequency (1-28) */
    dayOfMonth: integer('day_of_month').default(1),
    /** Next scheduled run date (ISO string) */
    nextRunDate: text('next_run_date'),
    /** Whether this rule is active */
    active: integer('active').notNull().default(1),
    /** User who created the rule */
    createdByUserId: integer('created_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_hh_split_rules_household').on(table.householdId),
    index('idx_hh_split_rules_next_run').on(table.nextRunDate),
  ]
);

export type HouseholdSplitRule = typeof householdSplitRules.$inferSelect;
export type NewHouseholdSplitRule = typeof householdSplitRules.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   BUDGET CYCLES & CAP ALLOCATIONS (ex household-modules20.ts Gen 3)
   SQL table names preserved: module_20_household_budget_cycles, module_20_household_cap_allocations
   ─────────────────────────────────────────────────────────────── */

export const module20HouseholdBudgetCycles = sqliteTable(
  'module_20_household_budget_cycles',
  {
    id: text('id').primaryKey(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // 'YYYY-MM'
    totalCap: real('total_cap').notNull(),
    status: text('status', { enum: ['active', 'closed'] }).notNull().default('active'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m20_budget_cycles_hh').on(table.householdId, table.yearMonth),
  ]
);

export type Module20HouseholdBudgetCycle = typeof module20HouseholdBudgetCycles.$inferSelect;
export type NewModule20HouseholdBudgetCycle = typeof module20HouseholdBudgetCycles.$inferInsert;

export const module20HouseholdCapAllocations = sqliteTable(
  'module_20_household_cap_allocations',
  {
    id: text('id').primaryKey(),
    cycleId: text('cycle_id')
      .notNull()
      .references(() => module20HouseholdBudgetCycles.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    capAmount: real('cap_amount').notNull(),
    contributedByUserId: integer('contributed_by_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m20_cap_allocations_cycle').on(table.cycleId, table.category),
  ]
);

export type Module20HouseholdCapAllocation = typeof module20HouseholdCapAllocations.$inferSelect;
export type NewModule20HouseholdCapAllocation = typeof module20HouseholdCapAllocations.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   UPCOMING SETTLEMENTS (ex household-modules20.ts Gen 3)
   SQL table name preserved: module_20_upcoming_settlements
   ─────────────────────────────────────────────────────────────── */

export const module20UpcomingSettlements = sqliteTable(
  'module_20_upcoming_settlements',
  {
    id: text('id').primaryKey(),
    householdId: integer('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    fromUserId: integer('from_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toUserId: integer('to_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    amount: real('amount').notNull(),
    dueDate: text('due_date').notNull(),
    status: text('status', { enum: ['pending', 'confirmed', 'paid', 'cancelled'] })
      .notNull()
      .default('pending'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m20_upcoming_settlements_hh').on(table.householdId, table.status),
    index('idx_m20_upcoming_settlements_from').on(table.fromUserId),
    index('idx_m20_upcoming_settlements_to').on(table.toUserId),
  ]
);

export type Module20UpcomingSettlement = typeof module20UpcomingSettlements.$inferSelect;
export type NewModule20UpcomingSettlement = typeof module20UpcomingSettlements.$inferInsert;
