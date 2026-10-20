import { describe, it, expect } from 'vitest';
import { simulatePayoff } from '@/services/debt.service';

describe('Debt Payoff Simulator Engine', () => {
  const sampleDebts = [
    {
      id: 1,
      name: 'Credit Card A',
      balance: 5000,
      interestRateApr: 20,
      minimumPayment: 150,
    },
    {
      id: 2,
      name: 'Personal Loan B',
      balance: 15000,
      interestRateApr: 8,
      minimumPayment: 300,
    },
    {
      id: 3,
      name: 'Student Loan C',
      balance: 2000,
      interestRateApr: 4,
      minimumPayment: 50,
    },
  ];

  it('calculates the baseline correctly (minimum payments only)', () => {
    const results = simulatePayoff(sampleDebts, 'baseline', 0);
    expect(results.months).toBeGreaterThan(0);
    expect(results.interest).toBeGreaterThan(0);
    expect(results.points[results.points.length - 1].balance).toBe(0);
    expect(results.debtFreeDate).toBeDefined();
    expect(results.timeline.length).toBe(results.months + 1);
  });

  it('accelerates payoff and saves interest when adding extra payments', () => {
    const baseline = simulatePayoff(sampleDebts, 'baseline', 0);
    const accelerated = simulatePayoff(sampleDebts, 'avalanche', 500);

    expect(accelerated.months).toBeLessThan(baseline.months);
    expect(accelerated.interest).toBeLessThan(baseline.interest);
    expect(accelerated.interestSaved).toBeGreaterThan(0);
    expect(accelerated.monthsSaved).toBeGreaterThan(0);
  });

  it('Avalanche strategy saves more interest than Snowball strategy', () => {
    const avalanche = simulatePayoff(sampleDebts, 'avalanche', 500);
    const snowball = simulatePayoff(sampleDebts, 'snowball', 500);

    // Avalanche (highest APR first) mathematically must pay less or equal interest than Snowball
    expect(avalanche.interest).toBeLessThanOrEqual(snowball.interest);
    expect(avalanche.interestSaved).toBeGreaterThanOrEqual(snowball.interestSaved);
  });

  it('Snowball strategy pays off the smallest balance first', () => {
    // With Snowball, Student Loan C (2000) should be fully paid off before Personal Loan B (15000)
    const list = sampleDebts.map(d => ({ ...d }));
    const snowball = simulatePayoff(list, 'snowball', 500);
    expect(snowball.months).toBeGreaterThan(0);
    expect(snowball.milestones.length).toBe(3);
    // First milestone should be Student Loan C (smallest balance 2000)
    expect(snowball.milestones[0].debtName).toBe('Student Loan C');
    expect(snowball.milestones[0].debtId).toBe(3);
  });

  it('Avalanche strategy pays off highest APR first', () => {
    const list = sampleDebts.map(d => ({ ...d }));
    const avalanche = simulatePayoff(list, 'avalanche', 500);
    expect(avalanche.milestones.length).toBe(3);
    // First milestone should be Credit Card A (highest APR 20%)
    expect(avalanche.milestones[0].debtName).toBe('Credit Card A');
    expect(avalanche.milestones[0].debtId).toBe(1);
  });

  it('handles edge cases gracefully (zero balance or empty debt list)', () => {
    const emptyResult = simulatePayoff([], 'avalanche', 500);
    expect(emptyResult.months).toBe(0);
    expect(emptyResult.interest).toBe(0);
    expect(emptyResult.points[0].balance).toBe(0);

    const zeroBalanceDebts = [{ id: 10, name: 'Paid Loan', balance: 0, interestRateApr: 15, minimumPayment: 100 }];
    const zeroResult = simulatePayoff(zeroBalanceDebts, 'snowball', 200);
    expect(zeroResult.months).toBe(0);
    expect(zeroResult.totalPrincipal).toBe(0);
  });
});
