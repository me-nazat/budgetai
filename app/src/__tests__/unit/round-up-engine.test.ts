import { describe, it, expect } from 'vitest';
import { calculateRoundUp } from '@/lib/finance/roundUpEngine';

describe('Module 15: Micro-Savings Round-Up Engine', () => {
  it('should calculate raw delta and 1x roundup for fractional dollars', () => {
    const res = calculateRoundUp(4.25, 1.0);
    expect(res.rawDelta).toBe(0.75);
    expect(res.multipliedAmount).toBe(0.75);
  });

  it('should handle whole dollar amounts by rounding up $1.00', () => {
    const res = calculateRoundUp(5.0, 1.0);
    expect(res.rawDelta).toBe(1.0);
    expect(res.multipliedAmount).toBe(1.0);
  });

  it('should apply multipliers (2x, 5x) accurately', () => {
    const res2x = calculateRoundUp(4.25, 2.0);
    expect(res2x.multipliedAmount).toBe(1.5);

    const res5x = calculateRoundUp(4.25, 5.0);
    expect(res5x.multipliedAmount).toBe(3.75);
  });
});
