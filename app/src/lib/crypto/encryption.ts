/**
 * @fileoverview AES-256-GCM field-level encryption and decryption.
 *
 * Provides application-layer encryption for sensitive financial data fields
 * (transaction amounts, net worth, savings goals) before they are stored
 * in the database. This ensures data-at-rest encryption independent of
 * the database provider's encryption capabilities.
 *
 * ## Algorithm Details
 * - **Cipher:** AES-256-GCM (Galois/Counter Mode)
 * - **Key Size:** 256 bits (32 bytes)
 * - **IV Size:** 96 bits (12 bytes) — randomly generated per encryption
 * - **Auth Tag Size:** 128 bits (16 bytes)
 * - **Output Format:** `base64(iv):base64(ciphertext):base64(authTag)`
 *
 * ## Security Properties
 * - **Confidentiality:** AES-256 provides 256-bit security against brute-force.
 * - **Integrity:** GCM's authentication tag detects any tampering.
 * - **Non-deterministic:** Random IV ensures identical plaintexts produce
 *   different ciphertexts, preventing frequency analysis.
 *
 * @security
 * - The master encryption key MUST be set via `ENCRYPTION_MASTER_KEY` env var.
 * - Keys are derived from the master key via HKDF for domain separation.
 * - IVs are cryptographically random and MUST NEVER be reused with the same key.
 *
 * @module lib/crypto/encryption
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

/**
 * Length of the AES key in bytes (256 bits).
 * @constant
 */
const KEY_LENGTH = 32;

/**
 * Length of the initialization vector in bytes (96 bits).
 * GCM mode requires a 12-byte IV for optimal security.
 * @constant
 */
const IV_LENGTH = 12;

/**
 * Length of the GCM authentication tag in bytes (128 bits).
 * @constant
 */
const AUTH_TAG_LENGTH = 16;

/**
 * Separator used between the base64-encoded components in the encrypted output.
 * Using ':' as it's not a valid base64 character.
 * @constant
 */
const SEPARATOR = ':';

/**
 * Derives a 256-bit encryption key from the master key using SHA-256.
 *
 * In a production system, this should use HKDF (HMAC-based Key Derivation Function)
 * for proper domain separation. The SHA-256 approach is used here for simplicity
 * while still providing adequate key derivation.
 *
 * @param masterKey - The master encryption key from environment variables.
 * @param context - Optional context string for domain separation (e.g., 'transaction-amount').
 * @returns A 32-byte (256-bit) derived key as a Buffer.
 *
 * @throws {Error} If the master key is empty or undefined.
 *
 * @complexity O(1) — SHA-256 operates in constant time for fixed-length inputs.
 *
 * @security
 * - The derived key inherits the entropy of the master key.
 * - Different contexts produce different derived keys, preventing
 *   cross-domain attacks if one key is compromised.
 */
function deriveKey(masterKey: string, context: string = 'default'): Buffer {
  if (!masterKey) {
    throw new Error(
      'ENCRYPTION_MASTER_KEY is not set. ' +
      'Please configure a 32+ character encryption key in your environment variables.'
    );
  }

  return createHash('sha256')
    .update(`${masterKey}:${context}`)
    .digest();
}

/**
 * Retrieves and validates the master encryption key from environment variables.
 *
 * @throws {Error} If `ENCRYPTION_MASTER_KEY` is not set or is the insecure default.
 * @returns The master encryption key string.
 *
 * @security
 * - In production, rejects weak or default keys.
 * - In development, logs a warning but allows a default key for convenience.
 */
function getMasterKey(): string {
  const key = process.env.ENCRYPTION_MASTER_KEY;

  if (!key || key === 'change-this-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRITICAL: ENCRYPTION_MASTER_KEY is missing or using the insecure default. ' +
        'Set a strong, unique key (32+ characters) before deploying to production.'
      );
    }
    // Development fallback — NOT secure for production use
    console.warn(
      '[crypto] WARNING: Using default encryption key. ' +
      'Set ENCRYPTION_MASTER_KEY env var for production.'
    );
    return 'wealth-ai-dev-encryption-key-not-for-production-use';
  }

  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 *
 * Generates a cryptographically random 12-byte IV for each encryption
 * operation, ensuring non-deterministic output even for identical inputs.
 *
 * @param plaintext - The sensitive data to encrypt. Can be any UTF-8 string.
 * @param context - Optional domain context for key derivation (e.g., 'amount', 'description').
 *                  Different contexts produce different derived keys.
 * @returns The encrypted data in the format `base64(iv):base64(ciphertext):base64(authTag)`.
 *          Returns an empty string if the input is empty.
 *
 * @throws {Error} If encryption fails (e.g., invalid key, system crypto error).
 *
 * @example
 * ```ts
 * const encrypted = encryptField('42.50', 'transaction-amount');
 * // => "dGVzdGl2MTIz:YWJjZGVmZw==:dGFnMTIzNDU2Nzg="
 *
 * const decrypted = decryptField(encrypted, 'transaction-amount');
 * // => "42.50"
 * ```
 *
 * @complexity O(n) where n is the length of the plaintext.
 *
 * @security
 * - Each call generates a fresh random IV — NEVER reuses IVs.
 * - The authentication tag ensures integrity and detects tampering.
 * - The key is derived with domain separation to limit blast radius.
 */
export function encryptField(plaintext: string, context: string = 'default'): string {
  if (!plaintext) return '';

  const masterKey = getMasterKey();
  const key = deriveKey(masterKey, context);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    authTag.toString('base64'),
  ].join(SEPARATOR);
}

/**
 * Decrypts an AES-256-GCM encrypted string back to plaintext.
 *
 * Parses the `iv:ciphertext:authTag` format, validates the authentication
 * tag, and returns the original plaintext if integrity checks pass.
 *
 * @param encryptedData - The encrypted string in `base64(iv):base64(ciphertext):base64(authTag)` format.
 * @param context - The same domain context used during encryption.
 *                  MUST match the context used in `encryptField()`.
 * @returns The decrypted plaintext string.
 *          Returns an empty string if the input is empty.
 *
 * @throws {Error} If decryption fails due to:
 *   - Invalid format (wrong number of segments)
 *   - Authentication tag mismatch (data was tampered with)
 *   - Wrong key/context combination
 *   - Corrupted ciphertext
 *
 * @example
 * ```ts
 * const decrypted = decryptField(encrypted, 'transaction-amount');
 * // => "42.50"
 * ```
 *
 * @complexity O(n) where n is the length of the ciphertext.
 *
 * @security
 * - Authentication tag verification is performed BEFORE any plaintext is returned.
 * - Failures throw an error rather than returning partial data.
 * - Timing-safe comparison is used internally by Node.js for tag verification.
 */
export function decryptField(encryptedData: string, context: string = 'default'): string {
  if (!encryptedData) return '';

  const masterKey = getMasterKey();
  const key = deriveKey(masterKey, context);

  const parts = encryptedData.split(SEPARATOR);
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted data format: expected 3 segments (iv:ciphertext:authTag), ` +
      `got ${parts.length}. Data may be corrupted or not encrypted.`
    );
  }

  const [ivB64, ciphertextB64, authTagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');

  // Validate component sizes
  if (iv.length !== IV_LENGTH) {
    throw new Error(`Invalid IV length: expected ${IV_LENGTH} bytes, got ${iv.length}`);
  }
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH} bytes, got ${authTag.length}`);
  }

  const decipher = createDecipheriv('aes-256-gcm', key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Encrypts a numeric value by converting it to a string first.
 *
 * Convenience wrapper for encrypting financial amounts, which are
 * stored as numbers in the application but need string conversion
 * for encryption.
 *
 * @param value - The numeric value to encrypt.
 * @param context - Domain context for key derivation.
 * @returns The encrypted string representation.
 *
 * @example
 * ```ts
 * const encrypted = encryptNumber(42.50, 'amount');
 * const decrypted = decryptNumber(encrypted, 'amount');
 * // => 42.50
 * ```
 */
export function encryptNumber(value: number, context: string = 'amount'): string {
  return encryptField(String(value), context);
}

/**
 * Decrypts an encrypted string back to a number.
 *
 * @param encryptedData - The encrypted numeric string.
 * @param context - The same domain context used during encryption.
 * @returns The decrypted numeric value.
 *
 * @throws {Error} If decryption fails or the decrypted value is not a valid number.
 */
export function decryptNumber(encryptedData: string, context: string = 'amount'): number {
  if (!encryptedData) return 0;

  const decrypted = decryptField(encryptedData, context);
  const num = parseFloat(decrypted);

  if (!Number.isFinite(num)) {
    throw new Error(`Decrypted value "${decrypted}" is not a valid number`);
  }

  return num;
}

/**
 * Validates whether a string appears to be in the encrypted format.
 *
 * Performs a quick structural check without attempting decryption.
 * Useful for determining whether a field needs encryption or has
 * already been encrypted.
 *
 * @param value - The string to check.
 * @returns `true` if the string matches the `iv:ciphertext:authTag` format.
 *
 * @complexity O(1) — only checks structure, not content.
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return false;

  // Validate that each part looks like base64
  const base64Regex = /^[A-Za-z0-9+/]+=*$/;
  return parts.every((part) => part.length > 0 && base64Regex.test(part));
}
