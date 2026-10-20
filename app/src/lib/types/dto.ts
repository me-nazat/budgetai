/**
 * @fileoverview Zod schemas and Data Transfer Objects (DTOs) for the Wealth AI API.
 *
 * Every API input and output passes through these schemas for 100% type-safe
 * validation. Zod schemas serve as both runtime validators and TypeScript
 * type generators via `z.infer<>`.
 *
 * ## Design Principles
 * - Every API endpoint has dedicated input and output schemas.
 * - Shared constraints (email, amount, date) are defined as base schemas.
 * - Output schemas strip sensitive fields (password_hash, tokens, etc.).
 * - All schemas include descriptive error messages.
 *
 * @module lib/types/dto
 */

import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════
   BASE SCHEMAS — Reusable Constraints
   ═══════════════════════════════════════════════════════════════ */

/** Valid email address with length limit. */
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(100, 'Email must be at most 100 characters')
  .transform((val) => val.trim().toLowerCase());

/** Password with minimum and maximum length constraints. */
export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(128, 'Password must be at most 128 characters');

/** User display name with sanitization. */
export const nameSchema = z
  .string()
  .min(1, 'Name is required')
  .max(100, 'Name must be at most 100 characters')
  .transform((val) => val.trim().replace(/\s+/g, ' '));

/**
 * Positive financial amount with upper bound.
 * Accepts both numbers and numeric strings.
 */
export const amountSchema = z
  .union([z.number(), z.string().transform(Number)])
  .pipe(
    z.number()
      .positive('Amount must be a positive number')
      .max(999_999_999, 'Amount must not exceed 999,999,999')
      .finite('Amount must be a finite number')
  );

/** Transaction type enum. */
export const transactionTypeSchema = z.enum(['expense', 'earning', 'transfer'] as const, {
  message: 'Type must be "expense", "earning", or "transfer"',
});

/** Date string in YYYY-MM-DD format with validation. */
export const dateSchema = z
  .string()
  .regex(
    /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    'Date must be in YYYY-MM-DD format'
  )
  .refine(
    (date) => !isNaN(new Date(date + 'T00:00:00Z').getTime()),
    'Date must be a valid calendar date'
  );

/** Optional date with fallback to today. */
export const optionalDateSchema = dateSchema.optional().default(
  () => new Date().toISOString().split('T')[0]
);

/** Category name with sanitization. */
export const categorySchema = z
  .string()
  .max(50, 'Category name must be at most 50 characters')
  .transform((val) => val.trim().replace(/\s+/g, ' ') || 'Other')
  .default('Other');

/** Description text with sanitization. */
export const descriptionSchema = z
  .string()
  .max(500, 'Description must be at most 500 characters')
  .transform((val) => val.trim().replace(/\s+/g, ' '))
  .default('');

/** Recurrence frequency enum. */
export const frequencySchema = z.enum(['weekly', 'monthly', 'yearly'] as const, {
  message: 'Frequency must be "weekly", "monthly", or "yearly"',
});

/** Pagination limit with bounds clamping. */
export const paginationLimitSchema = z
  .union([z.number(), z.string().transform(Number)])
  .pipe(z.number().int().min(1).max(500))
  .default(100);

/** Pagination offset (non-negative integer). */
export const paginationOffsetSchema = z
  .union([z.number(), z.string().transform(Number)])
  .pipe(z.number().int().min(0))
  .default(0);

/**
 * Set of ISO 4217 currency codes allowed by the application.
 * Prevents SSRF via the exchange rate API.
 */
export const ALLOWED_CURRENCIES = new Set([
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'NZD',
  'SEK', 'KRW', 'SGD', 'NOK', 'MXN', 'INR', 'RUB', 'ZAR', 'TRY', 'BRL',
  'TWD', 'DKK', 'PLN', 'THB', 'IDR', 'HUF', 'CZK', 'ILS', 'CLP', 'PHP',
  'AED', 'COP', 'SAR', 'MYR', 'RON', 'BGN', 'ARS', 'NGN', 'EGP', 'PKR',
  'BDT', 'VND', 'UAH', 'KZT', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LKR',
  'MMK', 'NPR', 'GHS', 'KES', 'UGX', 'TZS', 'MAD', 'XOF', 'XAF',
]);

export const currencySchema = z
  .string()
  .length(3, 'Currency code must be 3 characters')
  .transform((val) => val.toUpperCase())
  .refine(
    (val) => ALLOWED_CURRENCIES.has(val),
    'Unsupported currency code'
  );

/* ═══════════════════════════════════════════════════════════════
   AUTH DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Login request body. */
export const LoginDTO = z.object({
  email: emailSchema,
  password: passwordSchema,
  /** Optional TOTP code for 2FA-enabled accounts. */
  totpCode: z.string().length(6, 'TOTP code must be 6 digits').optional(),
  rememberMe: z.boolean().optional(),
}).strict();
export type LoginDTO = z.infer<typeof LoginDTO>;

/** Registration request body. */
export const RegisterDTO = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
}).strict();
export type RegisterDTO = z.infer<typeof RegisterDTO>;

/** User profile in API responses (excludes sensitive fields). */
export const UserProfileDTO = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  currency: z.string().default('BDT'),
  notify_budget: z.number().default(1),
  notify_overspend: z.number().default(1),
  totpEnabled: z.boolean().default(false),
  createdAt: z.string().optional(),
}).strict();
export type UserProfileDTO = z.infer<typeof UserProfileDTO>;

/** 2FA setup request. */
export const TwoFactorSetupDTO = z.object({
  /** The TOTP code to verify the setup is correct. */
  verificationCode: z.string().length(6, 'Verification code must be 6 digits'),
}).strict();
export type TwoFactorSetupDTO = z.infer<typeof TwoFactorSetupDTO>;

/** 2FA verification during login. */
export const TwoFactorVerifyDTO = z.object({
  /** Temporary auth token from the initial login step. */
  tempToken: z.string().min(1, 'Temporary token is required'),
  /** TOTP code or backup code. */
  code: z.string().min(1, 'Code is required'),
  /** Whether this is a backup code (longer format). */
  isBackupCode: z.boolean().default(false),
}).strict();
export type TwoFactorVerifyDTO = z.infer<typeof TwoFactorVerifyDTO>;

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Create account request body. */
export const CreateAccountDTO = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  type: z.enum(['cash', 'bank', 'card', 'mobile_wallet', 'other'] as const),
  currency: z.string().min(3).max(3).default('BDT'),
  openingBalance: z.number().default(0),
  colorTag: z.string().default('#136dec'),
  creditLimit: z.number().positive().nullable().optional(),
  statementClosingDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDueDate: z.number().int().min(1).max(31).nullable().optional(),
  apr: z.number().min(0).max(100).nullable().optional(),
}).strict();
export type CreateAccountDTO = z.infer<typeof CreateAccountDTO>;

/** Update account request body. */
export const UpdateAccountDTO = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['cash', 'bank', 'card', 'mobile_wallet', 'other'] as const).optional(),
  currency: z.string().min(3).max(3).optional(),
  colorTag: z.string().optional(),
  isArchived: z.boolean().optional(),
  creditLimit: z.number().positive().nullable().optional(),
  statementClosingDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDueDate: z.number().int().min(1).max(31).nullable().optional(),
  apr: z.number().min(0).max(100).nullable().optional(),
}).strict();
export type UpdateAccountDTO = z.infer<typeof UpdateAccountDTO>;

/* ═══════════════════════════════════════════════════════════════
   TRANSACTION DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Single item within a split-category transaction. */
export const TransactionSplitItemDTO = z.object({
  id: z.string(),
  category: z.string().min(1).max(50),
  amount: z.number().positive(),
  note: z.string().max(255).optional(),
  isTaxDeductible: z.boolean().optional(),
});
export type TransactionSplitItemDTO = z.infer<typeof TransactionSplitItemDTO>;

/** Create transaction request body. */
export const CreateTransactionDTO = z.object({
  type: transactionTypeSchema,
  amount: amountSchema,
  category: categorySchema.optional().default('Other'),
  description: descriptionSchema.optional().default(''),
  date: optionalDateSchema,
  notes: z.string().max(1000).optional().default(''),
  accountId: z.number().int().positive().optional().nullable(),
  toAccountId: z.number().int().positive().optional().nullable(),
  splits: z.array(TransactionSplitItemDTO).optional(),
  splitItemsJson: z.union([z.string(), z.array(TransactionSplitItemDTO)]).optional().nullable(),
  isSplit: z.union([z.boolean(), z.number()]).optional(),
  merchantNormalized: z.string().optional().nullable(),
  status: z.enum(['cleared', 'pending', 'reconciled'] as const).optional().default('cleared'),
  clientMutationId: z.string().optional().nullable(),
  taxDeductible: z.union([z.boolean(), z.number()]).optional(),
  taxSuggested: z.number().optional(),
  attachments: z.string().optional().nullable(),
  receipt_image: z.string().optional().nullable(),
  personalShareAmount: z.number().optional().nullable(),
  reimbursementStatus: z.enum(['none', 'receivable', 'payable', 'settled'] as const).optional().nullable(),
  collaborativeSourceType: z.enum(['tour', 'household', 'bill_split'] as const).optional().nullable(),
  collaborativeSourceId: z.string().optional().nullable(),
  collaborativeExpenseId: z.string().optional().nullable(),
  isSettlementTransfer: z.union([z.boolean(), z.number()]).optional().nullable(),
}).refine(
  (data) => {
    let splitList = data.splits;
    if (!splitList && data.splitItemsJson) {
      try {
        splitList = typeof data.splitItemsJson === 'string' ? JSON.parse(data.splitItemsJson) : data.splitItemsJson;
      } catch {
        return false;
      }
    }
    if (splitList && splitList.length > 0) {
      const splitTotal = splitList.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const target = data.personalShareAmount ?? data.amount;
      return Math.abs(splitTotal - target) <= 0.01;
    }
    return true;
  },
  {
    message: 'Sum of split amounts must equal the transaction amount (within 0.01 tolerance)',
    path: ['splits'],
  }
);
export type CreateTransactionDTO = z.infer<typeof CreateTransactionDTO>;

/** Update transaction request body. */
export const UpdateTransactionDTO = z.object({
  id: z.number().int().positive('Invalid transaction ID'),
  type: transactionTypeSchema,
  amount: amountSchema,
  category: categorySchema.optional().default('Other'),
  description: descriptionSchema.optional().default(''),
  date: optionalDateSchema,
  notes: z.string().max(1000).optional().default(''),
  accountId: z.number().int().positive().optional().nullable(),
  toAccountId: z.number().int().positive().optional().nullable(),
  splits: z.array(TransactionSplitItemDTO).optional(),
  splitItemsJson: z.union([z.string(), z.array(TransactionSplitItemDTO)]).optional().nullable(),
  isSplit: z.union([z.boolean(), z.number()]).optional(),
  merchantNormalized: z.string().optional().nullable(),
  status: z.enum(['cleared', 'pending', 'reconciled'] as const).optional(),
  clientMutationId: z.string().optional().nullable(),
  taxDeductible: z.union([z.boolean(), z.number()]).optional(),
  taxSuggested: z.number().optional(),
  attachments: z.string().optional().nullable(),
  receipt_image: z.string().optional().nullable(),
  personalShareAmount: z.number().optional().nullable(),
  reimbursementStatus: z.enum(['none', 'receivable', 'payable', 'settled'] as const).optional().nullable(),
  collaborativeSourceType: z.enum(['tour', 'household', 'bill_split'] as const).optional().nullable(),
  collaborativeSourceId: z.string().optional().nullable(),
  collaborativeExpenseId: z.string().optional().nullable(),
  isSettlementTransfer: z.union([z.boolean(), z.number()]).optional().nullable(),
}).refine(
  (data) => {
    let splitList = data.splits;
    if (!splitList && data.splitItemsJson) {
      try {
        splitList = typeof data.splitItemsJson === 'string' ? JSON.parse(data.splitItemsJson) : data.splitItemsJson;
      } catch {
        return false;
      }
    }
    if (splitList && splitList.length > 0) {
      const splitTotal = splitList.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const target = data.personalShareAmount ?? data.amount;
      return Math.abs(splitTotal - target) <= 0.01;
    }
    return true;
  },
  {
    message: 'Sum of split amounts must equal the total transaction amount (within 0.01 tolerance)',
    path: ['splits'],
  }
);
export type UpdateTransactionDTO = z.infer<typeof UpdateTransactionDTO>;

/** Patch transaction request body for inline cell editing. */
export const PatchTransactionDTO = z.object({
  id: z.number().int().positive('Invalid transaction ID'),
  type: transactionTypeSchema.optional(),
  amount: amountSchema.optional(),
  category: categorySchema.optional(),
  description: descriptionSchema.optional(),
  date: dateSchema.optional(),
  notes: z.string().max(1000).optional(),
  accountId: z.number().int().positive().optional().nullable(),
  toAccountId: z.number().int().positive().optional().nullable(),
  splits: z.array(TransactionSplitItemDTO).optional(),
  splitItemsJson: z.union([z.string(), z.array(TransactionSplitItemDTO)]).optional().nullable(),
  isSplit: z.union([z.boolean(), z.number()]).optional(),
  merchantNormalized: z.string().optional().nullable(),
  status: z.enum(['cleared', 'pending', 'reconciled'] as const).optional(),
  taxDeductible: z.union([z.boolean(), z.number()]).optional(),
  taxSuggested: z.number().optional(),
  attachments: z.string().optional().nullable(),
  personalShareAmount: z.number().optional().nullable(),
  reimbursementStatus: z.enum(['none', 'receivable', 'payable', 'settled'] as const).optional().nullable(),
  collaborativeSourceType: z.enum(['tour', 'household', 'bill_split'] as const).optional().nullable(),
  collaborativeSourceId: z.string().optional().nullable(),
  collaborativeExpenseId: z.string().optional().nullable(),
  isSettlementTransfer: z.union([z.boolean(), z.number()]).optional().nullable(),
}).refine(
  (data) => {
    let splitList = data.splits;
    if (!splitList && data.splitItemsJson) {
      try {
        splitList = typeof data.splitItemsJson === 'string' ? JSON.parse(data.splitItemsJson) : data.splitItemsJson;
      } catch {
        return false;
      }
    }
    if (splitList && splitList.length > 0 && data.amount !== undefined) {
      const splitTotal = splitList.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
      const target = data.personalShareAmount ?? data.amount;
      return Math.abs(splitTotal - target) <= 0.01;
    }
    return true;
  },
  {
    message: 'Sum of split amounts must equal the transaction amount (within 0.01 tolerance)',
    path: ['splits'],
  }
);
export type PatchTransactionDTO = z.infer<typeof PatchTransactionDTO>;

/** Transaction query filters. */
export const TransactionQueryDTO = z.object({
  start: dateSchema.optional(),
  end: dateSchema.optional(),
  category: z.string().max(50).optional(),
  type: transactionTypeSchema.optional(),
  limit: paginationLimitSchema,
  offset: paginationOffsetSchema,
  accountId: z.union([z.number(), z.string().transform(Number)]).pipe(z.number().int().positive()).optional(),
}).strict();
export type TransactionQueryDTO = z.infer<typeof TransactionQueryDTO>;

/** Single transaction in API responses. */
export const TransactionResponseDTO = z.object({
  id: z.number(),
  type: z.string(),
  amount: z.number(),
  category: z.string(),
  description: z.string(),
  date: z.string(),
  createdAt: z.string().optional(),
  accountId: z.number().optional().nullable(),
  toAccountId: z.number().optional().nullable(),
  splits: z.array(TransactionSplitItemDTO).optional().nullable(),
  splitItemsJson: z.union([z.string(), z.array(TransactionSplitItemDTO)]).optional().nullable(),
  isSplit: z.union([z.number(), z.boolean()]).optional().nullable(),
  merchantNormalized: z.string().optional().nullable(),
  status: z.enum(['cleared', 'pending', 'reconciled'] as const).optional(),
  notes: z.string().optional().nullable(),
  taxDeductible: z.union([z.number(), z.boolean()]).optional(),
  taxSuggested: z.number().optional(),
  transferGroupId: z.string().optional().nullable(),
  attachments: z.string().optional().nullable(),
  personalShareAmount: z.number().optional().nullable(),
  reimbursementStatus: z.enum(['none', 'receivable', 'payable', 'settled'] as const).optional().nullable(),
  collaborativeSourceType: z.enum(['tour', 'household', 'bill_split'] as const).optional().nullable(),
  collaborativeSourceId: z.string().optional().nullable(),
  collaborativeExpenseId: z.string().optional().nullable(),
  isSettlementTransfer: z.union([z.number(), z.boolean()]).optional().nullable(),
  clientMutationId: z.string().optional().nullable(),
});
export type TransactionResponseDTO = z.infer<typeof TransactionResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   BUDGET DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Create or update budget request body. */
export const CreateBudgetDTO = z.object({
  category: categorySchema,
  monthlyLimit: amountSchema,
  month: z.number().int().min(1).max(12, 'Month must be 1–12'),
  year: z.number().int().min(2000).max(2100, 'Invalid year'),
  rolloverEnabled: z.boolean().optional().default(false),
  rolloverBalance: z.number().optional().default(0),
}).strict();
export type CreateBudgetDTO = z.infer<typeof CreateBudgetDTO>;

/** Rebalance budget envelopes without altering total allocated amount. */
export const RebalanceBudgetsDTO = z.object({
  fromBudgetId: z.number().int().positive('Source budget required'),
  toBudgetId: z.number().int().positive('Destination budget required'),
  amount: amountSchema,
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
}).strict();
export type RebalanceBudgetsDTO = z.infer<typeof RebalanceBudgetsDTO>;

/** Budget in API responses with auto-pacing and rollover details. */
export const BudgetResponseDTO = z.object({
  id: z.number(),
  category: z.string(),
  monthlyLimit: z.number(),
  month: z.number(),
  year: z.number(),
  spent: z.number().optional(),
  percentage: z.number().optional(),
  rolloverEnabled: z.boolean().optional(),
  rolloverBalance: z.number().optional(),
  effectiveLimit: z.number().optional(),
  remaining: z.number().optional(),
  idealDailyBurn: z.number().optional(),
  actualDailyBurn: z.number().optional(),
  pacingStatus: z.enum(['on_track', 'pacing_fast', 'exhausted']).optional(),
  pacingDeltaPercent: z.number().optional(),
  projectedMonthEndSpend: z.number().optional(),
  daysRemaining: z.number().optional(),
}).strict();
export type BudgetResponseDTO = z.infer<typeof BudgetResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   NET WORTH DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Create net worth entry request body. */
export const CreateNetWorthDTO = z.object({
  amount: amountSchema,
  note: descriptionSchema,
}).strict();
export type CreateNetWorthDTO = z.infer<typeof CreateNetWorthDTO>;

/** Net worth entry in API responses. */
export const NetWorthResponseDTO = z.object({
  id: z.number(),
  amount: z.number(),
  note: z.string(),
  createdAt: z.string().optional(),
}).strict();
export type NetWorthResponseDTO = z.infer<typeof NetWorthResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   SAVINGS GOAL DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Create savings goal request body. */
export const CreateGoalDTO = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  targetAmount: amountSchema,
  savedAmount: amountSchema.optional().default(0),
  deadline: dateSchema.optional(),
}).strict();
export type CreateGoalDTO = z.infer<typeof CreateGoalDTO>;

/** Update savings goal request body. */
export const UpdateGoalDTO = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(100).optional(),
  targetAmount: amountSchema.optional(),
  savedAmount: amountSchema.optional(),
  deadline: dateSchema.optional().nullable(),
}).strict();
export type UpdateGoalDTO = z.infer<typeof UpdateGoalDTO>;

/** Savings goal in API responses. */
export const GoalResponseDTO = z.object({
  id: z.number(),
  name: z.string(),
  targetAmount: z.number(),
  savedAmount: z.number(),
  deadline: z.string().nullable().optional(),
  progress: z.number().optional(),
  createdAt: z.string().optional(),
}).strict();
export type GoalResponseDTO = z.infer<typeof GoalResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   RECURRING TRANSACTION DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Create recurring transaction request body. */
export const CreateRecurringDTO = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  type: z.enum(['expense', 'earning'] as const),
  amount: amountSchema,
  category: categorySchema,
  frequency: frequencySchema,
  nextDate: optionalDateSchema,
}).strict();
export type CreateRecurringDTO = z.infer<typeof CreateRecurringDTO>;

/** Recurring transaction in API responses. */
export const RecurringResponseDTO = z.object({
  id: z.number(),
  name: z.string(),
  type: z.string(),
  amount: z.number(),
  category: z.string(),
  frequency: z.string(),
  nextDate: z.string(),
  active: z.number(),
  createdAt: z.string().optional(),
}).strict();
export type RecurringResponseDTO = z.infer<typeof RecurringResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   SUBSCRIPTION INTELLIGENCE DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Create subscription request body. */
export const CreateSubscriptionDTO = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  amount: amountSchema,
  currency: z.string().min(3).max(3).optional().default('BDT'),
  billingCycle: z.enum(['weekly', 'monthly', 'yearly'] as const).default('monthly'),
  nextRenewalDate: z.string().min(10, 'Renewal date required'),
  category: categorySchema.optional().default('Other'),
  logoUrl: z.string().optional().nullable(),
  isActive: z.union([z.boolean(), z.number()]).optional().default(1),
  trialEndsAt: z.string().optional().nullable(),
  previousAmount: z.number().optional().nullable(),
  accountId: z.number().int().positive().optional().nullable(),
  cancelReminderDays: z.number().int().min(0).max(30).optional().default(3),
}).strict();
export type CreateSubscriptionDTO = z.infer<typeof CreateSubscriptionDTO>;

/** Update subscription request body. */
export const UpdateSubscriptionDTO = z.object({
  name: z.string().min(1).max(100).optional(),
  amount: amountSchema.optional(),
  currency: z.string().min(3).max(3).optional(),
  billingCycle: z.enum(['weekly', 'monthly', 'yearly'] as const).optional(),
  nextRenewalDate: z.string().optional(),
  category: categorySchema.optional(),
  logoUrl: z.string().optional().nullable(),
  isActive: z.union([z.boolean(), z.number()]).optional(),
  trialEndsAt: z.string().optional().nullable(),
  previousAmount: z.number().optional().nullable(),
  accountId: z.number().int().positive().optional().nullable(),
  cancelReminderDays: z.number().int().min(0).max(30).optional(),
}).strict();
export type UpdateSubscriptionDTO = z.infer<typeof UpdateSubscriptionDTO>;

/** Subscription intelligence response DTO. */
export const SubscriptionResponseDTO = z.object({
  id: z.number(),
  name: z.string(),
  amount: z.number(),
  currency: z.string(),
  billingCycle: z.enum(['weekly', 'monthly', 'yearly']),
  nextRenewalDate: z.string(),
  category: z.string(),
  logoUrl: z.string().nullable().optional(),
  isActive: z.number(),
  trialEndsAt: z.string().nullable().optional(),
  previousAmount: z.number().nullable().optional(),
  accountId: z.number().nullable().optional(),
  cancelReminderDays: z.number().optional(),
  createdAt: z.string().optional(),
  priceHikeAlert: z.object({
    detected: z.boolean(),
    previousAmount: z.number(),
    currentAmount: z.number(),
    delta: z.number(),
    percentageIncrease: z.number(),
    lastChargedDate: z.string().optional(),
  }).optional(),
  daysUntilRenewal: z.number().optional(),
  trialCountdownDays: z.number().nullable().optional(),
  monthlyNormalizedAmount: z.number().optional(),
  annualNormalizedAmount: z.number().optional(),
}).strict();
export type SubscriptionResponseDTO = z.infer<typeof SubscriptionResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATION DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Notification in API responses. */
export const NotificationResponseDTO = z.object({
  id: z.number(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  read: z.number(),
  createdAt: z.string().optional(),
}).strict();
export type NotificationResponseDTO = z.infer<typeof NotificationResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   SETTINGS DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Update user settings request body. */
export const UpdateSettingsDTO = z.object({
  name: nameSchema.optional(),
  currency: currencySchema.optional(),
  notifyBudget: z.union([z.number(), z.boolean()]).transform((v) => (v ? 1 : 0)).optional(),
  notifyOverspend: z.union([z.number(), z.boolean()]).transform((v) => (v ? 1 : 0)).optional(),
}).strict();
export type UpdateSettingsDTO = z.infer<typeof UpdateSettingsDTO>;

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Dashboard query parameters. */
export const DashboardQueryDTO = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  week: z.string().default('all'),
}).strict();
export type DashboardQueryDTO = z.infer<typeof DashboardQueryDTO>;

/** Safe to Spend breakdown schema. */
export const SafeToSpendDTO = z.object({
  safeToSpendTotal: z.number(),
  dailySafeAllowance: z.number(),
  daysRemaining: z.number(),
  liquidCash: z.number(),
  upcomingCommittedBills: z.number(),
  remainingBudgetReservations: z.number(),
  creditCardCurrentBalance: z.number(),
});
export type SafeToSpendDTO = z.infer<typeof SafeToSpendDTO>;

/** Spending velocity pace schema. */
export const SpendingPaceDTO = z.object({
  currentMonthSpendToDate: z.number(),
  previousMonthSpendSameDay: z.number(),
  paceDeltaPercent: z.number(),
  projectedMonthEndSpend: z.number(),
  dayOfMonth: z.number(),
  daysInMonth: z.number(),
  monthElapsedPercent: z.number(),
  budgetConsumedPercent: z.number(),
});
export type SpendingPaceDTO = z.infer<typeof SpendingPaceDTO>;

/** Accounts & Liquidity summary schema. */
export const AccountsSummaryDTO = z.object({
  totalAssets: z.number(),
  totalLiabilities: z.number(),
  netWorth: z.number(),
  assetToLiabilityRatio: z.number(),
  liquidCash: z.number(),
  liquidRatio: z.number(),
  accounts: z.array(z.object({
    id: z.number(),
    name: z.string(),
    type: z.string(),
    currency: z.string(),
    currentBalance: z.number(),
    balance: z.number(),
    isLiability: z.boolean(),
    colorTag: z.string(),
    isArchived: z.number(),
  })),
});
export type AccountsSummaryDTO = z.infer<typeof AccountsSummaryDTO>;

/** Financial Health Score schema. */
export const HealthScoreDTO = z.object({
  score: z.number(),
  grade: z.string(),
  pillars: z.object({
    savingsRate: z.object({ score: z.number(), max: z.number(), action: z.string() }),
    budgetAdherence: z.object({ score: z.number(), max: z.number(), action: z.string() }),
    emergencyRunway: z.object({ score: z.number(), max: z.number(), action: z.string() }),
    debtLoad: z.object({ score: z.number(), max: z.number(), action: z.string() }),
  }),
  breakdown: z.record(z.string(), z.any()).optional(),
  history: z.array(z.object({ month: z.string(), score: z.number() })).optional(),
  insight: z.string().optional(),
});
export type HealthScoreDTO = z.infer<typeof HealthScoreDTO>;

/** Dashboard data response. */
export const DashboardResponseDTO = z.object({
  expenses: z.object({
    current: z.number(),
    change: z.number(),
  }),
  earnings: z.object({
    current: z.number(),
    change: z.number(),
  }),
  netSavings: z.number(),
  balance: z.number(),
  categorySpending: z.array(z.object({
    category: z.string(),
    total: z.number(),
  })),
  dailySpending: z.array(z.object({
    date: z.string(),
    expenses: z.number(),
    earnings: z.number(),
  })),
  recentTransactions: z.array(TransactionResponseDTO),
  budgetAlerts: z.array(z.object({
    category: z.string(),
    limit: z.number(),
    spent: z.number(),
    percentage: z.number(),
  })),
  netWorth: z.number(),
  safeToSpend: SafeToSpendDTO.optional(),
  spendingPace: SpendingPaceDTO.optional(),
  accountsSummary: AccountsSummaryDTO.optional(),
  healthScore: HealthScoreDTO.optional(),
  totalTransactions: z.number().optional(),
}).passthrough();
export type DashboardResponseDTO = z.infer<typeof DashboardResponseDTO>;

/* ═══════════════════════════════════════════════════════════════
   GENERIC API ENVELOPE
   ═══════════════════════════════════════════════════════════════ */

/** Paginated response wrapper. */
export const PaginatedResponseDTO = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number(),
    limit: z.number(),
    offset: z.number(),
    hasMore: z.boolean(),
  }).strict();

/** Delete by ID request (query parameter). */
export const DeleteByIdDTO = z.object({
  id: z.union([z.number(), z.string().transform(Number)])
    .pipe(z.number().int().positive('Invalid ID')),
}).strict();
export type DeleteByIdDTO = z.infer<typeof DeleteByIdDTO>;
