/**
 * @fileoverview Drizzle ORM schema definition for the `users` table.
 *
 * Defines the primary user entity with authentication fields, profile settings,
 * and 2FA configuration. This table is the root of most foreign key relationships
 * in the system.
 *
 * @security Password hashes are stored using bcrypt with cost factor 12.
 *           TOTP secrets are encrypted at rest via the crypto module.
 * @module db/schema/users
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users table — core identity store for all authenticated users.
 *
 * @remarks
 * - `email` has a UNIQUE constraint enforced at the DB level.
 * - `totp_secret` is encrypted with AES-256-GCM before storage.
 * - `password_hash` uses bcrypt with a cost factor of 12.
 * - Default currency is USD; validated against the ALLOWED_CURRENCIES set.
 *
 * @example
 * ```ts
 * const user = await db.select().from(users).where(eq(users.email, 'alice@example.com'));
 * ```
 */
export const users = sqliteTable('users', {
  /** Auto-incrementing primary key. */
  id: integer('id').primaryKey({ autoIncrement: true }),

  /** Display name (1–100 characters, sanitized on input). */
  name: text('name').notNull(),

  /**
   * Email address — unique, lowercased, and trimmed on registration.
   * Used as the primary login identifier.
   */
  email: text('email').notNull().unique(),

  /**
   * Bcrypt hash of the user's password.
   * Cost factor: 12. Never exposed via API responses.
   */
  passwordHash: text('password_hash').notNull(),

  /**
   * ISO 4217 currency code for display formatting.
   * @default 'BDT'
   */
  currency: text('currency').default('BDT'),

  /** Whether budget-related notifications are enabled. 1 = enabled, 0 = disabled. */
  notifyBudget: integer('notify_budget').default(1),

  /** Whether overspend alerts are enabled. 1 = enabled, 0 = disabled. */
  notifyOverspend: integer('notify_overspend').default(1),

  /**
   * Base32-encoded TOTP secret, encrypted with AES-256-GCM.
   * NULL if 2FA has not been set up.
   */
  totpSecret: text('totp_secret'),

  /**
   * Whether TOTP-based two-factor authentication is active.
   * 0 = disabled (default), 1 = enabled.
   */
  totpEnabled: integer('totp_enabled').default(0),

  /**
   * JSON array of one-time backup codes for 2FA recovery.
   * Each code is hashed with bcrypt before storage.
   * NULL if 2FA has not been set up.
   */
  backupCodes: text('backup_codes'),

  /**
   * Timestamp of the last password change.
   * Used for session invalidation on password reset.
   */
  passwordUpdatedAt: text('password_updated_at'),

  /** JSON-stringified array representing the desktop dashboard layout widget order and visibility. */
  dashboardLayout: text('dashboard_layout'),

  /** JSON-stringified array representing the mobile dashboard layout widget order and visibility. */
  mobileWidgetOrder: text('mobile_widget_order'),

  /** Account creation timestamp (UTC ISO-8601). */
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

/** TypeScript type inferred from a SELECT on the users table. */
export type User = typeof users.$inferSelect;

/** TypeScript type inferred for INSERT operations on the users table. */
export type NewUser = typeof users.$inferInsert;
