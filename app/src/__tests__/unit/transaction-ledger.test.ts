import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionService } from '@/services/transaction.service';
import { TransactionRepository } from '@/repositories/transaction.repository';
import { AccountRepository } from '@/repositories/account.repository';
import { AuditService } from '@/services/audit.service';
import { AccountService } from '@/services/account.service';

vi.mock('@/db/client', () => ({
  db: {
    transaction: vi.fn(async (cb: any) => cb({} as any)),
  },
}));

vi.mock('@/repositories/transaction.repository');
vi.mock('@/repositories/account.repository');
vi.mock('@/repositories/notification.repository', () => ({
  NotificationRepository: {
    create: vi.fn(),
  },
}));
vi.mock('@/repositories/budget.repository', () => ({
  BudgetRepository: {
    findByCategory: vi.fn(),
  },
}));
vi.mock('@/repositories/roundUp.repository', () => ({
  RoundUpRepository: {
    processRoundUpForExpense: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/services/audit.service', () => ({
  AuditService: {
    logCreate: vi.fn(),
    logUpdate: vi.fn(),
    logDelete: vi.fn(),
  },
}));
vi.mock('@/services/account.service', () => ({
  AccountService: {
    checkLowBalanceAlert: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@/services/automation-rules.service', () => ({
  AutomationRulesService: {
    applyRules: vi.fn().mockResolvedValue({
      category: 'Dining',
      matchedRuleId: null,
      taxDeductible: false,
    }),
    logExecutions: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('TransactionService & Ledger Balance Integrity', () => {
  const userId = 101;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('creates an expense and adjusts account balance by -amount atomically', async () => {
      const mockCreated = {
        id: 1,
        userId,
        type: 'expense' as const,
        amount: 250,
        category: 'Dining',
        date: '2026-10-20',
        accountId: 5,
        toAccountId: null,
        description: 'Lunch at Cafe',
        notes: null,
        isRecurring: 0,
        taxDeductible: 0,
        taxSuggested: 0,
        transferGroupId: null,
        attachments: null,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(TransactionRepository.create).mockResolvedValue(mockCreated as any);
      vi.mocked(AccountRepository.updateBalance).mockResolvedValue(undefined as any);

      const result = await TransactionService.create(userId, {
        type: 'expense',
        amount: 250,
        category: 'Dining',
        date: '2026-10-20',
        accountId: 5,
        description: 'Lunch at Cafe',
      });

      expect(result.id).toBe(1);
      expect(AccountRepository.updateBalance).toHaveBeenCalledWith(5, -250, expect.anything());
    });

    it('creates an earning and adjusts account balance by +amount atomically', async () => {
      const mockCreated = {
        id: 2,
        userId,
        type: 'earning' as const,
        amount: 5000,
        category: 'Salary',
        date: '2026-10-20',
        accountId: 5,
        toAccountId: null,
        description: 'Monthly Salary',
        notes: null,
        isRecurring: 0,
        taxDeductible: 0,
        taxSuggested: 0,
        transferGroupId: null,
        attachments: null,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(TransactionRepository.create).mockResolvedValue(mockCreated as any);
      vi.mocked(AccountRepository.updateBalance).mockResolvedValue(undefined as any);

      const result = await TransactionService.create(userId, {
        type: 'earning',
        amount: 5000,
        category: 'Salary',
        date: '2026-10-20',
        accountId: 5,
        description: 'Monthly Salary',
      });

      expect(result.id).toBe(2);
      expect(AccountRepository.updateBalance).toHaveBeenCalledWith(5, 5000, expect.anything());
    });

    it('creates a transfer and atomically updates both source (-amount) and destination (+amount)', async () => {
      const mockCreated = {
        id: 3,
        userId,
        type: 'transfer' as const,
        amount: 1200,
        category: 'Transfer',
        date: '2026-10-20',
        accountId: 5,
        toAccountId: 7,
        description: 'Savings Transfer',
        notes: null,
        isRecurring: 0,
        taxDeductible: 0,
        taxSuggested: 0,
        transferGroupId: null,
        attachments: null,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(TransactionRepository.create).mockResolvedValue(mockCreated as any);
      vi.mocked(AccountRepository.updateBalance).mockResolvedValue(undefined as any);

      const result = await TransactionService.create(userId, {
        type: 'transfer',
        amount: 1200,
        category: 'Transfer',
        date: '2026-10-20',
        accountId: 5,
        toAccountId: 7,
        description: 'Savings Transfer',
      });

      expect(result.id).toBe(3);
      expect(AccountRepository.updateBalance).toHaveBeenCalledWith(5, -1200, expect.anything());
      expect(AccountRepository.updateBalance).toHaveBeenCalledWith(7, 1200, expect.anything());
    });
  });

  describe('update', () => {
    it('accurately computes balance delta when transaction amount changes', async () => {
      const oldTx = {
        id: 10,
        userId,
        type: 'expense',
        amount: 100,
        category: 'Groceries',
        date: '2026-10-18',
        accountId: 2,
        toAccountId: null,
      };

      const updatedTx = {
        ...oldTx,
        amount: 150,
      };

      vi.mocked(TransactionRepository.findById).mockResolvedValue(oldTx as any);
      vi.mocked(TransactionRepository.update).mockResolvedValue(updatedTx as any);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      await TransactionService.update(userId, {
        id: 10,
        type: 'expense',
        amount: 150,
        category: 'Groceries',
        date: '2026-10-18',
        accountId: 2,
      });

      // Old expense was 100 (reverted = +100), new expense is 150 (applied = -150). Net delta = -50
      expect(AccountRepository.applyBalanceDeltas).toHaveBeenCalled();
      const passedDeltas = vi.mocked(AccountRepository.applyBalanceDeltas).mock.calls[0][0] as Map<number, number>;
      expect(passedDeltas.get(2)).toBe(-50);
    });

    it('accurately shifts balance when transaction moves to a different account', async () => {
      const oldTx = {
        id: 11,
        userId,
        type: 'expense',
        amount: 300,
        category: 'Utilities',
        date: '2026-10-18',
        accountId: 1, // Bank A
        toAccountId: null,
      };

      const updatedTx = {
        ...oldTx,
        accountId: 2, // Bank B
      };

      vi.mocked(TransactionRepository.findById).mockResolvedValue(oldTx as any);
      vi.mocked(TransactionRepository.update).mockResolvedValue(updatedTx as any);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      await TransactionService.update(userId, {
        id: 11,
        type: 'expense',
        amount: 300,
        category: 'Utilities',
        date: '2026-10-18',
        accountId: 2,
      });

      // Account 1 should be refunded +300
      // Account 2 should be debited -300
      const passedDeltas = vi.mocked(AccountRepository.applyBalanceDeltas).mock.calls[0][0] as Map<number, number>;
      expect(passedDeltas.get(1)).toBe(300);
      expect(passedDeltas.get(2)).toBe(-300);
    });
  });

  describe('patch (inline cell edits)', () => {
    it('applies partial merchant or category updates without changing balances', async () => {
      const oldTx = {
        id: 20,
        userId,
        type: 'expense',
        amount: 45,
        category: 'Dining',
        date: '2026-10-19',
        accountId: 3,
        description: 'Cafe old',
      };

      const patchedTx = {
        ...oldTx,
        description: 'Blue Bottle Coffee',
        category: 'Coffee & Drinks',
      };

      vi.mocked(TransactionRepository.findById).mockResolvedValue(oldTx as any);
      vi.mocked(TransactionRepository.update).mockResolvedValue(patchedTx as any);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      const result = await TransactionService.patch(userId, {
        id: 20,
        description: 'Blue Bottle Coffee',
        category: 'Coffee & Drinks',
      });

      expect(result.description).toBe('Blue Bottle Coffee');
      expect(result.category).toBe('Coffee & Drinks');
      // No balance recalculation needed when only merchant and category are updated
      expect(AccountRepository.applyBalanceDeltas).not.toHaveBeenCalled();
    });

    it('recalculates balance when amount is patched inline', async () => {
      const oldTx = {
        id: 21,
        userId,
        type: 'expense',
        amount: 50,
        category: 'Dining',
        date: '2026-10-19',
        accountId: 3,
        description: 'Dinner',
      };

      const patchedTx = {
        ...oldTx,
        amount: 80,
      };

      vi.mocked(TransactionRepository.findById).mockResolvedValue(oldTx as any);
      vi.mocked(TransactionRepository.update).mockResolvedValue(patchedTx as any);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      await TransactionService.patch(userId, {
        id: 21,
        amount: 80,
      });

      // Old expense was 50 (refunded +50), new is 80 (debited -80). Net = -30
      expect(AccountRepository.applyBalanceDeltas).toHaveBeenCalled();
      const deltas = vi.mocked(AccountRepository.applyBalanceDeltas).mock.calls[0][0] as Map<number, number>;
      expect(deltas.get(3)).toBe(-30);
    });
  });

  describe('delete & paired transfers', () => {
    it('reverses the balance impact of an expense upon deletion', async () => {
      const txToDelete = {
        id: 30,
        userId,
        type: 'expense',
        amount: 500,
        category: 'Electronics',
        date: '2026-10-15',
        accountId: 4,
        transferGroupId: null,
      };

      vi.mocked(TransactionRepository.findById).mockResolvedValue(txToDelete as any);
      vi.mocked(TransactionRepository.deleteMany).mockResolvedValue([txToDelete] as any);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      await TransactionService.delete(userId, 30);

      expect(TransactionRepository.deleteMany).toHaveBeenCalledWith(userId, [30], expect.anything());
      // Reverted expense = +500 to account 4
      const deltas = vi.mocked(AccountRepository.applyBalanceDeltas).mock.calls[0][0] as Map<number, number>;
      expect(deltas.get(4)).toBe(500);
    });

    it('atomically deletes both legs of a transfer and restores both account balances', async () => {
      const leg1 = {
        id: 41,
        userId,
        type: 'expense',
        amount: 1000,
        category: 'Transfer Out',
        accountId: 1, // Bank A debited
        transferGroupId: 'tg-999',
      };
      const leg2 = {
        id: 42,
        userId,
        type: 'earning',
        amount: 1000,
        category: 'Transfer In',
        accountId: 2, // Bank B credited
        transferGroupId: 'tg-999',
      };

      vi.mocked(TransactionRepository.findById).mockResolvedValue(leg1 as any);
      vi.mocked(TransactionRepository.findByTransferGroupId).mockResolvedValue([leg1, leg2] as any);
      vi.mocked(TransactionRepository.deleteMany).mockResolvedValue([leg1, leg2] as any);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      await TransactionService.delete(userId, 41);

      expect(TransactionRepository.deleteMany).toHaveBeenCalledWith(userId, [41, 42], expect.anything());
      // Bank A leg1 was expense 1000 -> refunded +1000
      // Bank B leg2 was earning 1000 -> debited -1000
      const deltas = vi.mocked(AccountRepository.applyBalanceDeltas).mock.calls[0][0] as Map<number, number>;
      expect(deltas.get(1)).toBe(1000);
      expect(deltas.get(2)).toBe(-1000);
    });
  });

  describe('bulk operations', () => {
    it('bulkMoveAccount moves multiple rows and consolidates balance adjustments', async () => {
      const selectedTxs = [
        { id: 101, userId, accountId: 1, amount: 100, type: 'expense' },
        { id: 102, userId, accountId: 1, amount: 200, type: 'expense' },
        { id: 103, userId, accountId: 2, amount: 50, type: 'earning' },
      ];

      vi.mocked(AccountRepository.findById).mockResolvedValue({ id: 9, name: 'Target Account', balance: 5000 } as any);
      vi.mocked(TransactionRepository.findByIds).mockResolvedValue(selectedTxs as any);
      vi.mocked(TransactionRepository.bulkMoveAccount).mockResolvedValue(3);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      const targetAccountId = 9; // Destination account
      const res = await TransactionService.bulkMoveAccount(userId, [101, 102, 103], targetAccountId);

      expect(res.count).toBe(3);
      expect(TransactionRepository.bulkMoveAccount).toHaveBeenCalledWith(
        userId,
        [101, 102, 103],
        targetAccountId,
        expect.anything()
      );

      const deltas = vi.mocked(AccountRepository.applyBalanceDeltas).mock.calls[0][0] as Map<number, number>;
      // Account 1: lost two expenses (reverted = +300)
      expect(deltas.get(1)).toBe(300);
      // Account 2: lost one earning (reverted = -50)
      expect(deltas.get(2)).toBe(-50);
      // Target Account 9: gained two expenses (-300) and one earning (+50) => Net = -250
      expect(deltas.get(9)).toBe(-250);
    });

    it('deleteBulk deletes rows and rolls back account balances atomically', async () => {
      const records = [
        { id: 201, userId, accountId: 3, amount: 400, type: 'expense', transferGroupId: null },
        { id: 202, userId, accountId: 3, amount: 600, type: 'earning', transferGroupId: null },
      ];

      vi.mocked(TransactionRepository.findByIds).mockResolvedValue(records as any);
      vi.mocked(TransactionRepository.deleteMany).mockResolvedValue(records as any);
      vi.mocked(AccountRepository.applyBalanceDeltas).mockResolvedValue(undefined as any);

      const res = await TransactionService.deleteBulk(userId, [201, 202]);

      expect(res.count).toBe(2);
      expect(TransactionRepository.deleteMany).toHaveBeenCalledWith(userId, [201, 202], expect.anything());

      const deltas = vi.mocked(AccountRepository.applyBalanceDeltas).mock.calls[0][0] as Map<number, number>;
      // Expense 400 reverted (+400) + Earning 600 reverted (-600) => Net on Account 3 = -200
      expect(deltas.get(3)).toBe(-200);
    });
  });

  describe('Split-Category Transactions & Offline Idempotency', () => {
    it('successfully creates split transaction when split sum equals total amount', async () => {
      const mockCreated = {
        id: 301,
        userId,
        type: 'expense' as const,
        amount: 5000,
        category: 'Split Transaction',
        date: '2026-10-20',
        accountId: 1,
        toAccountId: null,
        description: 'Superstore Mega Shopping',
        notes: null,
        splits: JSON.stringify([
          { id: 's1', category: 'Groceries', amount: 3200 },
          { id: 's2', category: 'Household', amount: 1200 },
          { id: 's3', category: 'Personal Care', amount: 600 },
        ]),
        isRecurring: 0,
        taxDeductible: 0,
        taxSuggested: 0,
        transferGroupId: null,
        attachments: null,
        createdAt: new Date().toISOString(),
      };

      vi.mocked(TransactionRepository.create).mockResolvedValue(mockCreated as any);
      vi.mocked(AccountRepository.updateBalance).mockResolvedValue(undefined as any);

      const result = await TransactionService.create(userId, {
        type: 'expense',
        amount: 5000,
        category: 'Split Transaction',
        accountId: 1,
        description: 'Superstore Mega Shopping',
        splits: [
          { id: 's1', category: 'Groceries', amount: 3200 },
          { id: 's2', category: 'Household', amount: 1200 },
          { id: 's3', category: 'Personal Care', amount: 600 },
        ],
      });

      expect(result.id).toBe(301);
      expect(result.category).toBe('Split Transaction');
      expect(result.splits).toHaveLength(3);
      // Account balance must be debited once by total parent amount
      expect(AccountRepository.updateBalance).toHaveBeenCalledWith(1, -5000, expect.anything());
    });

    it('accepts split amounts with slight float rounding within 0.01 tolerance', async () => {
      const mockCreated = {
        id: 302,
        userId,
        type: 'expense' as const,
        amount: 10.0,
        category: 'Split Transaction',
        date: '2026-10-20',
        accountId: 1,
        toAccountId: null,
        description: 'Split three ways',
        splits: JSON.stringify([
          { id: 's1', category: 'Cat A', amount: 3.33 },
          { id: 's2', category: 'Cat B', amount: 3.33 },
          { id: 's3', category: 'Cat C', amount: 3.34 },
        ]),
        createdAt: new Date().toISOString(),
      };

      vi.mocked(TransactionRepository.create).mockResolvedValue(mockCreated as any);
      vi.mocked(AccountRepository.updateBalance).mockResolvedValue(undefined as any);

      const result = await TransactionService.create(userId, {
        type: 'expense',
        amount: 10.0,
        category: 'Split Transaction',
        accountId: 1,
        description: 'Split three ways',
        splits: [
          { id: 's1', category: 'Cat A', amount: 3.33 },
          { id: 's2', category: 'Cat B', amount: 3.33 },
          { id: 's3', category: 'Cat C', amount: 3.34 },
        ],
      });

      expect(result.id).toBe(302);
    });

    it('rejects split transaction when split sum does not equal total amount', async () => {
      await expect(
        TransactionService.create(userId, {
          type: 'expense',
          amount: 5000,
          category: 'Split Transaction',
          accountId: 1,
          description: 'Mismatched Splits',
          splits: [
            { id: 's1', category: 'Groceries', amount: 3000 },
            { id: 's2', category: 'Household', amount: 1000 },
            // Sum is 4000, but amount is 5000 (delta = 1000)
          ],
        })
      ).rejects.toThrow();

      expect(TransactionRepository.create).not.toHaveBeenCalled();
      expect(AccountRepository.updateBalance).not.toHaveBeenCalled();
    });

    it('enforces idempotency via clientMutationId to prevent duplicate transactions and double balance deduction', async () => {
      const existingTx = {
        id: 401,
        userId,
        clientMutationId: 'mutation-uuid-offline-sync',
        type: 'expense' as const,
        amount: 1500,
        category: 'Utilities',
        date: '2026-10-20',
        accountId: 2,
        toAccountId: null,
        description: 'Electricity Bill',
        createdAt: new Date().toISOString(),
      };

      vi.mocked(TransactionRepository.findByClientMutationId).mockResolvedValue(existingTx as any);

      const result = await TransactionService.create(userId, {
        clientMutationId: 'mutation-uuid-offline-sync',
        type: 'expense',
        amount: 1500,
        category: 'Utilities',
        accountId: 2,
        description: 'Electricity Bill',
      });

      // Returns existing transaction immediately without creating new row or deducting balance
      expect(result.id).toBe(401);
      expect(TransactionRepository.create).not.toHaveBeenCalled();
      expect(AccountRepository.updateBalance).not.toHaveBeenCalled();
    });
  });
});
