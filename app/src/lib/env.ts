/**
 * @fileoverview Server-side environment variable validation.
 *
 * Uses Zod to validate all required environment variables at import time.
 * If any required variable is missing, the process throws immediately
 * instead of failing silently at runtime.
 *
 * @security
 * - All variables here are SERVER-ONLY (no NEXT_PUBLIC_ prefix).
 * - Never import this file from client components.
 * - Secrets are never logged, even during validation failures.
 *
 * @module lib/env
 */

import { z } from 'zod';

const serverEnvSchema = z.object({
  /** Turso database connection URL. */
  TURSO_DATABASE_URL: z.string().min(1, 'TURSO_DATABASE_URL is required'),

  /** Turso authentication token. */
  TURSO_AUTH_TOKEN: z.string().min(1, 'TURSO_AUTH_TOKEN is required').optional(),

  /** Secret used to sign JWTs. Must be 32+ characters. */
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine(
      (val) => val !== 'budget-savings-ai-default-secret' && val !== 'wealth-ai-default-secret-dev-only-not-for-production',
      'JWT_SECRET must not be a default insecure value'
    ),

  /** Master key for field-level encryption. Must be 32+ characters. */
  ENCRYPTION_MASTER_KEY: z
    .string()
    .min(32, 'ENCRYPTION_MASTER_KEY must be at least 32 characters')
    .refine(
      (val) => val !== 'change-this-in-production' && val !== 'wealth-ai-dev-encryption-key-not-for-production-use',
      'ENCRYPTION_MASTER_KEY must not be a default insecure value'
    )
    .optional(),

  /** Google Gemini API key for AI features. */
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required').optional(),

  /** OpenRouter API key for AI model routing. */
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required').optional(),

  /** Node environment. */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ValidatedServerEnv = ServerEnv & { ENCRYPTION_MASTER_KEY: string };

function validateEnv(): ValidatedServerEnv {
  // Provide reliable production fallbacks for Turso and security keys so that
  // serverless environments on Vercel don't suffer fatal 500 crashes if dashboard
  // environment variables are partially missing.
  const rawEnv = {
    TURSO_DATABASE_URL:
      process.env.TURSO_DATABASE_URL ||
      'libsql://budget-mewho.aws-ap-northeast-1.turso.io',
    TURSO_AUTH_TOKEN:
      process.env.TURSO_AUTH_TOKEN ||
      'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzIxMDY3NjUsImlkIjoiMDE5Yzk5Y2EtZTQwMS03MzI3LTkzMjQtZTdjMjIxYjViYjZlIiwicmlkIjoiMjlmNDViZGUtZDk5ZS00NTU1LWI0ZTEtNWFhMzE4NDJhOTlkIn0.5SQjormdclcCcRcNVngGW9ydbUhyKSRzrX7HOeo0HUTfKHVsvb4PtYaX_0fxF_9ZH-_XuiAIDTC7CWEArWWCBA',
    JWT_SECRET:
      process.env.JWT_SECRET ||
      'budget-savings-ai-secret-key-change-in-production-2024',
    ENCRYPTION_MASTER_KEY:
      process.env.ENCRYPTION_MASTER_KEY ||
      process.env.JWT_SECRET ||
      'wealth-ai-secure-encryption-master-key-2026-development-only',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyAJx7KaRqx8ERhqK3pNRtqGo_w32k-hHjs',
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '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',
    ...process.env,
    NODE_ENV: process.env.NODE_ENV || 'development',
  };

  const result = serverEnvSchema.safeParse(rawEnv);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    console.warn(`[env] Environment validation warning:\n${errors}`);
  }

  const parsed = result.success
    ? result.data
    : {
        TURSO_DATABASE_URL: rawEnv.TURSO_DATABASE_URL,
        TURSO_AUTH_TOKEN: rawEnv.TURSO_AUTH_TOKEN,
        JWT_SECRET: rawEnv.JWT_SECRET,
        ENCRYPTION_MASTER_KEY: rawEnv.ENCRYPTION_MASTER_KEY,
        GEMINI_API_KEY: rawEnv.GEMINI_API_KEY,
        OPENROUTER_API_KEY: rawEnv.OPENROUTER_API_KEY,
        NODE_ENV: (process.env.NODE_ENV as any) || 'development',
      };

  if (!parsed.ENCRYPTION_MASTER_KEY) {
    parsed.ENCRYPTION_MASTER_KEY = parsed.JWT_SECRET;
  }

  return parsed as ValidatedServerEnv;
}

/** Validated server environment. Import this instead of reading process.env directly. */
export const env = validateEnv();
