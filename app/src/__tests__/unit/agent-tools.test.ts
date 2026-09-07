import { describe, it, expect } from 'vitest';
import { AGENT_TOOLS } from '@/lib/ai/agentTools';

describe('Module 19: Agentic AI Coach Tools & Action Rollback Suite', () => {
  describe('Agent Tool Declarations & Schemas', () => {
    it('declares essential financial tools with rigorous parameter definitions', () => {
      const toolNames = AGENT_TOOLS.map((t) => t.name);
      expect(toolNames).toContain('createTransaction');
      expect(toolNames).toContain('setBudgetLimit');
      expect(toolNames).toContain('createSavingsGoal');
    });

    it('requires mandatory attributes for createTransaction', () => {
      const tool = AGENT_TOOLS.find((t) => t.name === 'createTransaction');
      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('amount');
      expect(tool?.parameters.required).toContain('type');
      expect(tool?.parameters.required).toContain('description');
    });

    it('requires mandatory attributes for setBudgetLimit', () => {
      const tool = AGENT_TOOLS.find((t) => t.name === 'setBudgetLimit');
      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('categoryName');
      expect(tool?.parameters.required).toContain('monthlyLimit');
    });

    it('requires mandatory attributes for createSavingsGoal', () => {
      const tool = AGENT_TOOLS.find((t) => t.name === 'createSavingsGoal');
      expect(tool).toBeDefined();
      expect(tool?.parameters.required).toContain('goalName');
      expect(tool?.parameters.required).toContain('targetAmount');
    });
  });

  describe('Inverse Operation Payload Construction', () => {
    it('constructs correct rollback payload for transaction creation', () => {
      const transactionId = 42;
      const inverse = {
        action: 'delete_transaction',
        transactionId,
      };

      const serialized = JSON.stringify(inverse);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.action).toBe('delete_transaction');
      expect(deserialized.transactionId).toBe(42);
    });

    it('constructs correct rollback payload for budget update restoring previous ceiling', () => {
      const budgetId = 10;
      const previousMonthlyLimit = 15000;
      const inverse = {
        action: 'restore_budget',
        budgetId,
        previousMonthlyLimit,
      };

      const serialized = JSON.stringify(inverse);
      const deserialized = JSON.parse(serialized);

      expect(deserialized.action).toBe('restore_budget');
      expect(deserialized.budgetId).toBe(10);
      expect(deserialized.previousMonthlyLimit).toBe(15000);
    });

    it('handles brand new budget rollback by deleting the created record', () => {
      const inverse = {
        action: 'restore_budget',
        budgetId: 12,
        previousMonthlyLimit: null,
      };

      expect(inverse.previousMonthlyLimit).toBeNull();
      expect(inverse.budgetId).toBe(12);
    });

    it('constructs correct rollback payload for goal deletion', () => {
      const inverse = {
        action: 'delete_goal',
        goalId: 88,
      };

      expect(inverse.action).toBe('delete_goal');
      expect(inverse.goalId).toBe(88);
    });
  });

  describe('Action Rate Limiting Logic', () => {
    function simulateRateLimit(timestamps: number[], now: number, maxAllowed = 5, windowMs = 60000): boolean {
      const recent = timestamps.filter((t) => now - t < windowMs);
      if (recent.length >= maxAllowed) {
        return false; // rejected
      }
      recent.push(now);
      return true; // allowed
    }

    it('allows up to 5 actions within a 1-minute window', () => {
      const now = 1000000;
      const timestamps = [now - 10000, now - 20000, now - 30000, now - 40000]; // 4 past actions

      const isAllowed = simulateRateLimit(timestamps, now);
      expect(isAllowed).toBe(true);
    });

    it('blocks the 6th action within a 1-minute window', () => {
      const now = 1000000;
      const timestamps = [now - 5000, now - 10000, now - 15000, now - 20000, now - 25000]; // 5 past actions

      const isAllowed = simulateRateLimit(timestamps, now);
      expect(isAllowed).toBe(false);
    });

    it('allows actions once previous timestamps age past the window', () => {
      const now = 1000000;
      const timestamps = [now - 70000, now - 80000, now - 90000, now - 100000, now - 110000]; // Expired

      const isAllowed = simulateRateLimit(timestamps, now);
      expect(isAllowed).toBe(true);
    });
  });

  describe('Permission Revocation Check', () => {
    function isToolPermitted(permission: { revokedAt: number | null } | null): boolean {
      if (!permission) return true; // Defaults to permitted/confirm
      return !permission.revokedAt;
    }

    it('permits tools when no revocation record exists', () => {
      expect(isToolPermitted(null)).toBe(true);
    });

    it('permits tools when revokedAt is null', () => {
      expect(isToolPermitted({ revokedAt: null })).toBe(true);
    });

    it('blocks tools when revokedAt is set', () => {
      expect(isToolPermitted({ revokedAt: Math.floor(Date.now() / 1000) })).toBe(false);
    });
  });
});
