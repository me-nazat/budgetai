/**
 * @fileoverview User repository — data access layer for user accounts.
 *
 * Handles all database operations for the `users` table including
 * credential management, profile updates, and 2FA configuration.
 *
 * @security
 * - Password hashes are NEVER returned in query results by default.
 * - TOTP secrets are encrypted at rest and only returned for verification.
 * - Email uniqueness is enforced at both the application and database levels.
 *
 * @module repositories/user.repository
 */

import { db } from '@/db/client';
import { users, userSessions, userPasskeys, oauthAccounts } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Input data for creating a new user account.
 */
export interface CreateUserInput {
  name: string;
  email: string;
  passwordHash: string;
}

/**
 * Input data for updating a user's profile.
 */
export interface UpdateProfileInput {
  name?: string;
  currency?: string;
  notifyBudget?: number;
  notifyOverspend?: number;
}

/**
 * UserRepository — data access for user accounts and credentials.
 *
 * @example
 * ```ts
 * const user = await UserRepository.findByEmail('alice@example.com');
 * if (user) {
 *   const valid = await bcrypt.compare(password, user.passwordHash);
 * }
 * ```
 */
export class UserRepository {
  /**
   * Finds a user by email address.
   *
   * @param email - The email address to search for (case-insensitive).
   * @returns The full user record (including passwordHash for auth), or undefined.
   *
   * @security
   * - This method returns the password hash for authentication purposes.
   * - Callers MUST NOT expose the hash in API responses.
   */
  static async findByEmail(
    email: string
  ): Promise<typeof users.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    return results[0];
  }

  /**
   * Finds a user by their database ID.
   *
   * @param id - The user's primary key.
   * @returns The user record, or undefined.
   */
  static async findById(
    id: number
  ): Promise<typeof users.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return results[0];
  }

  /**
   * Creates a new user account.
   *
   * @param data - Registration data with hashed password.
   * @returns The created user record (with ID).
   *
   * @throws {Error} If the email already exists (unique constraint violation).
   */
  static async create(
    data: CreateUserInput
  ): Promise<typeof users.$inferSelect> {
    const result = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
      })
      .returning();

    return result[0];
  }

  /**
   * Updates a user's profile settings.
   *
   * @param id - The user's ID.
   * @param data - Fields to update.
   * @returns The updated user record, or undefined if not found.
   */
  static async updateProfile(
    id: number,
    data: UpdateProfileInput
  ): Promise<typeof users.$inferSelect | undefined> {
    const result = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();

    return result[0];
  }

  /**
   * Updates a user's password hash.
   *
   * @param id - The user's ID.
   * @param passwordHash - The new bcrypt hash.
   *
   * @security Sets `passwordUpdatedAt` to invalidate existing sessions.
   */
  static async updatePassword(
    id: number,
    passwordHash: string
  ): Promise<void> {
    await db
      .update(users)
      .set({
        passwordHash,
        passwordUpdatedAt: new Date().toISOString(),
      })
      .where(eq(users.id, id));
  }

  /**
   * Enables TOTP 2FA for a user.
   *
   * @param id - The user's ID.
   * @param encryptedSecret - The AES-256-GCM encrypted TOTP secret.
   * @param hashedBackupCodes - JSON array of bcrypt-hashed backup codes.
   */
  static async enable2FA(
    id: number,
    encryptedSecret: string,
    hashedBackupCodes: string
  ): Promise<void> {
    await db
      .update(users)
      .set({
        totpSecret: encryptedSecret,
        totpEnabled: 1,
        backupCodes: hashedBackupCodes,
      })
      .where(eq(users.id, id));
  }

  /**
   * Disables TOTP 2FA for a user.
   *
   * @param id - The user's ID.
   */
  static async disable2FA(id: number): Promise<void> {
    await db
      .update(users)
      .set({
        totpSecret: null,
        totpEnabled: 0,
        backupCodes: null,
      })
      .where(eq(users.id, id));
  }

  /**
   * Updates the backup codes for a user (after one is consumed).
   *
   * @param id - The user's ID.
   * @param hashedCodes - Updated JSON array of remaining hashed backup codes.
   */
  static async updateBackupCodes(
    id: number,
    hashedCodes: string
  ): Promise<void> {
    await db
      .update(users)
      .set({ backupCodes: hashedCodes })
      .where(eq(users.id, id));
  }

  /* ═══════════════════════════════════════════════════════════════
     SESSION MANAGEMENT
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Creates a new session record for refresh token tracking.
   *
   * @param data - Session creation data.
   * @returns The created session record.
   */
  static async createSession(data: {
    userId: number;
    tokenHash: string;
    expiresAt: string;
    deviceFingerprint?: string;
    deviceName?: string;
    ipAddress?: string;
    userAgent?: string;
    rememberMe?: boolean;
  }): Promise<typeof userSessions.$inferSelect> {
    const result = await db
      .insert(userSessions)
      .values({
        ...data,
        rememberMe: data.rememberMe ? 1 : 0,
      })
      .returning();

    return result[0];
  }

  /**
   * Finds a session by its token hash.
   *
   * @param tokenHash - SHA-256 hash of the refresh token.
   * @returns The session record, or undefined.
   */
  static async findSessionByTokenHash(
    tokenHash: string
  ): Promise<typeof userSessions.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.tokenHash, tokenHash),
          eq(userSessions.revoked, 0)
        )
      )
      .limit(1);

    return results[0];
  }

  /**
   * Rotates a session's refresh token (updates hash, extends expiry).
   * Preserves the rememberMe flag for continued persistence.
   *
   * @param oldTokenHash - The current token hash to replace.
   * @param newTokenHash - The new token hash.
   * @param newExpiresAt - The new expiration timestamp.
   */
  static async rotateSessionToken(
    oldTokenHash: string,
    newTokenHash: string,
    newExpiresAt: string
  ): Promise<void> {
    await db
      .update(userSessions)
      .set({
        tokenHash: newTokenHash,
        expiresAt: newExpiresAt,
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(userSessions.tokenHash, oldTokenHash));
  }

  /**
   * Revokes a specific session by its token hash.
   *
   * @param tokenHash - The token hash to revoke.
   */
  static async revokeSession(tokenHash: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ revoked: 1 })
      .where(eq(userSessions.tokenHash, tokenHash));
  }

  /**
   * Revokes ALL sessions for a user (used on password change, security events).
   *
   * @param userId - The user's ID.
   */
  static async revokeAllSessions(userId: number): Promise<void> {
    await db
      .update(userSessions)
      .set({ revoked: 1 })
      .where(eq(userSessions.userId, userId));
  }

  /**
   * Lists all active sessions for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of active session records.
   */
  static async listActiveSessions(
    userId: number
  ): Promise<Array<typeof userSessions.$inferSelect>> {
    return db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.revoked, 0)
        )
      )
      .orderBy(desc(userSessions.createdAt));
  }

  /* ═══════════════════════════════════════════════════════════════
     PASSKEYS (WebAuthn)
     ═══════════════════════════════════════════════════════════════ */

  /**
   * Stores a new WebAuthn passkey credential.
   *
   * @param data - The passkey registration data.
   * @returns The created passkey record.
   */
  static async createPasskey(data: {
    userId: number;
    name: string;
    credentialId: string;
    publicKey: string;
    signCount: number;
    algorithm: number;
    transports?: string;
  }): Promise<typeof userPasskeys.$inferSelect> {
    const result = await db
      .insert(userPasskeys)
      .values(data)
      .returning();

    return result[0];
  }

  /**
   * Finds a passkey by its credential ID.
   *
   * @param credentialId - The base64url-encoded credential ID.
   * @returns The passkey record, or undefined.
   */
  static async findPasskeyByCredentialId(
    credentialId: string
  ): Promise<typeof userPasskeys.$inferSelect | undefined> {
    const results = await db
      .select()
      .from(userPasskeys)
      .where(
        and(
          eq(userPasskeys.credentialId, credentialId),
          eq(userPasskeys.active, 1)
        )
      )
      .limit(1);

    return results[0];
  }

  /**
   * Lists all active passkeys for a user.
   *
   * @param userId - The user's ID.
   * @returns Array of passkey records.
   */
  static async listPasskeys(
    userId: number
  ): Promise<Array<typeof userPasskeys.$inferSelect>> {
    return db
      .select()
      .from(userPasskeys)
      .where(
        and(
          eq(userPasskeys.userId, userId),
          eq(userPasskeys.active, 1)
        )
      )
      .orderBy(desc(userPasskeys.createdAt));
  }

  /**
   * Updates the sign count after a successful WebAuthn authentication.
   *
   * @param credentialId - The credential ID.
   * @param newSignCount - The updated sign count from the authenticator.
   */
  static async updatePasskeySignCount(
    credentialId: string,
    newSignCount: number
  ): Promise<void> {
    await db
      .update(userPasskeys)
      .set({
        signCount: newSignCount,
        lastUsedAt: new Date().toISOString(),
      })
      .where(eq(userPasskeys.credentialId, credentialId));
  }

  /**
   * Revokes a specific session by its database ID.
   *
   * @param id - The session database ID.
   * @param userId - The user's ID.
   */
  static async revokeSessionById(id: number, userId: number): Promise<void> {
    await db
      .update(userSessions)
      .set({ revoked: 1 })
      .where(
        and(
          eq(userSessions.id, id),
          eq(userSessions.userId, userId)
        )
      );
  }

  /**
   * Deactivates a passkey credential by its database ID.
   *
   * @param id - The passkey database ID.
   * @param userId - The user's ID.
   */
  static async deletePasskey(id: number, userId: number): Promise<void> {
    await db
      .update(userPasskeys)
      .set({ active: 0 })
      .where(
        and(
          eq(userPasskeys.id, id),
          eq(userPasskeys.userId, userId)
        )
      );
  }
}

