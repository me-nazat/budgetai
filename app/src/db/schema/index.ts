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
  tours,
  type Tour,
  type NewTour,
  tourGroups,
  type TourGroup,
  type NewTourGroup,
  tourParticipants,
  type TourParticipant,
  type NewTourParticipant,
  tourItineraryItems,
  type TourItineraryItem,
  type NewTourItineraryItem,
  tourChecklistCategories,
  type TourChecklistCategory,
  type NewTourChecklistCategory,
  tourChecklistItems,
  type TourChecklistItem,
  type NewTourChecklistItem,
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

/* ═══════════════════════════════════════════════════════════════
   DEBTS — Debt Payoff Planner Storage
   ═══════════════════════════════════════════════════════════════ */

export const debts = sqliteTable(
  'debts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    debtType: text('debt_type', {
      enum: ['credit_card', 'personal_loan', 'student_loan', 'bnpl', 'other'],
    }).notNull(),
    balance: real('balance').notNull(),
    initialBalance: real('initial_balance').notNull(),
    encryptedBalance: text('encrypted_balance'),
    interestRateApr: real('interest_rate_apr').notNull(),
    minimumPayment: real('minimum_payment').notNull(),
    dueDayOfMonth: integer('due_day_of_month'),
    linkedRecurringTransactionId: integer('linked_recurring_transaction_id')
      .references(() => recurringTransactions.id, { onDelete: 'set null' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_debts_user').on(table.userId),
  ]
);

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   AUTOMATION RULES — Custom category categorization triggers
   ═══════════════════════════════════════════════════════════════ */

export const automationRules = sqliteTable(
  'automation_rules',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    triggerType: text('trigger_type', { enum: ['description_contains'] }).notNull(),
    triggerValue: text('trigger_value').notNull(),
    actionType: text('action_type', { enum: ['set_category'] }).notNull(),
    actionValue: text('action_value').notNull(),
    active: integer('active').notNull().default(1),
    /** Priority for rule execution order (lower = first). */
    priority: integer('priority').notNull().default(0),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_automation_rules_user').on(table.userId),
  ]
);

export type AutomationRule = typeof automationRules.$inferSelect;
export type NewAutomationRule = typeof automationRules.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   PUSH SUBSCRIPTIONS — Web Push notification subscriptions (Module 2)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Stores Web Push API subscription data per user/device.
 *
 * @security
 * - `auth` and `p256dh` are cryptographic keys — treat as sensitive.
 * - Subscriptions are automatically cleaned up when they expire or fail.
 */
export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The push service endpoint URL. */
    endpoint: text('endpoint').notNull(),

    /** The p256dh public key for encryption. */
    p256dh: text('p256dh').notNull(),

    /** The auth secret for encryption. */
    auth: text('auth').notNull(),

    /** Push notification categories the user has enabled (JSON array). */
    enabledCategories: text('enabled_categories').default('["budget","subscriptions","goals","security"]'),

    /** Quiet hours start (HH:mm format, null = no quiet hours). */
    quietHoursStart: text('quiet_hours_start'),

    /** Quiet hours end (HH:mm format). */
    quietHoursEnd: text('quiet_hours_end'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_push_subs_user').on(table.userId),
    index('idx_push_subs_endpoint').on(table.endpoint),
  ]
);

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   INVESTMENT HOLDINGS — Portfolio Tracker (Module 3)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Investment holdings table — tracks user's investment positions.
 *
 * @remarks
 * - `ticker` is the stock/crypto symbol (e.g., AAPL, BTC).
 * - `avg_cost_basis` is the average purchase price per unit.
 * - Live prices are fetched from external APIs and cached in memory.
 */
export const investmentHoldings = sqliteTable(
  'investment_holdings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Asset type classification. */
    assetType: text('asset_type', {
      enum: ['stock', 'etf', 'crypto', 'bond', 'mutual_fund', 'other'],
    }).notNull(),

    /** Ticker/symbol (e.g., AAPL, BTC-USD). */
    ticker: text('ticker').notNull(),

    /** Human-readable name (e.g., "Apple Inc."). */
    name: text('name').notNull(),

    /** Number of units held. */
    quantity: real('quantity').notNull(),

    /** Average cost basis per unit in user's currency. */
    avgCostBasis: real('avg_cost_basis').notNull(),

    /** Currency of the holding (e.g., USD). */
    currency: text('currency').notNull().default('USD'),

    /** Optional notes. */
    notes: text('notes'),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_investments_user').on(table.userId),
    index('idx_investments_ticker').on(table.userId, table.ticker),
  ]
);

export type InvestmentHolding = typeof investmentHoldings.$inferSelect;
export type NewInvestmentHolding = typeof investmentHoldings.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   AUTOMATION AUDIT LOG — Rule execution history (Module 6)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Tracks every time an automation rule fires, enabling undo.
 */
export const automationAuditLog = sqliteTable(
  'automation_audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** The rule that fired. */
    ruleId: integer('rule_id')
      .references(() => automationRules.id, { onDelete: 'set null' }),

    /** The transaction that was affected. */
    transactionId: integer('transaction_id'),

    /** What action was performed. */
    actionPerformed: text('action_performed').notNull(),

    /** Previous value before the rule changed it. */
    previousValue: text('previous_value'),

    /** New value after the rule changed it. */
    newValue: text('new_value'),

    /** Whether this action has been undone. */
    undone: integer('undone').notNull().default(0),

    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_auto_audit_user').on(table.userId, table.createdAt),
  ]
);

export type AutomationAuditLogEntry = typeof automationAuditLog.$inferSelect;
export type NewAutomationAuditLogEntry = typeof automationAuditLog.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD LAYOUTS — Custom widget ordering (Module 7)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Stores per-user dashboard widget layout preferences.
 */
export const dashboardLayouts = sqliteTable('dashboard_layouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /** JSON array of widget IDs in display order. */
  widgetOrder: text('widget_order').notNull().default('[]'),

  /** The pinned "hero" widget ID (displayed prominently at top). */
  heroWidget: text('hero_widget'),

  /** JSON object of widget visibility: { [widgetId]: boolean }. */
  hiddenWidgets: text('hidden_widgets').default('{}'),

  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type DashboardLayout = typeof dashboardLayouts.$inferSelect;
export type NewDashboardLayout = typeof dashboardLayouts.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   HOUSEHOLDS — Shared family/household spaces (Module 9)
   ═══════════════════════════════════════════════════════════════ */

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
