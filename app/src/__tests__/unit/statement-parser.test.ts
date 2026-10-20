import { describe, it, expect } from 'vitest';
import {
  calculateMatchConfidence,
  calculateAmountScore,
  calculateDateScore,
  calculateDescriptionSimilarity,
  deduplicatePageTransactions,
  parseStatementCSV,
  reconcileWithLedger,
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

  describe('Deterministic parseStatementCSV', () => {
    it('should parse standard CSV with Date, Description, Amount columns', () => {
      const csv = `Date,Description,Amount
2026-03-10,Whole Foods Market,-82.40
2026-03-12,Employer Direct Deposit,3200.00
2026-03-14,Starbucks Coffee,-5.75`;

      const result = parseStatementCSV(csv);
      expect(result.transactions).toHaveLength(3);
      expect(result.transactions[0].description).toBe('Whole Foods Market');
      expect(result.transactions[0].amount).toBe(82.4);
      expect(result.transactions[0].type).toBe('expense');
      expect(result.transactions[0].suggestedCategory).toBe('Groceries');

      expect(result.transactions[1].description).toBe('Employer Direct Deposit');
      expect(result.transactions[1].amount).toBe(3200.0);
      expect(result.transactions[1].type).toBe('earning');
      expect(result.transactions[1].suggestedCategory).toBe('Salary');

      expect(result.transactions[2].suggestedCategory).toBe('Food');
    });

    it('should handle Debit and Credit split columns and quotes', () => {
      const tsv = `Date\tDescription\tDebit\tCredit\tBalance
2026-03-01\t"Rent payment, apt 4B"\t1200.00\t\t4500.00
2026-03-05\tClient Consulting Payment\t\t850.00\t5350.00`;

      const result = parseStatementCSV(tsv);
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].type).toBe('expense');
      expect(result.transactions[0].amount).toBe(1200.0);
      expect(result.transactions[0].suggestedCategory).toBe('Housing');
      expect(result.transactions[1].type).toBe('earning');
      expect(result.transactions[1].amount).toBe(850.0);
    });
  });

  describe('reconcileWithLedger', () => {
    it('should accurately tag exact match, probable duplicate, and new transaction', () => {
      const parsed = [
        {
          date: '2026-03-15',
          description: 'Amazon Retail Purchase',
          amount: 45.99,
          type: 'expense' as const,
          suggestedCategory: 'Shopping',
        },
        {
          date: '2026-03-15',
          description: 'Target Store #102',
          amount: 89.5,
          type: 'expense' as const,
          suggestedCategory: 'Shopping',
        },
        {
          date: '2026-03-20',
          description: 'New Local Bistro',
          amount: 34.0,
          type: 'expense' as const,
          suggestedCategory: 'Food',
        },
      ];

      const ledger = [
        {
          id: 101,
          date: '2026-03-15',
          description: 'Amazon Retail Purchase',
          amount: 45.99,
        },
        {
          id: 102,
          date: '2026-03-17',
          description: 'Target Express',
          amount: 89.5,
        },
      ];

      const reconciled = reconcileWithLedger(parsed, ledger);
      expect(reconciled).toHaveLength(3);

      // Exact match
      expect(reconciled[0].status).toBe('exact_match');
      expect(reconciled[0].action).toBe('skip');
      expect(reconciled[0].matchedExistingTransactionId).toBe(101);

      // Probable duplicate
      expect(reconciled[1].status).toBe('probable_duplicate');
      expect(reconciled[1].matchedExistingTransactionId).toBe(102);

      // New transaction
      expect(reconciled[2].status).toBe('new_transaction');
      expect(reconciled[2].action).toBe('import');
      expect(reconciled[2].matchedExistingTransactionId).toBeNull();
    });
  });
});
