import { describe, it, expect } from 'vitest';
import { calculateRoundUp } from '@/lib/finance/roundUpEngine';

describe('Module 15: Micro-Savings Round-Up & Sweep Engine', () => {
  describe('calculateRoundUp', () => {
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

    it('should apply multipliers (2x, 5x) and enforce safety cap (max 5x) for 10x', () => {
      const res2x = calculateRoundUp(4.25, 2.0);
      expect(res2x.multipliedAmount).toBe(1.5);

      const res5x = calculateRoundUp(4.25, 5.0);
      expect(res5x.multipliedAmount).toBe(3.75);

      const res10x = calculateRoundUp(4.25, 10.0);
      expect(res10x.multipliedAmount).toBe(3.75); // Capped at 5x
    });

    it('should handle small fractional cents cleanly', () => {
      const res = calculateRoundUp(19.99, 1.0);
      expect(res.rawDelta).toBe(0.01);
      expect(res.multipliedAmount).toBe(0.01);
    });
  });

  describe('Threshold Sweep Gating Logic', () => {
    const isEligibleForSweep = (pendingTotal: number, threshold: number): boolean => {
      return pendingTotal >= threshold;
    };

    it('should hold round-ups in pending escrow if below threshold', () => {
      const threshold = 5.0; // $5 / ৳50 threshold
      expect(isEligibleForSweep(0.75, threshold)).toBe(false);
      expect(isEligibleForSweep(4.99, threshold)).toBe(false);
    });

    it('should trigger sweep eligibility when pending total meets or exceeds threshold', () => {
      const threshold = 5.0;
      expect(isEligibleForSweep(5.0, threshold)).toBe(true);
      expect(isEligibleForSweep(14.5, threshold)).toBe(true);
    });
  });

  describe('Goal Milestone Auto-Crossing & Stretch Goals', () => {
    const detectNewMilestones = (
      priorSaved: number,
      newSaved: number,
      target: number,
      existingMilestones: number[]
    ): number[] => {
      const priorPct = Math.floor((priorSaved / target) * 100);
      const newPct = Math.floor((newSaved / target) * 100);
      const milestones = [25, 50, 75, 100];
      const newlyUnlocked: number[] = [];

      for (const m of milestones) {
        if (newPct >= m && priorPct < m && !existingMilestones.includes(m)) {
          newlyUnlocked.push(m);
        }
      }
      return newlyUnlocked;
    };

    const computeStretchGoal = (targetAmount: number) => {
      return {
        suggestedTarget: Math.round(targetAmount * 1.5),
        multiplier: 1.5,
      };
    };

    it('should detect crossing of intermediate milestones (25%, 50%)', () => {
      const target = 1000;
      // Prior was 200 (20%), new is 300 (30%) -> crosses 25%
      const unlocked = detectNewMilestones(200, 300, target, []);
      expect(unlocked).toEqual([25]);

      // Prior was 200, new is 550 -> crosses both 25% and 50%
      const doubleCross = detectNewMilestones(200, 550, target, []);
      expect(doubleCross).toEqual([25, 50]);
    });

    it('should not re-trigger previously achieved milestones', () => {
      const target = 1000;
      const alreadyUnlocked = [25];
      const result = detectNewMilestones(240, 300, target, alreadyUnlocked);
      expect(result).toEqual([]);
    });

    it('should trigger 100% completion milestone and compute 1.5x stretch goal', () => {
      const target = 2000;
      const result = detectNewMilestones(1900, 2050, target, [25, 50, 75]);
      expect(result).toEqual([100]);

      const stretch = computeStretchGoal(target);
      expect(stretch.suggestedTarget).toBe(3000);
      expect(stretch.multiplier).toBe(1.5);
    });
  });
});
