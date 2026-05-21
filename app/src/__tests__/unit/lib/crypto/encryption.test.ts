/**
 * @fileoverview Unit tests for the AES-256-GCM encryption module.
 *
 * Tests cover:
 * - Encryption/decryption round-trips for strings and numbers.
 * - Context-based key derivation (different contexts → different ciphertexts).
 * - Tamper detection via auth tag verification.
 * - Edge cases: empty strings, very large numbers, special characters.
 * - Format validation via `isEncrypted()`.
 *
 * @module __tests__/unit/lib/crypto/encryption.test
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  encryptField,
  decryptField,
  encryptNumber,
  decryptNumber,
  isEncrypted,
} from '@/lib/crypto/encryption';

// Set encryption key for tests
beforeAll(() => {
  process.env.ENCRYPTION_MASTER_KEY = 'test-encryption-key-for-vitest-minimum-32-chars';
});

describe('encryptField / decryptField', () => {
  it('should encrypt and decrypt a simple string', () => {
    const plaintext = 'Hello, World!';
    const encrypted = encryptField(plaintext);
    const decrypted = decryptField(encrypted);

    expect(decrypted).toBe(plaintext);
    expect(encrypted).not.toBe(plaintext);
  });

  it('should produce different ciphertexts for identical plaintexts (random IV)', () => {
    const plaintext = 'Same text twice';
    const enc1 = encryptField(plaintext);
    const enc2 = encryptField(plaintext);

    expect(enc1).not.toBe(enc2); // Different IVs
    expect(decryptField(enc1)).toBe(plaintext);
    expect(decryptField(enc2)).toBe(plaintext);
  });

  it('should handle empty strings', () => {
    expect(encryptField('')).toBe('');
    expect(decryptField('')).toBe('');
  });

  it('should handle special characters and unicode', () => {
    const texts = [
      '¥1,000,000 日本語テスト',
      'Ü̈ñíçödé™ © ® → ← ↑ ↓',
      '<script>alert("xss")</script>',
      'password=s3cr3t&token=abc123',
      '🚀💰📊💎🏦',
    ];

    for (const text of texts) {
      const encrypted = encryptField(text);
      const decrypted = decryptField(encrypted);
      expect(decrypted).toBe(text);
    }
  });

  it('should handle very long strings', () => {
    const longText = 'A'.repeat(100_000);
    const encrypted = encryptField(longText);
    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(longText);
  });

  it('should use context for key derivation (different contexts = different keys)', () => {
    const plaintext = 'Same plaintext';
    const enc1 = encryptField(plaintext, 'context-a');
    const enc2 = encryptField(plaintext, 'context-b');

    // Both should decrypt with their respective contexts
    expect(decryptField(enc1, 'context-a')).toBe(plaintext);
    expect(decryptField(enc2, 'context-b')).toBe(plaintext);

    // Cross-context decryption should fail
    expect(() => decryptField(enc1, 'context-b')).toThrow();
  });

  it('should detect tampered ciphertext (auth tag verification)', () => {
    const encrypted = encryptField('sensitive data');
    const parts = encrypted.split(':');

    // Tamper with ciphertext
    const tamperedCipher = Buffer.from(parts[1], 'base64');
    tamperedCipher[0] ^= 0xff; // Flip bits
    parts[1] = tamperedCipher.toString('base64');

    expect(() => decryptField(parts.join(':'))).toThrow();
  });

  it('should reject invalid format', () => {
    expect(() => decryptField('not-encrypted')).toThrow(/expected 3 segments/);
    expect(() => decryptField('a:b')).toThrow(/expected 3 segments/);
    expect(() => decryptField('a:b:c:d')).toThrow(/expected 3 segments/);
  });
});

describe('encryptNumber / decryptNumber', () => {
  it('should encrypt and decrypt integers', () => {
    const values = [0, 1, 42, 1000000, -500];

    for (const value of values) {
      const encrypted = encryptNumber(value);
      const decrypted = decryptNumber(encrypted);
      expect(decrypted).toBe(value);
    }
  });

  it('should encrypt and decrypt decimals', () => {
    const values = [0.01, 3.14159, 42.50, 999999.99];

    for (const value of values) {
      const encrypted = encryptNumber(value);
      const decrypted = decryptNumber(encrypted);
      expect(decrypted).toBeCloseTo(value, 10);
    }
  });

  it('should return 0 for empty encrypted string', () => {
    expect(decryptNumber('')).toBe(0);
  });
});

describe('isEncrypted', () => {
  it('should return true for valid encrypted format', () => {
    const encrypted = encryptField('test');
    expect(isEncrypted(encrypted)).toBe(true);
  });

  it('should return false for non-encrypted strings', () => {
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted('plain text')).toBe(false);
    expect(isEncrypted('42.50')).toBe(false);
    expect(isEncrypted('a:b')).toBe(false);
  });
});
