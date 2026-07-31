/**
 * @fileoverview Micro-Savings Round-Up Calculation Engine.
 * Calculates transaction delta to the next integer boundary and applies user multipliers.
 */

export interface RoundUpResult {
  rawDelta: number;
  multipliedAmount: number;
}

export function calculateRoundUp(amount: number, multiplier: number = 1.0): RoundUpResult {
  if (amount <= 0) return { rawDelta: 0, multipliedAmount: 0 };

  const ceiling = Math.ceil(amount);
  // Handle exact whole dollar amounts by rounding up $1.00
  const baseDelta = ceiling === amount ? 1.0 : ceiling - amount;
  const rawDelta = Number(baseDelta.toFixed(2));
  
  // Cap raw multiplier to prevent extreme transfers
  const validMultiplier = Math.max(1.0, Math.min(5.0, multiplier));
  const multipliedAmount = Number((rawDelta * validMultiplier).toFixed(2));

  return { rawDelta, multipliedAmount };
}
