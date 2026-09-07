/**
 * @fileoverview Drizzle ORM schema for Module 20: Advanced Household Budget Cycles,
 * Cap Allocations, and Upcoming Settlements.
 *
 * Implements Module 10 extensions (Features 10.1 & 10.2).
 *
 * @module db/schema/household-modules20
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { households } from './index';

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

export type Module20HouseholdBudgetCycle = typeof module20HouseholdBudgetCycles.$inferSelect;
export type NewModule20HouseholdBudgetCycle = typeof module20HouseholdBudgetCycles.$inferInsert;

export type Module20HouseholdCapAllocation = typeof module20HouseholdCapAllocations.$inferSelect;
export type NewModule20HouseholdCapAllocation = typeof module20HouseholdCapAllocations.$inferInsert;

export type Module20UpcomingSettlement = typeof module20UpcomingSettlements.$inferSelect;
export type NewModule20UpcomingSettlement = typeof module20UpcomingSettlements.$inferInsert;
