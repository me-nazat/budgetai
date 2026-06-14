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

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { tourGroups, tourParticipants } from './bill-splits';


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
   * Transaction type: 'expense' or 'earning'.
   * Enforced by CHECK constraint at the database level.
   */
  type: text('type', { enum: ['expense', 'earning'] }).notNull(),

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
  tourId: integer('tour_id').references(() => tourGroups.id, { onDelete: 'cascade' }),

  /** Reference to the participant who paid for this shared expense */
  paidBy: integer('paid_by').references(() => tourParticipants.id, { onDelete: 'set null' }),

  /** Split type for shared expenses */
  splitType: text('split_type', { enum: ['equal', 'percentage', 'exact'] }).default('equal'),

  /** Record creation timestamp (UTC ISO-8601). */
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

/** TypeScript type inferred from a SELECT on the transactions table. */
export type Transaction = typeof transactions.$inferSelect;

/** TypeScript type inferred for INSERT operations. */
export type NewTransaction = typeof transactions.$inferInsert;
