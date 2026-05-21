/**
 * @fileoverview Unit tests for Zod DTO validation schemas.
 *
 * Tests every DTO schema's accept/reject behavior to ensure
 * input validation works correctly at the API boundary.
 *
 * @module __tests__/unit/lib/types/dto.test
 */

import { describe, it, expect } from 'vitest';
import {
  LoginDTO,
  RegisterDTO,
  CreateTransactionDTO,
  UpdateTransactionDTO,
  CreateBudgetDTO,
  CreateGoalDTO,
  CreateRecurringDTO,
  CreateNetWorthDTO,
  UpdateSettingsDTO,
  DashboardQueryDTO,
  emailSchema,
  amountSchema,
  dateSchema,
  currencySchema,
  DeleteByIdDTO,
} from '@/lib/types/dto';

describe('emailSchema', () => {
  it('should accept valid emails', () => {
    const valid = ['test@example.com', 'user@domain.org', 'name.last@company.co'];
    valid.forEach((email) => {
      const result = emailSchema.safeParse(email);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(email.trim().toLowerCase());
      }
    });
  });

  it('should reject invalid emails', () => {
    const invalid = ['', 'notanemail', '@domain.com', 'user@', 'user @domain.com'];
    invalid.forEach((email) => {
      expect(emailSchema.safeParse(email).success).toBe(false);
    });
  });
});

describe('amountSchema', () => {
  it('should accept valid amounts', () => {
    expect(amountSchema.safeParse(1).success).toBe(true);
    expect(amountSchema.safeParse(0.01).success).toBe(true);
    expect(amountSchema.safeParse(999999999).success).toBe(true);
    expect(amountSchema.safeParse('42.50').success).toBe(true); // String coercion
  });

  it('should reject invalid amounts', () => {
    expect(amountSchema.safeParse(0).success).toBe(false);
    expect(amountSchema.safeParse(-1).success).toBe(false);
    expect(amountSchema.safeParse(1000000000).success).toBe(false);
    expect(amountSchema.safeParse(Infinity).success).toBe(false);
    expect(amountSchema.safeParse('abc').success).toBe(false);
  });
});

describe('dateSchema', () => {
  it('should accept valid dates', () => {
    expect(dateSchema.safeParse('2026-01-15').success).toBe(true);
    expect(dateSchema.safeParse('2026-12-31').success).toBe(true);
  });

  it('should reject invalid dates', () => {
    expect(dateSchema.safeParse('2026-13-01').success).toBe(false); // Invalid month
    expect(dateSchema.safeParse('2026-00-01').success).toBe(false); // Month 0
    expect(dateSchema.safeParse('2026-1-1').success).toBe(false); // Not zero-padded
    expect(dateSchema.safeParse('not-a-date').success).toBe(false);
    expect(dateSchema.safeParse('').success).toBe(false);
  });
});

describe('currencySchema', () => {
  it('should accept valid currencies and uppercase them', () => {
    const result = currencySchema.safeParse('usd');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('USD');
  });

  it('should reject invalid currencies', () => {
    expect(currencySchema.safeParse('XXX').success).toBe(false);
    expect(currencySchema.safeParse('ABCD').success).toBe(false);
    expect(currencySchema.safeParse('US').success).toBe(false);
  });
});

describe('LoginDTO', () => {
  it('should accept valid login data', () => {
    const result = LoginDTO.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should accept login data with TOTP code', () => {
    const result = LoginDTO.safeParse({
      email: 'test@example.com',
      password: 'password123',
      totpCode: '123456',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing fields', () => {
    expect(LoginDTO.safeParse({}).success).toBe(false);
    expect(LoginDTO.safeParse({ email: 'test@example.com' }).success).toBe(false);
  });

  it('should reject short passwords', () => {
    expect(
      LoginDTO.safeParse({ email: 'test@example.com', password: '12345' }).success
    ).toBe(false);
  });
});

describe('RegisterDTO', () => {
  it('should accept valid registration data', () => {
    const result = RegisterDTO.safeParse({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should trim and normalize names', () => {
    const result = RegisterDTO.safeParse({
      name: '  Alice   Bob  ',
      email: 'alice@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Alice Bob');
    }
  });
});

describe('CreateTransactionDTO', () => {
  it('should accept valid transaction data', () => {
    const result = CreateTransactionDTO.safeParse({
      type: 'expense',
      amount: 42.50,
      category: 'Food',
      description: 'Lunch',
    });
    expect(result.success).toBe(true);
  });

  it('should set defaults for optional fields', () => {
    const result = CreateTransactionDTO.safeParse({
      type: 'earning',
      amount: 1000,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('Other');
      expect(result.data.description).toBe('');
      expect(result.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('should reject invalid type', () => {
    expect(
      CreateTransactionDTO.safeParse({
        type: 'transfer',
        amount: 100,
      }).success
    ).toBe(false);
  });
});

describe('CreateBudgetDTO', () => {
  it('should accept valid budget data', () => {
    const result = CreateBudgetDTO.safeParse({
      category: 'Food',
      monthlyLimit: 500,
      month: 1,
      year: 2026,
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid month', () => {
    expect(
      CreateBudgetDTO.safeParse({
        category: 'Food',
        monthlyLimit: 500,
        month: 13,
        year: 2026,
      }).success
    ).toBe(false);
  });
});

describe('DashboardQueryDTO', () => {
  it('should accept valid dashboard query', () => {
    const result = DashboardQueryDTO.safeParse({
      month: '2026-01',
      week: 'all',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid month format', () => {
    expect(DashboardQueryDTO.safeParse({ month: '2026' }).success).toBe(false);
    expect(DashboardQueryDTO.safeParse({ month: '2026-1' }).success).toBe(false);
  });
});

describe('DeleteByIdDTO', () => {
  it('should accept number IDs', () => {
    const result = DeleteByIdDTO.safeParse({ id: 42 });
    expect(result.success).toBe(true);
  });

  it('should coerce string IDs to numbers', () => {
    const result = DeleteByIdDTO.safeParse({ id: '42' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe(42);
  });

  it('should reject non-positive IDs', () => {
    expect(DeleteByIdDTO.safeParse({ id: 0 }).success).toBe(false);
    expect(DeleteByIdDTO.safeParse({ id: -1 }).success).toBe(false);
  });
});
