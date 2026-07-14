/**
 * @fileoverview Drizzle ORM schema for the `audit_logs` table.
 *
 * Provides an immutable, append-only audit trail for every CRUD operation
 * performed on financial data. This table must NEVER support UPDATE or DELETE
 * operations — it is the single source of truth for compliance and forensics.
 *
 * @security
 * - Logs are append-only (no UPDATE/DELETE at the service layer).
 * - Old/new values are JSON-serialized snapshots of the entity state.
 * - IP addresses and User-Agent strings are captured for forensic analysis.
 * - Indexed on (user_id, created_at) for efficient user-scoped queries.
 *
 * @module db/schema/audit-logs
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/**
 * Valid audit action types.
 * Maps to standard CRUD operations plus authentication events.
 */
export const AUDIT_ACTIONS = [
  'CREATE',
  'READ',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'LOGOUT',
  'LOGIN_FAILED',
  'PASSWORD_CHANGE',
  '2FA_ENABLE',
  '2FA_DISABLE',
  '2FA_VERIFY',
  'PASSKEY_REGISTER',
  'PASSKEY_AUTHENTICATE',
  'SESSION_REVOKE',
  'EXPORT_DATA',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Entity types that can be audited.
 */
export const AUDIT_ENTITY_TYPES = [
  'transaction',
  'budget',
  'networth',
  'goal',
  'notification',
  'recurring',
  'category',
  'chat_message',
  'user',
  'session',
  'debt',
  'automation_rule',
  'household',
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/**
 * Audit logs table — immutable record of all data mutations and auth events.
 *
 * @remarks
 * - This table grows monotonically and should be periodically archived
 *   to cold storage in production.
 * - `old_value` and `new_value` store JSON snapshots of the affected entity
 *   before and after the operation. For CREATE, `old_value` is NULL.
 *   For DELETE, `new_value` is NULL.
 * - The service layer MUST NOT expose UPDATE or DELETE operations on this table.
 *
 * @example
 * ```ts
 * await auditService.logAction({
 *   userId: 42,
 *   action: 'CREATE',
 *   entityType: 'transaction',
 *   entityId: '123',
 *   newValue: { amount: 50, category: 'Food' },
 *   ip: '192.168.1.1',
 *   userAgent: 'Mozilla/5.0...',
 * });
 * ```
 */
export const auditLogs = sqliteTable(
  'audit_logs',
  {
    /** Auto-incrementing primary key. */
    id: integer('id').primaryKey({ autoIncrement: true }),

    /**
     * The user who performed the action.
     * NULL for system-initiated actions (e.g., scheduled tasks).
     */
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),

    /**
     * The type of operation performed.
     * @see AUDIT_ACTIONS for valid values.
     */
    action: text('action').notNull(),

    /**
     * The type of entity affected by the operation.
     * @see AUDIT_ENTITY_TYPES for valid values.
     */
    entityType: text('entity_type').notNull(),

    /**
     * The unique identifier of the affected entity.
     * Stored as TEXT to accommodate different ID types.
     */
    entityId: text('entity_id'),

    /**
     * JSON snapshot of the entity state BEFORE the operation.
     * NULL for CREATE actions.
     * Sensitive fields are redacted (replaced with '[ENCRYPTED]').
     */
    oldValue: text('old_value'),

    /**
     * JSON snapshot of the entity state AFTER the operation.
     * NULL for DELETE actions.
     * Sensitive fields are redacted (replaced with '[ENCRYPTED]').
     */
    newValue: text('new_value'),

    /**
     * Client IP address from X-Forwarded-For or X-Real-IP headers.
     * Falls back to 'unknown' if not determinable.
     */
    ipAddress: text('ip_address'),

    /**
     * Client User-Agent string for device/browser identification.
     * Truncated to 500 characters.
     */
    userAgent: text('user_agent'),

    /**
     * Additional metadata as JSON.
     * May include: request_id, session_id, duration_ms, etc.
     */
    metadata: text('metadata'),

    /** Record creation timestamp (UTC ISO-8601). Immutable. */
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_audit_user_created').on(table.userId, table.createdAt),
    index('idx_audit_entity').on(table.entityType, table.entityId),
    index('idx_audit_action').on(table.action, table.createdAt),
  ]
);

/** TypeScript type inferred from a SELECT on the audit_logs table. */
export type AuditLog = typeof auditLogs.$inferSelect;

/** TypeScript type inferred for INSERT operations. */
export type NewAuditLog = typeof auditLogs.$inferInsert;
