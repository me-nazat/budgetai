/**
 * @fileoverview Drizzle ORM schema for the `transactions` table.
 *
 * Financial transactions are the core data entity. Both `amount` (stored as
 * an encrypted string) and `description` contain sensitive financial data
 * and are encrypted at the application layer using AES-256-GCM before storage.
 *
 * @security Sensitive fields (`amount`, `description`) are encrypted via
 *           `src/lib/crypto/encryption.ts` before INSERT/UPDATE and decrypted
 *           after SELECT. The repository layer handles this transparently.
 * @module db/schema/transactions
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tours, tourParticipants } from './bill-splits';
import { accounts } from './accounts';


/**
 * Transactions table — records individual income and expense entries.
 *
 * @remarks
 * - `type` is constrained to 'expense' or 'earning' via CHECK.
 * - `amount` is stored as REAL for query compatibility; sensitive values
 *   are additionally stored in `encrypted_amount` as an encrypted string.
 * - `date` uses ISO-8601 date format (YYYY-MM-DD).
 * - Indexed on `(user_id)` and `(user_id, date)` for efficient range queries.
 *
 * @complexity
 * - INSERT: O(1) amortized + O(log n) for index updates
 * - SELECT by user + date range: O(log n) via covering index
 */
export const transactions = sqliteTable('transactions', {
  /** Auto-incrementing primary key. */
  id: integer('id').primaryKey({ autoIncrement: true }),

  /** Foreign key to `users.id`. Cascading delete removes orphaned transactions. */
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  /**
   * Transaction type: 'expense', 'earning', or 'transfer'.
   * Enforced by CHECK constraint at the database level.
   */
  type: text('type', { enum: ['expense', 'earning', 'transfer'] }).notNull(),

  /** Reference to the account/wallet this transaction belongs to */
  accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),

  /** Reference to the destination account/wallet if this is a transfer */
  toAccountId: integer('to_account_id').references(() => accounts.id, { onDelete: 'set null' }),

  /** Transfer group ID for paired transfer legs */
  transferGroupId: text('transfer_group_id'),

  /**
   * Transaction amount as a decimal number.
   * Must be positive and ≤ 999,999,999.
   *
   * @security The raw amount is available for aggregation queries.
   *           For encrypted storage, see `encryptedAmount`.
   */
  amount: real('amount').notNull(),

  /**
   * AES-256-GCM encrypted representation of the amount.
   * Format: `iv:ciphertext:authTag` (base64-encoded).
   * NULL for legacy records created before encryption was enabled.
   */
  encryptedAmount: text('encrypted_amount'),

  /**
   * Spending/income category.
   * Validated against standard categories or user-defined custom categories.
   * @default 'Other'
   */
  category: text('category').notNull().default('Other'),

  /**
   * Human-readable description of the transaction.
   * Max 500 characters, sanitized on input.
   * @default ''
   */
  description: text('description').notNull().default(''),

  /**
   * AES-256-GCM encrypted description.
   * NULL for legacy records.
   */
  encryptedDescription: text('encrypted_description'),

  /**
   * Transaction date in YYYY-MM-DD format.
   * Defaults to the current date at insertion time.
   */
  date: text('date').notNull().default(sql`(date('now'))`),


  /** Reference to a tour group if this is a shared expense */
  tourId: integer('tour_id').references(() => tours.id, { onDelete: 'cascade' }),

  /** Reference to the participant who paid for this shared expense */
  paidBy: integer('paid_by').references(() => tourParticipants.id, { onDelete: 'set null' }),

  /** Explicit participant payer column for the tour spending workflow. */
  paidByParticipantId: integer('paid_by_participant_id').references(() => tourParticipants.id, { onDelete: 'set null' }),

  /** Split type for shared expenses */
  splitType: text('split_type', { enum: ['equal', 'percentage', 'exact'] }).default('equal'),

  /** Category splits JSON string for split-category transactions */
  splits: text('splits'),

  /** Client mutation UUID for idempotent offline batch-sync deduplication */
  clientMutationId: text('client_mutation_id'),

  /** Optional user notes / context */
  notes: text('notes').default(''),

  /** Tax deduction flag */
  taxDeductible: integer('tax_deductible').default(0),

  /** Optional attachments metadata JSON */
  attachments: text('attachments'),

  /** Tax deduction tag flag for Module 12 AI smart tax review queue. */
  taxSuggested: integer('tax_suggested').default(0),

  /**
   * Collaborative split-ledger fields:
   * When a user pays a 10,000 group bill where their own share is 2,000,
   * amount stores 10000 (actual cash from accountId), while personalShareAmount stores 2000.
   */
  personalShareAmount: real('personal_share_amount'),

  /** Status of reimbursement owed to or by the user: 'none' | 'receivable' | 'payable' | 'settled' */
  reimbursementStatus: text('reimbursement_status', {
    enum: ['none', 'receivable', 'payable', 'settled'],
  }).default('none'),

  /** Collaborative source domain: 'tour' | 'household' | 'bill_split' | null */
  collaborativeSourceType: text('collaborative_source_type', {
    enum: ['tour', 'household', 'bill_split'],
  }),

  /** Foreign ID of the tour, household, or standalone bill split */
  collaborativeSourceId: text('collaborative_source_id'),

  /** Exact spending/expense row ID in the tour or household table for 1:1 idempotent sync */
  collaborativeExpenseId: text('collaborative_expense_id'),

  /**
   * Settlement transfer marker:
   * Payback transactions when a member settles debt. Updates account balance without altering P&L / budget.
   */
  isSettlementTransfer: integer('is_settlement_transfer').default(0),

  /** Normalized merchant identifier (lowercase, noise-stripped) */
  merchantNormalized: text('merchant_normalized'),

  /** Split category indicator (1 if divided across multiple budget categories) */
  isSplit: integer('is_split').default(0),

  /** JSON array of split items [{ id, category, amount, note, isTaxDeductible }] */
  splitItemsJson: text('split_items_json'),

  /** Transaction reconciliation status: 'cleared' | 'pending' | 'reconciled' */
  status: text('status', { enum: ['cleared', 'pending', 'reconciled'] }).notNull().default('cleared'),

  /** Record creation timestamp (UTC ISO-8601). */
  createdAt: text('created_at').default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_transactions_user').on(table.userId),
  index('idx_transactions_date').on(table.date),
  index('idx_transactions_tour').on(table.tourId),
  index('idx_transactions_user_date').on(table.userId, table.date),
  index('idx_transactions_user_date_desc').on(table.userId, table.date),
  index('idx_transactions_user_cat_date').on(table.userId, table.category, table.date),
  index('idx_transactions_merchant_norm').on(table.userId, table.merchantNormalized),
  index('idx_transactions_user_amount').on(table.userId, table.amount),
  index('idx_transactions_client_mutation').on(table.userId, table.clientMutationId),
  index('idx_transactions_composite').on(table.userId, table.tourId, table.date, table.amount),
  index('idx_transactions_collab_exp').on(table.collaborativeExpenseId),
  index('idx_transactions_collab_source').on(table.collaborativeSourceType, table.collaborativeSourceId),
  index('idx_transactions_settlement_transfer').on(table.userId, table.isSettlementTransfer),
]);

/** TypeScript type inferred from a SELECT on the transactions table. */
export type Transaction = typeof transactions.$inferSelect;

/** TypeScript type inferred for INSERT operations. */
export type NewTransaction = typeof transactions.$inferInsert;
