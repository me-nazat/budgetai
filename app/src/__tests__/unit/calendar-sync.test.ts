import { describe, it, expect } from 'vitest';
import {
  encryptCalendarToken,
  decryptCalendarToken,
  computeEventHash,
  computePushScheduleTime,
} from '@/lib/security/calendarToken';

describe('Module 18: Google Calendar Sync & Push Alert Scheduling', () => {
  describe('OAuth Token Encryption at Rest (AES-256-GCM)', () => {
    const rawRefreshToken = '1//04abcDEF123456_Google_OAuth_Refresh_Token_SECRET_XYZ';

    it('encrypts Google OAuth tokens into non-deterministic ciphertexts', () => {
      const enc1 = encryptCalendarToken(rawRefreshToken);
      const enc2 = encryptCalendarToken(rawRefreshToken);

      expect(enc1).not.toBe(rawRefreshToken);
      expect(enc2).not.toBe(rawRefreshToken);
      // Non-deterministic: Random IV produces different ciphertexts
      expect(enc1).not.toBe(enc2);
    });

    it('decrypts encrypted tokens accurately back to original plaintext', () => {
      const encrypted = encryptCalendarToken(rawRefreshToken);
      const decrypted = decryptCalendarToken(encrypted);

      expect(decrypted).toBe(rawRefreshToken);
    });

    it('safely handles empty or falsy tokens', () => {
      expect(encryptCalendarToken('')).toBe('');
      expect(decryptCalendarToken('')).toBe('');
    });
  });

  describe('Two-Way Event Hash Diffing', () => {
    it('produces identical SHA-256 hashes for identical event metadata', () => {
      const hash1 = computeEventHash({
        title: 'Electricity Bill',
        amount: 3500.5,
        dueDate: '2026-05-15',
      });
      const hash2 = computeEventHash({
        title: 'Electricity Bill',
        amount: 3500.5,
        dueDate: '2026-05-15',
      });

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('detects changes in bill amount or due date', () => {
      const initialHash = computeEventHash({
        title: 'Internet Service',
        amount: 1500,
        dueDate: '2026-06-01',
      });

      const updatedAmountHash = computeEventHash({
        title: 'Internet Service',
        amount: 1750,
        dueDate: '2026-06-01',
      });

      const updatedDateHash = computeEventHash({
        title: 'Internet Service',
        amount: 1500,
        dueDate: '2026-06-05',
      });

      expect(initialHash).not.toBe(updatedAmountHash);
      expect(initialHash).not.toBe(updatedDateHash);
    });

    it('normalizes whitespace and title casing to prevent false-positive sync updates', () => {
      const hashUpper = computeEventHash({
        title: '  NETFLIX SUBSCRIPTION  ',
        amount: 1200,
        dueDate: '2026-07-10',
      });
      const hashLower = computeEventHash({
        title: 'netflix subscription',
        amount: 1200,
        dueDate: '2026-07-10',
      });

      expect(hashUpper).toBe(hashLower);
    });
  });

  describe('Push Notification Scheduling Math (8 AM on due_date - reminderDaysBefore)', () => {
    it('schedules push alert for 8:00 AM exactly N days prior to due date', () => {
      const dueDate = '2026-09-15T00:00:00Z';
      const scheduledEpoch = computePushScheduleTime(dueDate, 2);

      const scheduledDate = new Date(scheduledEpoch * 1000);
      // 2 days before Sept 15 is Sept 13
      expect(scheduledDate.getDate()).toBe(13);
      expect(scheduledDate.getMonth()).toBe(8); // September is month 8 (0-indexed)
      expect(scheduledDate.getHours()).toBe(8);
      expect(scheduledDate.getMinutes()).toBe(0);
      expect(scheduledDate.getSeconds()).toBe(0);
    });

    it('supports 1-day advance reminder alerts', () => {
      const dueDate = '2026-10-10';
      const scheduledEpoch = computePushScheduleTime(dueDate, 1);

      const scheduledDate = new Date(scheduledEpoch * 1000);
      expect(scheduledDate.getDate()).toBe(9);
      expect(scheduledDate.getHours()).toBe(8);
    });

    it('enforces minimum 1 day boundary if non-positive reminder days provided', () => {
      const dueDate = '2026-11-20';
      const scheduledEpoch = computePushScheduleTime(dueDate, 0);

      const scheduledDate = new Date(scheduledEpoch * 1000);
      expect(scheduledDate.getDate()).toBe(19); // 1 day before
    });
  });
});
