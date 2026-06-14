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
    ),

  /** Google Gemini API key for AI features. */
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required').optional(),

  /** OpenRouter API key for AI model routing. */
  OPENROUTER_API_KEY: z.string().min(1, 'OPENROUTER_API_KEY is required').optional(),

  /** Node environment. */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

function validateEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  ✗ ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    // Never log the actual values — only which keys are missing/invalid
    const message = `\n╔══════════════════════════════════════════╗\n║  ENVIRONMENT VALIDATION FAILED           ║\n╚══════════════════════════════════════════╝\n\n${errors}\n\nPlease check your .env.local file or Vercel environment variables.\n`;

    if (process.env.NODE_ENV !== 'test') {
      throw new Error(message);
    }
  }

  return (result.success ? result.data : serverEnvSchema.parse({
    ...process.env,
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'file:local.db',
  })) as ServerEnv;
}

/** Validated server environment. Import this instead of reading process.env directly. */
export const env = validateEnv();
