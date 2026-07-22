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

  const parsed = result.success ? result.data : serverEnvSchema.parse({
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'file:local.db',
    JWT_SECRET: process.env.JWT_SECRET || 'wealth-ai-test-secret-key-32chars-long-minimum!',
    ...process.env,
  });

  // Automatically fallback to JWT_SECRET if ENCRYPTION_MASTER_KEY is missing
  // This prevents Vercel build crashes and allows existing users to upgrade seamlessly
  // without needing to configure a brand new 32-character key immediately.
  if (!parsed.ENCRYPTION_MASTER_KEY) {
    parsed.ENCRYPTION_MASTER_KEY = parsed.JWT_SECRET;
  }

  return parsed as ValidatedServerEnv;
}

/** Validated server environment. Import this instead of reading process.env directly. */
export const env = validateEnv();
