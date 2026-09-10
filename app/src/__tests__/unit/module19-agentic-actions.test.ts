import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isActionApprovalRequired,
  processDataActions,
  executeApprovedAgentAction,
  HIGH_VALUE_THRESHOLD,
} from '@/lib/chatActions';
import { DataAction } from '@/lib/ai';
import * as db from '@/lib/db';

vi.mock('@/lib/db', () => ({
  queryOne: vi.fn(),
  queryAll: vi.fn(),
  run: vi.fn().mockResolvedValue({ rowsAffected: 1, lastInsertRowid: 101 }),
  ensureDbInitialized: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/alerts', () => ({
  maybeCreateBudgetAlert: vi.fn().mockResolvedValue(undefined),
}));

describe('Module 19: Agentic AI Action Expansion & Safety Approval Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Safety Approval Gating (isActionApprovalRequired)', () => {
    it('requires approval for any destructive "reset" action', () => {
      const resetAction: DataAction = {
        type: 'reset',
        target: 'transactions',
      };
      const check = isActionApprovalRequired(resetAction);
      expect(check.required).toBe(true);
      expect(check.reason).toContain('Resetting data');
    });

    it('requires approval for any destructive "delete" action', () => {
      const deleteAction: DataAction = {
        type: 'delete',
        target: 'transactions',
        filter: { category: 'Dining' },
      };
      const check = isActionApprovalRequired(deleteAction);
      expect(check.required).toBe(true);
      expect(check.reason).toContain('Delete transactions for category "Dining"');
    });

    it('requires approval for high-value creates exceeding the threshold', () => {
      const highValueAction: DataAction = {
        type: 'create',
        target: 'transactions',
        updates: {
          amount: 25000,
          description: 'MacBook Pro Purchase',
        },
      };
      const check = isActionApprovalRequired(highValueAction);
      expect(check.required).toBe(true);
      expect(check.amount).toBe(25000);
      expect(check.reason).toContain('high value');
    });

    it('allows routine low-value actions to execute without approval', () => {
      const routineAction: DataAction = {
        type: 'create',
        target: 'transactions',
        updates: {
          amount: 250,
          description: 'Coffee & Snacks',
        },
      };
      const check = isActionApprovalRequired(routineAction);
      expect(check.required).toBe(false);
    });
  });

  describe('Staged Approval Workflow (processDataActions & executeApprovedAgentAction)', () => {
    it('stages destructive delete actions as PENDING_APPROVAL without executing delete', async () => {
      const deleteAction: DataAction = {
        type: 'delete',
        target: 'transactions',
        filter: { category: 'Entertainment' },
      };

      const results = await processDataActions([deleteAction], 1, 'session_123');

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('PENDING_APPROVAL');
      expect(results[0].requiresApproval).toBe(true);
      expect(results[0].actionLogId).toMatch(/^act_/);
      expect(results[0].count).toBe(0);

      // Verify db.run was called to insert into agent_action_logs
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO agent_action_logs'),
        expect.arrayContaining([results[0].actionLogId, 1, 'session_123', 'DELETE_TRANSACTIONS', expect.any(String)])
      );
    });

    it('allows user to reject a staged action in agent_action_logs', async () => {
      const actionLogId = 'act_test_123';
      vi.mocked(db.queryOne).mockResolvedValueOnce({
        id: actionLogId,
        user_id: 1,
        action_type: 'DELETE_TRANSACTIONS',
        payload_json: JSON.stringify({ type: 'delete', target: 'transactions' }),
        status: 'PENDING_APPROVAL',
      });

      const outcome = await executeApprovedAgentAction(actionLogId, 1, false);

      expect(outcome.success).toBe(true);
      expect(outcome.status).toBe('REJECTED');
      expect(outcome.detail).toContain('cancelled by user');

      // Verify agent_action_logs updated to REJECTED
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_action_logs SET status = ?, executed_at = ? WHERE id = ?'),
        ['REJECTED', expect.any(Number), actionLogId]
      );
    });

    it('executes a staged action once confirmed by user', async () => {
      const actionLogId = 'act_test_456';
      const stagedAction: DataAction = {
        type: 'create',
        target: 'debts',
        updates: {
          name: 'Personal Loan',
          amount: 50000,
          interest_rate_apr: 12.5,
          minimum_payment: 3000,
        },
      };

      vi.mocked(db.queryOne).mockResolvedValueOnce({
        id: actionLogId,
        user_id: 1,
        action_type: 'CREATE_DEBTS',
        payload_json: JSON.stringify(stagedAction),
        status: 'PENDING_APPROVAL',
      });

      const outcome = await executeApprovedAgentAction(actionLogId, 1, true);

      expect(outcome.success).toBe(true);
      expect(outcome.status).toBe('EXECUTED');
      expect(outcome.count).toBe(1);

      // Verify agent_action_logs updated to EXECUTED
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agent_action_logs SET status = ?, executed_at = ? WHERE id = ?'),
        ['EXECUTED', expect.any(Number), actionLogId]
      );
    });
  });

  describe('Expanded Entity Targets Coverage', () => {
    it('creates debts entity records correctly', async () => {
      const createDebt: DataAction = {
        type: 'create',
        target: 'debts',
        updates: {
          name: 'Standard Chartered Card',
          debt_type: 'credit_card',
          balance: 5000, // Below threshold so executes immediately
          interest_rate_apr: 18.0,
          minimum_payment: 500,
          due_day_of_month: 15,
        },
      };

      const results = await processDataActions([createDebt], 1, undefined, true);
      expect(results[0].status).toBe('EXECUTED');
      expect(results[0].count).toBe(1);
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO debts'),
        expect.arrayContaining([1, 'Standard Chartered Card', 'credit_card', 5000, 5000, 18, 500, 15])
      );
    });

    it('creates recurring_transactions records correctly', async () => {
      const createRecurring: DataAction = {
        type: 'create',
        target: 'recurring_transactions',
        updates: {
          name: 'Fiber Internet Subscription',
          type: 'expense',
          amount: 1500,
          category: 'Utilities',
          frequency: 'monthly',
        },
      };

      const results = await processDataActions([createRecurring], 1, undefined, true);
      expect(results[0].status).toBe('EXECUTED');
      expect(results[0].count).toBe(1);
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO recurring_transactions'),
        expect.arrayContaining([1, 'Fiber Internet Subscription', 'expense', 1500, 'Utilities', 'monthly'])
      );
    });

    it('creates investment_holdings records correctly', async () => {
      const createHolding: DataAction = {
        type: 'create',
        target: 'investment_holdings',
        updates: {
          ticker: 'AAPL',
          name: 'Apple Inc.',
          asset_type: 'stock',
          quantity: 10,
          avg_cost_basis: 180,
          currency: 'USD',
        },
      };

      const results = await processDataActions([createHolding], 1, undefined, true);
      expect(results[0].status).toBe('EXECUTED');
      expect(results[0].count).toBe(1);
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO investment_holdings'),
        expect.arrayContaining([1, 'stock', 'AAPL', 'Apple Inc.', 10, 180, 'USD', ''])
      );
    });

    it('creates accounts records correctly', async () => {
      const createAccount: DataAction = {
        type: 'create',
        target: 'accounts',
        updates: {
          name: 'City Bank Savings',
          account_type: 'bank',
          currency: 'BDT',
          opening_balance: 5000,
          current_balance: 5000,
        },
      };

      const results = await processDataActions([createAccount], 1, undefined, true);
      expect(results[0].status).toBe('EXECUTED');
      expect(results[0].count).toBe(1);
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO accounts'),
        expect.arrayContaining([1, 'City Bank Savings', 'bank', 'BDT', 5000, 5000])
      );
    });
  });
});
