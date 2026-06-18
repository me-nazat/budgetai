/**
 * @fileoverview Drizzle ORM schemas for session management and authentication.
 *
 * Contains table definitions for:
 * - `user_sessions` — Refresh token tracking with device fingerprinting.
 * - `user_passkeys` — WebAuthn credential storage for passwordless login.
 * - `oauth_accounts` — Linked OAuth2 provider accounts (Google, GitHub, etc.).
 *
 * @security
 * - Refresh tokens are hashed (SHA-256) before storage — raw tokens are
 *   never persisted.
 * - WebAuthn credential public keys are stored as base64-encoded CBOR.
 * - OAuth tokens are encrypted at rest via the crypto module.
 *
 * @module db/schema/sessions
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/* ═══════════════════════════════════════════════════════════════
   USER SESSIONS — Refresh Token Management
   ═══════════════════════════════════════════════════════════════ */

/**
 * User sessions table — tracks active refresh tokens across devices.
 *
 * @remarks
 * - Each row represents one active device/session.
 * - The `token_hash` is a SHA-256 hash of the raw refresh token.
 * - Tokens are rotated on each refresh: old hash is replaced with new.
 * - Sessions can be individually or bulk-revoked via the `revoked` flag.
 * - The Redis blocklist provides immediate revocation; this table is the
 *   persistent fallback for Redis cache misses.
 *
 * @complexity
 * - Lookup by token hash: O(log n) via unique index.
 * - Lookup by user: O(log n) via user_id index.
 */
export const userSessions = sqliteTable(
  'user_sessions',
  {
    /** Auto-incrementing primary key. */
    id: integer('id').primaryKey({ autoIncrement: true }),

    /** Foreign key to `users.id`. Cascading delete removes orphaned sessions. */
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * SHA-256 hash of the refresh token.
     * The raw token is only sent to the client; we never store it.
     */
    tokenHash: text('token_hash').notNull().unique(),

    /**
     * Token expiration timestamp (UTC ISO-8601).
     * After this time, the token is invalid regardless of other checks.
     */
    expiresAt: text('expires_at').notNull(),

    /**
     * Whether this session has been explicitly revoked.
     * 0 = active, 1 = revoked.
     */
    revoked: integer('revoked').default(0),

    /**
     * Device fingerprint for session identification.
     * Derived from User-Agent + IP partial hash.
     */
    deviceFingerprint: text('device_fingerprint'),

    /** Human-readable device/browser description (e.g., "Chrome on macOS"). */
    deviceName: text('device_name'),

    /** IP address at session creation time. */
    ipAddress: text('ip_address'),

    /** User-Agent string at session creation time. */
    userAgent: text('user_agent'),

    /** Timestamp of the last token refresh. */
    lastUsedAt: text('last_used_at'),

    /** Session creation timestamp. */
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),

    /** Whether this session was created with "Remember Me" for 30-day persistence. */
    rememberMe: integer('remember_me').default(0),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
    index('idx_sessions_expires').on(table.expiresAt),
  ]
);

export type UserSession = typeof userSessions.$inferSelect;
export type NewUserSession = typeof userSessions.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   USER PASSKEYS — WebAuthn Credential Storage
   ═══════════════════════════════════════════════════════════════ */

/**
 * User passkeys table — stores WebAuthn credentials for passwordless login.
 *
 * @remarks
 * - Each user can register multiple passkeys (e.g., phone + security key).
 * - `credential_id` is the unique identifier assigned by the authenticator.
 * - `public_key` is the COSE-encoded public key (base64).
 * - `sign_count` is incremented on each authentication to detect cloning.
 *
 * @security
 * - Public keys are NOT secret but are stored securely to prevent tampering.
 * - The `sign_count` MUST be validated on each authentication attempt.
 *   If the presented count is less than the stored count, the credential
 *   may have been cloned and the authentication MUST be rejected.
 */
export const userPasskeys = sqliteTable(
  'user_passkeys',
  {
    /** Auto-incrementing primary key. */
    id: integer('id').primaryKey({ autoIncrement: true }),

    /** Foreign key to `users.id`. */
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** User-provided name for this passkey (e.g., "iPhone", "YubiKey"). */
    name: text('name').notNull().default('My Passkey'),

    /**
     * Base64url-encoded credential ID from the authenticator.
     * Unique across all users.
     */
    credentialId: text('credential_id').notNull().unique(),

    /**
     * Base64url-encoded COSE public key from the authenticator.
     */
    publicKey: text('public_key').notNull(),

    /**
     * Signature counter for clone detection.
     * Must monotonically increase on each authentication.
     */
    signCount: integer('sign_count').notNull().default(0),

    /**
     * COSE algorithm identifier (e.g., -7 for ES256, -257 for RS256).
     */
    algorithm: integer('algorithm').notNull().default(-7),

    /**
     * Authenticator transports (e.g., 'usb', 'ble', 'nfc', 'internal').
     * Stored as JSON array.
     */
    transports: text('transports'),

    /** Whether this passkey is still active. */
    active: integer('active').default(1),

    /** Last successful authentication timestamp. */
    lastUsedAt: text('last_used_at'),

    /** Credential registration timestamp. */
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_passkeys_user').on(table.userId),
  ]
);

export type UserPasskey = typeof userPasskeys.$inferSelect;
export type NewUserPasskey = typeof userPasskeys.$inferInsert;

/* ═══════════════════════════════════════════════════════════════
   OAUTH ACCOUNTS — Linked Third-Party Providers
   ═══════════════════════════════════════════════════════════════ */

/**
 * OAuth accounts table — links external identity providers to local users.
 *
 * @remarks
 * - A user can link multiple providers (Google + GitHub, etc.).
 * - `provider_account_id` is the unique ID from the OAuth provider.
 * - Access and refresh tokens from the provider are encrypted at rest.
 * - The combination of (provider, provider_account_id) is unique.
 *
 * @security
 * - OAuth tokens are encrypted with AES-256-GCM before storage.
 * - Token refresh is handled transparently by the auth service.
 */
export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    /** Auto-incrementing primary key. */
    id: integer('id').primaryKey({ autoIncrement: true }),

    /** Foreign key to `users.id`. */
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /**
     * OAuth provider identifier (e.g., 'google', 'github', 'apple').
     */
    provider: text('provider').notNull(),

    /**
     * Unique account ID from the OAuth provider.
     * For Google, this is the `sub` claim from the ID token.
     */
    providerAccountId: text('provider_account_id').notNull(),

    /**
     * Email address from the OAuth provider profile.
     * May differ from the local user's email.
     */
    email: text('email'),

    /**
     * Display name from the OAuth provider profile.
     */
    displayName: text('display_name'),

    /**
     * Profile avatar URL from the OAuth provider.
     */
    avatarUrl: text('avatar_url'),

    /**
     * AES-256-GCM encrypted OAuth access token.
     * Format: iv:ciphertext:authTag (base64).
     */
    encryptedAccessToken: text('encrypted_access_token'),

    /**
     * AES-256-GCM encrypted OAuth refresh token.
     * NULL if the provider doesn't issue refresh tokens.
     */
    encryptedRefreshToken: text('encrypted_refresh_token'),

    /**
     * Access token expiration timestamp (UTC ISO-8601).
     * NULL if the token doesn't expire.
     */
    tokenExpiresAt: text('token_expires_at'),

    /** OAuth scopes granted by the user (space-separated). */
    scope: text('scope'),

    /** Account linking timestamp. */
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),

    /** Last token refresh timestamp. */
    updatedAt: text('updated_at')
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_oauth_user').on(table.userId),
    index('idx_oauth_provider').on(table.provider, table.providerAccountId),
  ]
);

export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;
