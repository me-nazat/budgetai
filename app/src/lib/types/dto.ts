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
export const transactionTypeSchema = z.enum(['expense', 'earning'] as const, {
  message: 'Type must be "expense" or "earning"',
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
   TRANSACTION DTOs
   ═══════════════════════════════════════════════════════════════ */

/** Create transaction request body. */
export const CreateTransactionDTO = z.object({
  type: transactionTypeSchema,
  amount: amountSchema,
  category: categorySchema,
  description: descriptionSchema,
  date: optionalDateSchema,
  notes: z.string().max(1000).optional().default(''),
}).strict();
export type CreateTransactionDTO = z.infer<typeof CreateTransactionDTO>;

/** Update transaction request body. */
export const UpdateTransactionDTO = z.object({
  id: z.number().int().positive('Invalid transaction ID'),
  type: transactionTypeSchema,
  amount: amountSchema,
  category: categorySchema,
  description: descriptionSchema,
  date: optionalDateSchema,
  notes: z.string().max(1000).optional().default(''),
}).strict();
export type UpdateTransactionDTO = z.infer<typeof UpdateTransactionDTO>;

/** Transaction query filters. */
export const TransactionQueryDTO = z.object({
  start: dateSchema.optional(),
  end: dateSchema.optional(),
  category: z.string().max(50).optional(),
  type: transactionTypeSchema.optional(),
  limit: paginationLimitSchema,
  offset: paginationOffsetSchema,
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
}).strict();
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
}).strict();
export type CreateBudgetDTO = z.infer<typeof CreateBudgetDTO>;

/** Budget in API responses. */
export const BudgetResponseDTO = z.object({
  id: z.number(),
  category: z.string(),
  monthlyLimit: z.number(),
  month: z.number(),
  year: z.number(),
  spent: z.number().optional(),
  percentage: z.number().optional(),
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
  type: transactionTypeSchema,
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
}).strict();
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
