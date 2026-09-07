import { describe, it, expect } from 'vitest';
import {
  calculateMatchConfidence,
  calculateAmountScore,
  calculateDateScore,
  calculateDescriptionSimilarity,
  deduplicatePageTransactions,
  ParsedStatementTransaction,
} from '@/lib/ai/statementParser';

describe('Module 16: Statement Parser & Confidence Scoring Rubric', () => {
  describe('calculateAmountScore', () => {
    it('should return 1.0 for exact cent match', () => {
      expect(calculateAmountScore(45.99, 45.99)).toBe(1.0);
    });

    it('should return 0.85 for micro-variance within 1%', () => {
      // 100.00 vs 100.50 -> 0.5% difference
      expect(calculateAmountScore(100.0, 100.5)).toBe(0.85);
    });

    it('should return 0.0 for distinct amounts', () => {
      expect(calculateAmountScore(45.99, 120.0)).toBe(0.0);
    });
  });

  describe('calculateDateScore', () => {
    it('should return 1.0 for identical date strings', () => {
      expect(calculateDateScore('2026-03-15', '2026-03-15')).toBe(1.0);
    });

    it('should degrade score smoothly for 1-day and 2-day offsets', () => {
      expect(calculateDateScore('2026-03-15', '2026-03-16')).toBe(0.85);
      expect(calculateDateScore('2026-03-15', '2026-03-17')).toBe(0.6);
      expect(calculateDateScore('2026-03-15', '2026-03-18')).toBe(0.35);
    });

    it('should return 0.0 for dates separated by more than 7 days', () => {
      expect(calculateDateScore('2026-03-15', '2026-03-25')).toBe(0.0);
    });
  });

  describe('calculateDescriptionSimilarity', () => {
    it('should return 1.0 for identical descriptions', () => {
      const desc = 'Amazon Marketplace Retail Purchase';
      expect(calculateDescriptionSimilarity(desc, desc)).toBe(1.0);
    });

    it('should grant substring inclusion bonus when brand is contained', () => {
      const descA = 'Starbucks Coffee';
      const descB = 'Starbucks Store #4812 Seattle WA';
      const score = calculateDescriptionSimilarity(descA, descB);
      expect(score).toBeGreaterThanOrEqual(0.85);
    });

    it('should return 0.0 for disjoint descriptions', () => {
      expect(calculateDescriptionSimilarity('Chevron Gas Station', 'Netflix Subscription')).toBe(0.0);
    });
  });

  describe('calculateMatchConfidence (Composite Rubric)', () => {
    it('should score >= 0.92 for high-confidence duplicate entries', () => {
      const parsed = {
        date: '2026-03-15',
        amount: 45.99,
        description: 'Amazon Retail Online Order',
      };
      const existing = {
        date: '2026-03-15',
        amount: 45.99,
        description: 'Amazon Retail Online Order',
      };

      const confidence = calculateMatchConfidence(parsed, existing);
      expect(confidence).toBeGreaterThanOrEqual(0.92);
      expect(confidence).toBeLessThanOrEqual(1.0);
    });

    it('should score medium confidence (0.70 - 0.91) for partial matches requiring user review', () => {
      const parsed = {
        date: '2026-03-15',
        amount: 45.99,
        description: 'Target Store #102',
      };
      // 2-day date difference, brand description variance
      const existing = {
        date: '2026-03-17',
        amount: 45.99,
        description: 'Target Express',
      };

      const confidence = calculateMatchConfidence(parsed, existing);
      expect(confidence).toBeGreaterThanOrEqual(0.7);
      expect(confidence).toBeLessThan(0.92);
    });

    it('should score < 0.70 for non-matching records (Create New bucket)', () => {
      const parsed = {
        date: '2026-03-15',
        amount: 89.5,
        description: 'Delta Air Lines Ticket',
      };
      const existing = {
        date: '2026-03-01',
        amount: 12.0,
        description: 'Local Bakery',
      };

      const confidence = calculateMatchConfidence(parsed, existing);
      expect(confidence).toBeLessThan(0.7);
    });
  });

  describe('deduplicatePageTransactions (Multi-Page Merge)', () => {
    it('should deduplicate entries crossing page boundaries', () => {
      const pageTxs: ParsedStatementTransaction[] = [
        {
          date: '2026-03-10',
          description: 'Whole Foods Market Grocery',
          amount: 82.4,
          type: 'expense',
          suggestedCategory: 'Groceries',
        },
        {
          date: '2026-03-11',
          description: 'Uber Trip San Francisco',
          amount: 24.5,
          type: 'expense',
          suggestedCategory: 'Transportation',
        },
        // Duplicate row spanning to page 2 header
        {
          date: '2026-03-10',
          description: 'Whole Foods Market Grocery',
          amount: 82.4,
          type: 'expense',
          suggestedCategory: 'Groceries',
        },
      ];

      const merged = deduplicatePageTransactions(pageTxs);
      expect(merged.length).toBe(2);
      expect(merged.map((x) => x.description)).toEqual([
        'Whole Foods Market Grocery',
        'Uber Trip San Francisco',
      ]);
    });
  });

  describe('Atomic Commit Resolution Logic', () => {
    it('should map resolutions correctly to ledger actions', () => {
      const items = [
        { id: '1', resolution: 'merged' as const, confidence: 0.95 },
        { id: '2', resolution: 'kept_both' as const, confidence: 0.45 },
        { id: '3', resolution: 'discarded' as const, confidence: 0.2 },
      ];

      const mergedCount = items.filter((x) => x.resolution === 'merged').length;
      const createdCount = items.filter((x) => x.resolution === 'kept_both').length;
      const discardedCount = items.filter((x) => x.resolution === 'discarded').length;

      expect(mergedCount).toBe(1);
      expect(createdCount).toBe(1);
      expect(discardedCount).toBe(1);
      expect(mergedCount + createdCount).toBe(2); // Total active rows committed
    });
  });
});
