/**
 * @fileoverview TOTP (Time-based One-Time Password) module for 2FA.
 *
 * Implements RFC 6238 TOTP generation and verification using the `otpauth`
 * library. Provides utilities for setting up, verifying, and managing
 * two-factor authentication for user accounts.
 *
 * ## Flow
 * 1. User enables 2FA → `generateTOTPSecret()` creates a secret + QR URI.
 * 2. User scans QR code in their authenticator app.
 * 3. User submits a verification code → `verifyTOTP()` validates it.
 * 4. If valid, 2FA is permanently enabled and backup codes are generated.
 * 5. On each login, the user must provide a valid TOTP after password.
 *
 * @security
 * - TOTP secrets are encrypted at rest via `encryptField()`.
 * - A 30-second time window with ±1 step tolerance is used (standard).
 * - Backup codes are hashed with bcrypt before storage.
 * - Each backup code can only be used once.
 *
 * @module lib/crypto/totp
 */

import { TOTP } from 'otpauth';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Application issuer name displayed in authenticator apps.
 * @constant
 */
const ISSUER = 'Wealth AI';

/**
 * TOTP time step in seconds (standard: 30s).
 * @constant
 */
const PERIOD = 30;

/**
 * Number of digits in the OTP code (standard: 6).
 * @constant
 */
const DIGITS = 6;

/**
 * HMAC algorithm used for TOTP generation.
 * @constant
 */
const ALGORITHM = 'SHA1';

/**
 * Number of time steps to check before and after the current step.
 * A window of 1 means codes from t-30s, t, and t+30s are accepted.
 * @constant
 */
const WINDOW = 1;

/**
 * Number of one-time backup codes generated for account recovery.
 * @constant
 */
const BACKUP_CODE_COUNT = 8;

/**
 * Length of each backup code in characters.
 * @constant
 */
const BACKUP_CODE_LENGTH = 8;

/**
 * Result of TOTP secret generation for a new 2FA setup.
 */
export interface TOTPSetupResult {
  /** Base32-encoded TOTP secret (to be encrypted before storage). */
  secret: string;

  /**
   * `otpauth://` URI for QR code generation.
   * Contains the secret, issuer, account name, and parameters.
   */
  uri: string;

  /** Plain-text backup codes (show to user ONCE, then hash and store). */
  backupCodes: string[];
}

/**
 * Generates a new TOTP secret and configuration for 2FA setup.
 *
 * Creates a cryptographically random secret, builds the otpauth URI
 * for QR code display, and generates one-time backup codes.
 *
 * @param accountName - The user's email or display name for the authenticator app.
 * @returns {TOTPSetupResult} The secret, URI, and backup codes.
 *
 * @example
 * ```ts
 * const setup = generateTOTPSecret('alice@example.com');
 * // Display QR code from setup.uri
 * // Store encrypted: encryptField(setup.secret, 'totp')
 * // Hash and store: await hashBackupCodes(setup.backupCodes)
 * ```
 *
 * @complexity O(1) — generates fixed-size random data.
 *
 * @security
 * - The secret MUST be encrypted before database storage.
 * - Backup codes MUST be shown to the user exactly once.
 * - After display, backup codes are hashed with bcrypt.
 */
export function generateTOTPSecret(accountName: string): TOTPSetupResult {
  const totp = new TOTP({
    issuer: ISSUER,
    label: accountName,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
  });

  const backupCodes = generateBackupCodes();

  return {
    secret: totp.secret.base32,
    uri: totp.toString(),
    backupCodes,
  };
}

/**
 * Verifies a TOTP code against a stored secret.
 *
 * Checks the provided 6-digit code against the expected value
 * for the current time window (±1 step tolerance).
 *
 * @param token - The 6-digit code from the user's authenticator app.
 * @param secret - The base32-encoded TOTP secret (decrypted from storage).
 * @returns `true` if the code is valid for the current time window.
 *
 * @example
 * ```ts
 * const isValid = verifyTOTP('123456', decryptedSecret);
 * if (!isValid) throw new AuthenticationError('Invalid 2FA code');
 * ```
 *
 * @complexity O(1) — compares against a small fixed number of time steps.
 *
 * @security
 * - Uses timing-safe comparison internally (via otpauth library).
 * - The window parameter limits the acceptable time drift.
 * - Invalid codes do not reveal which time step was expected.
 */
export function verifyTOTP(token: string, secret: string): boolean {
  const totp = new TOTP({
    issuer: ISSUER,
    algorithm: ALGORITHM,
    digits: DIGITS,
    period: PERIOD,
    secret: secret,
  });

  const delta = totp.validate({ token, window: WINDOW });

  // delta is null if invalid, or the time step difference if valid
  return delta !== null;
}

/**
 * Generates an array of one-time backup codes for 2FA recovery.
 *
 * Each code is an 8-character alphanumeric string generated from
 * cryptographically random bytes. These codes allow account recovery
 * when the authenticator app is unavailable.
 *
 * @returns An array of plaintext backup codes.
 *
 * @complexity O(n) where n = BACKUP_CODE_COUNT (fixed at 8).
 *
 * @security
 * - Codes are generated from `crypto.randomBytes()` (CSPRNG).
 * - Each code has ~47 bits of entropy (8 alphanumeric characters).
 * - Codes MUST be hashed before storage and shown to the user only once.
 */
function generateBackupCodes(): string[] {
  const codes: string[] = [];
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes ambiguous chars: 0, O, I, 1

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const bytes = randomBytes(BACKUP_CODE_LENGTH);
    let code = '';
    for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
      code += charset[bytes[j] % charset.length];
    }
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Hashes an array of backup codes for secure storage.
 *
 * Each code is individually hashed with bcrypt (cost factor 10).
 * The hashed codes are stored as a JSON array in the database.
 *
 * @param codes - Array of plaintext backup codes.
 * @returns Array of bcrypt hashes.
 *
 * @complexity O(n × bcrypt_cost) — bcrypt is intentionally slow.
 */
export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map((code) => bcrypt.hash(code, 10)));
}

/**
 * Verifies a backup code against the stored hashes.
 *
 * If valid, the matched hash is marked as used (removed from the array).
 *
 * @param code - The backup code entered by the user.
 * @param hashedCodes - Array of bcrypt-hashed backup codes from the database.
 * @returns An object indicating success and the remaining valid hashes.
 *
 * @complexity O(n × bcrypt_cost) in the worst case (checks all hashes).
 *
 * @security
 * - Consumed codes are removed from the array to prevent reuse.
 * - bcrypt's timing-safe comparison prevents timing attacks.
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<{ valid: boolean; remainingCodes: string[] }> {
  for (let i = 0; i < hashedCodes.length; i++) {
    const match = await bcrypt.compare(code, hashedCodes[i]);
    if (match) {
      // Remove the used code
      const remaining = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
      return { valid: true, remainingCodes: remaining };
    }
  }

  return { valid: false, remainingCodes: hashedCodes };
}
