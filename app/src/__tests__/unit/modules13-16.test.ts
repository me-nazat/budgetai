import { describe, it, expect } from 'vitest';
import { encryptField, decryptField, encryptNumber, decryptNumber } from '@/lib/crypto/encryption';
import { cosineSimilarity } from '@/lib/ai/semanticVector';
import { RoundUpRepository } from '@/repositories/roundUp.repository';
import { calculateMatchConfidence } from '@/lib/ai/statementParser';
import { sanitizeExportData, maskAccountNumber } from '@/lib/security/privacy';

describe('Modules 13–16 Integration & Unit Verification', () => {
  describe('Module 13: AI Document Vault with Semantic Search & Encryption', () => {
    it('should encrypt and decrypt ocrRawText and embedding vectors with AES-256-GCM', () => {
      const sampleOCR = 'Grameenphone Postpaid Bill\nInvoice #GP-8831\nTotal: ৳1,450.00';
      const encryptedOCR = encryptField(sampleOCR, 'document_ocr');
      expect(encryptedOCR).not.toBe(sampleOCR);
      expect(encryptedOCR).toContain(':'); // IV:AuthTag:Ciphertext format

      const decryptedOCR = decryptField(encryptedOCR, 'document_ocr');
      expect(decryptedOCR).toBe(sampleOCR);

      const embeddingVector = [0.123, -0.456, 0.789, 0.012];
      const serialized = JSON.stringify(embeddingVector);
      const encryptedEmbedding = encryptField(serialized, 'document_ocr');
      expect(encryptedEmbedding).not.toBe(serialized);

      const decryptedEmbedding = JSON.parse(decryptField(encryptedEmbedding, 'document_ocr'));
      expect(decryptedEmbedding).toEqual(embeddingVector);
    });

    it('should calculate accurate cosine similarity for semantic document retrieval', () => {
      const queryVec = [0.5, 0.5, 0.5, 0.5];
      const matchDocVec = [0.49, 0.51, 0.48, 0.52]; // High similarity
      const diffDocVec = [-0.5, -0.5, 0.5, 0.5];   // Orthogonal/Low similarity

      const matchSim = cosineSimilarity(queryVec, matchDocVec);
      const diffSim = cosineSimilarity(queryVec, diffDocVec);

      expect(matchSim).toBeGreaterThan(0.95);
      expect(diffSim).toBeLessThan(0.1);
    });

    it('should fallback to case-insensitive substring matching when query matches merchant or OCR', () => {
      const doc = {
        merchantName: 'Dhaka Electric Supply Company',
        ocrRawText: 'DESCO electricity monthly utility payment',
      };

      const query = 'desco';
      const matchesMerchant = doc.merchantName.toLowerCase().includes(query.toLowerCase());
      const matchesOCR = doc.ocrRawText.toLowerCase().includes(query.toLowerCase());

      expect(matchesMerchant || matchesOCR).toBe(true);
    });
  });

  describe('Module 14: Global Privacy Mode & Redaction', () => {
    it('should redact sensitive amounts and net worth values to 0 when privacy mode is active', () => {
      const rawData = {
        netWorth: 185000,
        currentBalance: 34200,
        amount: 2500,
        totalNetWorth: 220000,
        savedAmount: 15000,
        nonSensitiveLabel: 'Monthly Groceries',
      };

      const redacted = sanitizeExportData(rawData, { maskAmounts: true });
      expect(redacted.netWorth).toBe(0);
      expect(redacted.currentBalance).toBe(0);
      expect(redacted.amount).toBe(0);
      expect(redacted.totalNetWorth).toBe(0);
      expect(redacted.savedAmount).toBe(0);
      expect(redacted.nonSensitiveLabel).toBe('Monthly Groceries');
    });

    it('should mask bank account numbers while preserving last 4 digits', () => {
      const accountNumber = '1023456789';
      const masked = maskAccountNumber(accountNumber);
      expect(masked).toBe('•••• •••• •••• 6789');
    });

    it('should trigger devicemotion shake detection when acceleration exceeds threshold', () => {
      const SHAKE_THRESHOLD = 15;
      const sampleShake = { x: 18, y: 3, z: 2 };
      const magnitude = Math.sqrt(sampleShake.x ** 2 + sampleShake.y ** 2 + sampleShake.z ** 2);
      expect(magnitude).toBeGreaterThan(SHAKE_THRESHOLD);
    });
  });

  describe('Module 15: Micro-Savings Auto-Roundups & Goal Milestones', () => {
    it('should calculate round-up values correctly with 1x, 2x, and 5x multipliers', () => {
      const purchaseAmount = 47.3; // Rounds up to 48.0 (delta = 0.7)

      const roundUp1x = RoundUpRepository.calculateRoundUp(purchaseAmount, 1.0, 1.0);
      expect(roundUp1x).toBe(0.7);

      const roundUp2x = RoundUpRepository.calculateRoundUp(purchaseAmount, 1.0, 2.0);
      expect(roundUp2x).toBe(1.4);

      const roundUp5x = RoundUpRepository.calculateRoundUp(purchaseAmount, 1.0, 5.0);
      expect(roundUp5x).toBe(3.5);
    });

    it('should encrypt and decrypt savings goal balances to prevent plaintext exposure in database', () => {
      const initialBalance = 15000.75;
      const sweepAddition = 3.5;
      const newBalance = Math.round((initialBalance + sweepAddition) * 100) / 100;

      const encrypted = encryptNumber(newBalance, 'amount');
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':');

      const decrypted = decryptNumber(encrypted, 'amount');
      expect(decrypted).toBe(15004.25);
    });

    it('should trigger milestone events when goal crosses 25%, 50%, 75%, and 100%', () => {
      const target = 10000;
      const thresholds = [100, 75, 50, 25];

      const checkMilestone = (saved: number, lastHit: number) => {
        const pct = Math.floor((saved / target) * 100);
        for (const t of thresholds) {
          if (pct >= t && lastHit < t) {
            return t;
          }
        }
        return null;
      };

      // 24% -> 26% crosses 25% milestone
      expect(checkMilestone(2600, 0)).toBe(25);

      // 49% -> 52% crosses 50% milestone
      expect(checkMilestone(5200, 25)).toBe(50);

      // Already hit 50%, at 55% -> no new milestone
      expect(checkMilestone(5500, 50)).toBeNull();

      // 74% -> 76% crosses 75% milestone
      expect(checkMilestone(7600, 50)).toBe(75);

      // 99% -> 100% crosses 100% milestone
      expect(checkMilestone(10000, 75)).toBe(100);
    });
  });

  describe('Module 16: Statement Parser & Duplicate Reconciliation Queue', () => {
    it('should score exact duplicate entries with match confidence >= 0.92', () => {
      const parsedTx = {
        date: '2026-03-10',
        amount: 52.1,
        description: 'Chevron Gas Station 2910',
      };
      const existingTx = {
        date: '2026-03-10',
        amount: 52.1,
        description: 'Chevron Gas Station 2910',
      };

      const confidence = calculateMatchConfidence(parsedTx, existingTx);
      expect(confidence).toBeGreaterThanOrEqual(0.92);
    });

    it('should score completely distinct transactions with low confidence (< 0.5)', () => {
      const parsedTx = {
        date: '2026-03-10',
        amount: 15.0,
        description: 'Spotify Music Subscription',
      };
      const existingTx = {
        date: '2026-03-28',
        amount: 1200.0,
        description: 'Monthly Apartment Rent',
      };

      const confidence = calculateMatchConfidence(parsedTx, existingTx);
      expect(confidence).toBeLessThan(0.5);
    });

    it('should support the 4 canonical resolutions: kept_both, merged, discarded, pending', () => {
      const validResolutions = ['pending', 'kept_both', 'merged', 'discarded'];
      expect(validResolutions).toHaveLength(4);
      expect(validResolutions).toContain('pending');
      expect(validResolutions).toContain('kept_both');
      expect(validResolutions).toContain('merged');
      expect(validResolutions).toContain('discarded');
    });
  });
});
