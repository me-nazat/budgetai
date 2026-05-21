/**
 * @fileoverview Immutable audit logging service for compliance and forensics.
 *
 * Records every CRUD operation, authentication event, and sensitive data
 * access in an append-only `audit_logs` table. This service is the single
 * source of truth for "who did what, when, and from where."
 *
 * ## Design Principles
 * - **Append-only:** No UPDATE or DELETE operations. Ever.
 * - **Non-blocking:** Logging is fire-and-forget to avoid impacting request latency.
 * - **Redacted:** Sensitive fields (amounts, passwords) are replaced with '[ENCRYPTED]'.
 * - **Contextual:** Captures IP, User-Agent, and request metadata.
 *
 * @security
 * - Audit logs are immutable — the service has no update/delete methods.
 * - Sensitive values are redacted before storage.
 * - Failed audit writes are logged to stderr but never block the request.
 *
 * @module services/audit.service
 */

import { db } from '@/db/client';
import { auditLogs, type AuditAction, type AuditEntityType } from '@/db/schema';

/**
 * Fields that are always redacted in audit log snapshots.
 * Values are replaced with '[ENCRYPTED]' or '[REDACTED]'.
 */
const REDACTED_FIELDS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'totpSecret',
  'totp_secret',
  'backupCodes',
  'backup_codes',
  'encryptedAmount',
  'encrypted_amount',
  'encryptedDescription',
  'encrypted_description',
  'encryptedAccessToken',
  'encrypted_access_token',
  'encryptedRefreshToken',
  'encrypted_refresh_token',
  'encryptedTargetAmount',
  'encrypted_target_amount',
  'encryptedSavedAmount',
  'encrypted_saved_amount',
  'tokenHash',
  'token_hash',
]);

/**
 * Parameters for creating an audit log entry.
 */
export interface AuditLogParams {
  /** The user who performed the action. NULL for system actions. */
  userId: number | null;
  /** The type of operation. */
  action: AuditAction;
  /** The type of entity affected. */
  entityType: AuditEntityType;
  /** The ID of the affected entity. */
  entityId?: string | number;
  /** Entity state BEFORE the operation (null for CREATE). */
  oldValue?: Record<string, unknown> | null;
  /** Entity state AFTER the operation (null for DELETE). */
  newValue?: Record<string, unknown> | null;
  /** Client IP address. */
  ip?: string;
  /** Client User-Agent string. */
  userAgent?: string;
  /** Additional metadata (request ID, duration, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Redacts sensitive fields from an object before audit storage.
 *
 * Recursively traverses the object and replaces values of sensitive
 * fields with '[REDACTED]'. Does not modify the original object.
 *
 * @param obj - The object to redact.
 * @returns A new object with sensitive fields replaced.
 *
 * @complexity O(n) where n is the total number of keys across all levels.
 */
function redactSensitiveFields(
  obj: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!obj) return null;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (REDACTED_FIELDS.has(key)) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Truncates a string to a maximum length.
 *
 * @param value - The string to truncate.
 * @param maxLength - Maximum allowed length.
 * @returns The truncated string, or the original if within limits.
 */
function truncate(value: string | undefined | null, maxLength: number): string | undefined {
  if (!value) return undefined;
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/**
 * AuditService — singleton service for recording audit events.
 *
 * All methods are static and stateless. The service writes directly
 * to the `audit_logs` table via the Drizzle ORM client.
 *
 * @example
 * ```ts
 * await AuditService.logAction({
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
export class AuditService {
  /**
   * Records an audit log entry.
   *
   * This method is **non-blocking**: it does not await the database write.
   * Errors are caught and logged to stderr to avoid impacting request latency.
   *
   * @param params - The audit log parameters.
   *
   * @complexity O(n) for redaction, O(1) for database insert.
   *
   * @security
   * - Sensitive fields are redacted before storage.
   * - User-Agent is truncated to 500 characters.
   * - Failed writes are logged but never throw.
   */
  static logAction(params: AuditLogParams): void {
    // Fire-and-forget — errors are caught internally
    AuditService._writeLog(params).catch((error) => {
      console.error('[audit] Failed to write audit log:', error);
    });
  }

  /**
   * Records an audit log entry and waits for the write to complete.
   *
   * Use this variant when you need to guarantee the audit log is
   * persisted before continuing (e.g., login events, data exports).
   *
   * @param params - The audit log parameters.
   * @returns Promise that resolves when the log is written.
   */
  static async logActionSync(params: AuditLogParams): Promise<void> {
    await AuditService._writeLog(params);
  }

  /**
   * Internal method that performs the actual database write.
   *
   * @param params - The audit log parameters.
   * @internal
   */
  private static async _writeLog(params: AuditLogParams): Promise<void> {
    const redactedOld = redactSensitiveFields(params.oldValue);
    const redactedNew = redactSensitiveFields(params.newValue);

    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId != null ? String(params.entityId) : undefined,
      oldValue: redactedOld ? JSON.stringify(redactedOld) : undefined,
      newValue: redactedNew ? JSON.stringify(redactedNew) : undefined,
      ipAddress: params.ip || 'unknown',
      userAgent: truncate(params.userAgent, 500),
      metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
    });
  }

  /**
   * Logs a successful authentication event.
   *
   * @param userId - The authenticated user's ID.
   * @param ip - Client IP address.
   * @param userAgent - Client User-Agent string.
   */
  static logLogin(userId: number, ip?: string, userAgent?: string): void {
    AuditService.logAction({
      userId,
      action: 'LOGIN',
      entityType: 'session',
      ip,
      userAgent,
    });
  }

  /**
   * Logs a failed authentication attempt.
   *
   * @param email - The email address used in the failed attempt.
   * @param ip - Client IP address.
   * @param userAgent - Client User-Agent string.
   * @param reason - Reason for failure (e.g., 'invalid_password', 'account_locked').
   */
  static logLoginFailed(
    email: string,
    ip?: string,
    userAgent?: string,
    reason?: string
  ): void {
    AuditService.logAction({
      userId: null,
      action: 'LOGIN_FAILED',
      entityType: 'session',
      metadata: { email: email.slice(0, 3) + '***', reason },
      ip,
      userAgent,
    });
  }

  /**
   * Logs a user logout event.
   *
   * @param userId - The user's ID.
   * @param ip - Client IP address.
   */
  static logLogout(userId: number, ip?: string): void {
    AuditService.logAction({
      userId,
      action: 'LOGOUT',
      entityType: 'session',
      ip,
    });
  }

  /**
   * Logs a data creation event with the new entity state.
   *
   * @param userId - The user's ID.
   * @param entityType - The type of entity created.
   * @param entityId - The new entity's ID.
   * @param newValue - The entity state after creation.
   * @param ip - Client IP address.
   * @param userAgent - Client User-Agent string.
   */
  static logCreate(
    userId: number,
    entityType: AuditEntityType,
    entityId: string | number,
    newValue: Record<string, unknown>,
    ip?: string,
    userAgent?: string
  ): void {
    AuditService.logAction({
      userId,
      action: 'CREATE',
      entityType,
      entityId,
      newValue,
      ip,
      userAgent,
    });
  }

  /**
   * Logs a data update event with before/after snapshots.
   *
   * @param userId - The user's ID.
   * @param entityType - The type of entity updated.
   * @param entityId - The entity's ID.
   * @param oldValue - Entity state before the update.
   * @param newValue - Entity state after the update.
   * @param ip - Client IP address.
   * @param userAgent - Client User-Agent string.
   */
  static logUpdate(
    userId: number,
    entityType: AuditEntityType,
    entityId: string | number,
    oldValue: Record<string, unknown>,
    newValue: Record<string, unknown>,
    ip?: string,
    userAgent?: string
  ): void {
    AuditService.logAction({
      userId,
      action: 'UPDATE',
      entityType,
      entityId,
      oldValue,
      newValue,
      ip,
      userAgent,
    });
  }

  /**
   * Logs a data deletion event with the deleted entity state.
   *
   * @param userId - The user's ID.
   * @param entityType - The type of entity deleted.
   * @param entityId - The entity's ID.
   * @param oldValue - Entity state before deletion.
   * @param ip - Client IP address.
   * @param userAgent - Client User-Agent string.
   */
  static logDelete(
    userId: number,
    entityType: AuditEntityType,
    entityId: string | number,
    oldValue: Record<string, unknown>,
    ip?: string,
    userAgent?: string
  ): void {
    AuditService.logAction({
      userId,
      action: 'DELETE',
      entityType,
      entityId,
      oldValue,
      ip,
      userAgent,
    });
  }
}
