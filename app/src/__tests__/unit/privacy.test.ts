import { describe, it, expect } from 'vitest';
import {
  maskAccountNumber,
  maskEmbeddedAccountNumbers,
  sanitizeExportData,
  ACCOUNT_OR_CARD_REGEX,
} from '@/lib/security/privacy';

describe('Module 14: Privacy & Account Masking Utilities', () => {
  describe('maskAccountNumber', () => {
    it('should mask 16-digit formatted card numbers keeping only last 4', () => {
      const masked = maskAccountNumber('4532-1234-5678-9012');
      expect(masked).toBe('•••• •••• •••• 9012');
    });

    it('should mask contiguous 16-digit account strings', () => {
      const masked = maskAccountNumber('1122334455667788');
      expect(masked).toBe('•••• •••• •••• 7788');
    });

    it('should mask 10-digit bank account numbers', () => {
      const masked = maskAccountNumber('9876543210');
      expect(masked).toBe('•••• •••• •••• 3210');
    });

    it('should handle short identifiers safely', () => {
      expect(maskAccountNumber('1234')).toBe('•••• 1234');
      expect(maskAccountNumber('12')).toBe('12');
      expect(maskAccountNumber('')).toBe('');
    });
  });

  describe('maskEmbeddedAccountNumbers', () => {
    it('should detect and mask card numbers embedded inside descriptions', () => {
      const text = 'Transfer to Chase checking 4532-1234-5678-9012 on Tuesday';
      const result = maskEmbeddedAccountNumbers(text);
      expect(result).toBe('Transfer to Chase checking •••• •••• •••• 9012 on Tuesday');
    });

    it('should leave text without account numbers unchanged', () => {
      const text = 'Grocery shopping at Trader Joe';
      expect(maskEmbeddedAccountNumbers(text)).toBe(text);
    });
  });

  describe('sanitizeExportData', () => {
    it('should sanitize nested objects containing account identifiers', () => {
      const rawReport = {
        title: 'Annual Fiscal Report',
        accounts: [
          {
            name: 'Savings Account',
            accountNumber: '1234567890123456',
            balance: 54000.5,
          },
          {
            name: 'Credit Card',
            cardNumber: '4532-9876-5432-1111',
            balance: -1250.0,
          },
        ],
      };

      const sanitized = sanitizeExportData(rawReport, { maskAccountNumbers: true });
      expect(sanitized.accounts[0].accountNumber).toBe('•••• •••• •••• 3456');
      expect(sanitized.accounts[1].cardNumber).toBe('•••• •••• •••• 1111');
      expect(sanitized.accounts[0].balance).toBe(54000.5);
    });

    it('should sanitize numeric amounts when maskAmounts is enabled', () => {
      const payload = {
        totalNetWorth: 250000,
        currentBalance: 15000,
        username: 'Nazat',
      };

      const sanitized = sanitizeExportData(payload, { maskAmounts: true, maskAccountNumbers: true });
      expect(sanitized.totalNetWorth).toBe(0);
      expect(sanitized.currentBalance).toBe(0);
      expect(sanitized.username).toBe('Nazat');
    });
  });
});
