/**
 * @fileoverview Central schema index — re-exports all table definitions
 * and defines remaining financial entity tables.
 *
 * This module serves as the single import point for the entire database schema.
 * All Drizzle table definitions, types, and relations are accessible from here.
 *
 * @example
 * ```ts
 * import { users, transactions, budgets } from '@/db/schema';
 * ```
 *
 * @module db/schema
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/* ═══════════════════════════════════════════════════════════════
   RE-EXPORTS — Core tables defined in their own modules
   ═══════════════════════════════════════════════════════════════ */

export { users, type User, type NewUser } from './users';
export {
  transactions,
  type Transaction,
  type NewTransaction,
} from './transactions';
export {
  auditLogs,
  type AuditLog,
  type NewAuditLog,
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditAction,
  type AuditEntityType,
} from './audit-logs';
export {
  userSessions,
  type UserSession,
  type NewUserSession,
  userPasskeys,
  type UserPasskey,
  type NewUserPasskey,
  oauthAccounts,
  type OAuthAccount,
  type NewOAuthAccount,
} from './sessions';


/* ═══════════════════════════════════════════════════════════════
   BILL SPLITS / TOUR GROUPS
   ═══════════════════════════════════════════════════════════════ */

export {
  tourGroups,
  type TourGroup,
  type NewTourGroup,
  tourParticipants,
  type TourParticipant,
  type NewTourParticipant,
} from './bill-splits';

/* ═══════════════════════════════════════════════════════════════
   CHAT MESSAGES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Chat messages table — stores conversation history between users and the AI.
 *
 * @remarks
 * - Messages are grouped by `session_id` for conversation threading.
 * - `role` follows the OpenAI convention: 'user', 'assistant', 'system'.
 * - `mode` distinguishes between conversational ('chat') and direct-entry ('silent').
 *
 * @complexity
 * - Query by user + session: O(log n) via composite index.
 */
export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Message author role: 'user', 'assistant', or 'system'. */
    role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),

    /** Message content (markdown-compatible). */
    content: text('content').notNull(),

    /** Interaction mode: 'chat' for conversational, 'silent' for storage-only. */
    mode: text('mode', { enum: ['chat', 'silent'] }).default('chat'),

    /** Conversation session identifier for grouping related messages. */
    sessionId: text('session_id'),

    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_chat_messages_user').on(table.userId),
    index('idx_chat_messages_session').on(table.userId, table.sessionId),
  ]
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   BUDGETS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Budgets table — monthly spending limits per category.
 *
 * @remarks
 * - The (user_id, category, month, year) combination is unique.
 * - `monthly_limit` is stored in the user's preferred currency.
 * - Budget alerts are triggered when spending exceeds threshold percentages.
 *
 * @complexity
 * - Lookup by user + month + year: O(log n) via composite index.
 */
export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Spending category this budget applies to. */
    category: text('category').notNull(),

    /** Maximum allowed spending for this category in the given month. */
    monthlyLimit: real('monthly_limit').notNull(),

    /** Month number (1–12). */
    month: integer('month').notNull(),

    /** Four-digit year (e.g., 2026). */
    year: integer('year').notNull(),

    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_budgets_user').on(table.userId, table.month, table.year),
  ]
);

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   NET WORTH
   ═══════════════════════════════════════════════════════════════ */

/**
 * Net worth table — historical snapshots of total net worth.
 *
 * @security
 * - `amount` is stored as REAL for trending queries.
 * - `encrypted_amount` provides an encrypted copy for data-at-rest compliance.
 */
export const netWorth = sqliteTable('net_worth', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** Net worth value in the user's preferred currency. */
  amount: real('amount').notNull(),

  /** AES-256-GCM encrypted amount. NULL for legacy records. */
  encryptedAmount: text('encrypted_amount'),

  /** Optional note describing the net worth entry. */
  note: text('note').default(''),

  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type NetWorth = typeof netWorth.$inferSelect;
export type NewNetWorth = typeof netWorth.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Notifications table — user-facing alerts and messages.
 *
 * @remarks
 * - `type` categorizes the notification (info, warning, success, error).
 * - `read` tracks whether the user has dismissed the notification.
 */
export const notifications = sqliteTable(
  'notifications',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Notification severity/type. */
    type: text('type').notNull().default('info'),

    /** Short title displayed in the notification list. */
    title: text('title').notNull(),

    /** Detailed message body. */
    message: text('message').notNull(),

    /** Whether the user has read/dismissed this notification. 0 = unread. */
    read: integer('read').default(0),

    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_notifications_user').on(table.userId, table.read),
  ]
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   SAVINGS GOALS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Savings goals table — target-based savings tracking.
 *
 * @security
 * - `target_amount` and `saved_amount` have encrypted counterparts
 *   for data-at-rest compliance.
 */
export const savingsGoals = sqliteTable(
  'savings_goals',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Human-readable goal name (e.g., "Emergency Fund", "Vacation"). */
    name: text('name').notNull(),

    /** Target amount to save. */
    targetAmount: real('target_amount').notNull(),

    /** Currently saved amount toward this goal. */
    savedAmount: real('saved_amount').notNull().default(0),

    /** Encrypted target amount. */
    encryptedTargetAmount: text('encrypted_target_amount'),

    /** Encrypted saved amount. */
    encryptedSavedAmount: text('encrypted_saved_amount'),

    /** Optional deadline date (YYYY-MM-DD). */
    deadline: text('deadline'),

    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_savings_goals_user').on(table.userId),
  ]
);

export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   RECURRING TRANSACTIONS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Recurring transactions table — scheduled repeating income/expenses.
 *
 * @remarks
 * - `frequency` determines the schedule: weekly, monthly, or yearly.
 * - `next_date` is updated after each automatic execution.
 * - `active` allows users to pause recurring entries without deleting them.
 */
export const recurringTransactions = sqliteTable(
  'recurring_transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Display name for the recurring entry. */
    name: text('name').notNull(),

    /** Type: 'expense' or 'earning'. */
    type: text('type', { enum: ['expense', 'earning'] }).notNull(),

    /** Amount per occurrence. */
    amount: real('amount').notNull(),

    /** Spending/income category. */
    category: text('category').notNull().default('Other'),

    /** Recurrence frequency. */
    frequency: text('frequency', { enum: ['weekly', 'monthly', 'yearly'] })
      .notNull()
      .default('monthly'),

    /** Date of the next scheduled occurrence (YYYY-MM-DD). */
    nextDate: text('next_date').notNull().default(sql`(date('now'))`),

    /** Whether this recurring entry is active. 1 = active, 0 = paused. */
    active: integer('active').default(1),

    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_recurring_user').on(table.userId),
  ]
);

export type RecurringTransaction = typeof recurringTransactions.$inferSelect;
export type NewRecurringTransaction = typeof recurringTransactions.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   CUSTOM CATEGORIES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Custom categories table — user-defined spending/income categories.
 *
 * @remarks
 * - Standard categories (Food, Transport, etc.) are not stored here.
 * - The (user_id, name, type) combination is unique.
 */
export const customCategories = sqliteTable(
  'custom_categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Category display name. */
    name: text('name').notNull(),

    /** Whether this category applies to expenses or earnings. */
    type: text('type', { enum: ['expense', 'earning'] }).notNull(),

    /** Material Symbols icon name (e.g., 'restaurant', 'fitness_center'). */
    icon: text('icon').default('category'),

    /** Category color identifier for UI rendering. */
    color: text('color').default('gray'),

    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_custom_categories_user').on(table.userId),
  ]
);

export type CustomCategory = typeof customCategories.$inferSelect;
export type NewCustomCategory = typeof customCategories.$inferInsert;
