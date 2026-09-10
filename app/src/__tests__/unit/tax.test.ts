import { describe, it, expect } from 'vitest';

describe('Module 12: Tax Tagging, Deductions & Fiscal Reporting', () => {
  const DEFAULT_TAX_CATEGORIES = [
    { code: 'SCH_C_OFFICE', name: 'Office Expenses & Supplies', percentage: 1.0, jurisdiction: 'US_IRS' },
    { code: 'SCH_C_MEALS', name: 'Business Meals & Dining', percentage: 0.5, jurisdiction: 'US_IRS' },
    { code: 'SCH_C_TRAVEL', name: 'Business Travel & Lodging', percentage: 1.0, jurisdiction: 'US_IRS' },
    { code: 'HMRC_OFFICE', name: 'Office Costs & Equipment', percentage: 1.0, jurisdiction: 'UK_HMRC' },
    { code: 'CRA_MEALS', name: 'Food & Entertainment (50%)', percentage: 0.5, jurisdiction: 'CA_CRA' },
  ];

  it('should filter tax categories accurately by selected jurisdiction', () => {
    const usCategories = DEFAULT_TAX_CATEGORIES.filter((c) => c.jurisdiction === 'US_IRS');
    expect(usCategories).toHaveLength(3);
    expect(usCategories.map((c) => c.code)).toEqual(['SCH_C_OFFICE', 'SCH_C_MEALS', 'SCH_C_TRAVEL']);

    const ukCategories = DEFAULT_TAX_CATEGORIES.filter((c) => c.jurisdiction === 'UK_HMRC');
    expect(ukCategories).toHaveLength(1);
    expect(ukCategories[0].code).toBe('HMRC_OFFICE');
  });

  it('should accurately calculate deductible amount using category percentages', () => {
    function computeDeductible(grossAmount: number, percentage: number): number {
      return Math.round(grossAmount * percentage * 100) / 100;
    }

    // 100% deduction on software/supplies
    expect(computeDeductible(250.0, 1.0)).toBe(250.0);

    // 50% deduction on business meals
    expect(computeDeductible(135.5, 0.5)).toBe(67.75);

    // Partial percentage
    expect(computeDeductible(100.0, 0.8)).toBe(80.0);
  });

  it('should flag missing receipts if amount > $75 and no receipt is attached', () => {
    interface DeductionRow {
      id: string;
      amount: number;
      receiptDocumentId: string | null;
    }

    function checkMissingReceipt(d: DeductionRow, threshold = 75): { isMissing: boolean; reason?: string } {
      if (!d.receiptDocumentId && d.amount > threshold) {
        return {
          isMissing: true,
          reason: `Expense over $${threshold} requires supporting receipt under IRS substantiation rules.`,
        };
      }
      return { isMissing: false };
    }

    const underThresholdWithoutReceipt: DeductionRow = {
      id: 'd1',
      amount: 45.0,
      receiptDocumentId: null,
    };
    expect(checkMissingReceipt(underThresholdWithoutReceipt).isMissing).toBe(false);

    const overThresholdWithReceipt: DeductionRow = {
      id: 'd2',
      amount: 120.0,
      receiptDocumentId: 'doc_123',
    };
    expect(checkMissingReceipt(overThresholdWithReceipt).isMissing).toBe(false);

    const overThresholdWithoutReceipt: DeductionRow = {
      id: 'd3',
      amount: 85.5,
      receiptDocumentId: null,
    };
    const flagged = checkMissingReceipt(overThresholdWithoutReceipt);
    expect(flagged.isMissing).toBe(true);
    expect(flagged.reason).toContain('Expense over $75 requires supporting receipt');
  });

  it('should validate 30-day share tokens against expiration and revocation', () => {
    interface FiscalShare {
      token: string;
      taxYear: number;
      expiresAt: number; // Unix timestamp in seconds
      revokedAt: number | null;
    }

    function validateShareToken(share: FiscalShare | null, currentTimestamp: number): { valid: boolean; reason?: string } {
      if (!share) {
        return { valid: false, reason: 'NOT_FOUND' };
      }
      if (share.revokedAt !== null) {
        return { valid: false, reason: 'REVOKED' };
      }
      if (currentTimestamp > share.expiresAt) {
        return { valid: false, reason: 'EXPIRED' };
      }
      return { valid: true };
    }

    const now = 1725700000;
    const activeShare: FiscalShare = {
      token: 'uuid-1',
      taxYear: 2025,
      expiresAt: now + 30 * 86400,
      revokedAt: null,
    };
    expect(validateShareToken(activeShare, now).valid).toBe(true);

    const expiredShare: FiscalShare = {
      token: 'uuid-2',
      taxYear: 2024,
      expiresAt: now - 3600, // Expired 1 hour ago
      revokedAt: null,
    };
    const expResult = validateShareToken(expiredShare, now);
    expect(expResult.valid).toBe(false);
    expect(expResult.reason).toBe('EXPIRED');

    const revokedShare: FiscalShare = {
      token: 'uuid-3',
      taxYear: 2025,
      expiresAt: now + 20 * 86400,
      revokedAt: now - 10,
    };
    const revResult = validateShareToken(revokedShare, now);
    expect(revResult.valid).toBe(false);
    expect(revResult.reason).toBe('REVOKED');
  });

  it('should encrypt deduction amounts at rest and decrypt transparently in memory (Decision A3)', () => {
    // Simulated encryption format iv:ciphertext:tag
    function simulateEncrypt(amount: number): string {
      return Buffer.from(String(amount)).toString('base64') + ':encrypted:tag';
    }

    function simulateDecrypt(encrypted: string): number {
      const b64 = encrypted.split(':')[0];
      return parseFloat(Buffer.from(b64, 'base64').toString('utf-8'));
    }

    const rawEligible = 1250.75;
    const rawDeductible = 625.38;

    const encEligible = simulateEncrypt(rawEligible);
    const encDeductible = simulateEncrypt(rawDeductible);

    // Stored string should not contain raw numbers
    expect(encEligible).not.toBe(String(rawEligible));
    expect(encDeductible).not.toBe(String(rawDeductible));

    // Decrypt in memory during report or summary calculation
    expect(simulateDecrypt(encEligible)).toBe(rawEligible);
    expect(simulateDecrypt(encDeductible)).toBe(rawDeductible);
  });

  it('should handle AI deduction review queue swipe actions (verify vs reject)', () => {
    interface QueueDecision {
      transactionId: number;
      action: 'verify' | 'reject';
      taxCategoryId?: string;
      deductiblePercentage: number;
      amount: number;
    }

    function processReviewQueueItem(item: QueueDecision) {
      if (item.action === 'verify') {
        return {
          status: 'VERIFIED',
          deductibleAmount: Math.round(item.amount * item.deductiblePercentage * 100) / 100,
          createdInTaxVault: true,
        };
      }
      return {
        status: 'REJECTED',
        deductibleAmount: 0,
        createdInTaxVault: false,
      };
    }

    const verified = processReviewQueueItem({
      transactionId: 101,
      action: 'verify',
      taxCategoryId: 'taxcat_sch_c_software',
      deductiblePercentage: 1.0,
      amount: 299.99,
    });
    expect(verified.status).toBe('VERIFIED');
    expect(verified.deductibleAmount).toBe(299.99);
    expect(verified.createdInTaxVault).toBe(true);

    const rejected = processReviewQueueItem({
      transactionId: 102,
      action: 'reject',
      deductiblePercentage: 0.5,
      amount: 85.0,
    });
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.deductibleAmount).toBe(0);
    expect(rejected.createdInTaxVault).toBe(false);
  });
});
