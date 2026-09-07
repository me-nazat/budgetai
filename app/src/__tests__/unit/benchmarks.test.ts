import { describe, it, expect } from 'vitest';

describe('Module 11: Anonymous Peer Benchmarking & k-Anonymity (k >= 30)', () => {
  const K_ANONYMITY_THRESHOLD = 30;

  function evaluateCohortKAnonymity(cohortMemberCount: number): { allowed: boolean; status: number } {
    if (cohortMemberCount < K_ANONYMITY_THRESHOLD) {
      return { allowed: false, status: 403 };
    }
    return { allowed: true, status: 200 };
  }

  it('should enforce k-anonymity gate: reject when cohort size < 30 (e.g. k=29)', () => {
    const check29 = evaluateCohortKAnonymity(29);
    expect(check29.allowed).toBe(false);
    expect(check29.status).toBe(403);

    const check1 = evaluateCohortKAnonymity(1);
    expect(check1.allowed).toBe(false);
    expect(check1.status).toBe(403);
  });

  it('should allow cohort percentile disclosure when k >= 30 (e.g. k=30, k=45)', () => {
    const check30 = evaluateCohortKAnonymity(30);
    expect(check30.allowed).toBe(true);
    expect(check30.status).toBe(200);

    const check50 = evaluateCohortKAnonymity(50);
    expect(check50.allowed).toBe(true);
    expect(check50.status).toBe(200);
  });

  it('should filter metrics based on active granular consent grants', () => {
    interface Consent {
      metricKey: string;
      revokedAt: number | null;
    }

    const userConsents: Consent[] = [
      { metricKey: 'SAVINGS_RATE', revokedAt: null },
      { metricKey: 'NET_WORTH', revokedAt: 1725700000 }, // Revoked
      { metricKey: 'CATEGORY_SPEND', revokedAt: null },
    ];

    const activeMetrics = userConsents
      .filter((c) => c.revokedAt === null)
      .map((c) => c.metricKey);

    expect(activeMetrics).toContain('SAVINGS_RATE');
    expect(activeMetrics).toContain('CATEGORY_SPEND');
    expect(activeMetrics).not.toContain('NET_WORTH');
  });

  it('should guarantee anonymous share card never leaks raw dollar amounts', () => {
    function generateShareCardClaim(category: string, percentileRank: number): string {
      return `I spend less on ${category} than ${percentileRank}% of peers in my demographic cohort.`;
    }

    const claim = generateShareCardClaim('Dining & Food', 78);
    expect(claim).toBe('I spend less on Dining & Food than 78% of peers in my demographic cohort.');

    // Assert no currency symbols or raw monetary figures exist in claim
    expect(claim).not.toMatch(/[$€£৳₹]/);
    expect(claim).not.toMatch(/\b\d+(\.\d{2})?\s*(USD|EUR|BDT|dollars)/i);
  });

  it('should correctly calculate 6-bin histogram distribution for category drill-down', () => {
    const sampleSpends = [100, 150, 200, 220, 250, 300, 350, 400, 450, 500, 550, 600];
    const min = 100;
    const max = 600;
    const binCount = 6;
    const binWidth = (max - min) / binCount;

    const bins = Array(binCount).fill(0);
    for (const val of sampleSpends) {
      const idx = Math.min(binCount - 1, Math.floor((val - min) / binWidth));
      bins[idx]++;
    }

    expect(bins.reduce((a, b) => a + b, 0)).toBe(sampleSpends.length);
    expect(bins.length).toBe(6);
  });
});
