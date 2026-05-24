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

  /** Secret used to sign JWTs. Must be 32+ characters in production. */
  JWT_SECRET: z
    .string()
    .min(1, 'JWT_SECRET is required')
    .refine(
      (val) => {
        if (process.env.NODE_ENV === 'production') {
          return val.length >= 32 && val !== 'budget-savings-ai-default-secret';
        }
        return true;
      },
      'JWT_SECRET must be at least 32 characters and not the default value in production'
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

    if (process.env.NODE_ENV === 'production') {
      throw new Error(message);
    } else {
      console.warn(message);
    }
  }

  return (result.success ? result.data : serverEnvSchema.parse({
    ...process.env,
    // Provide development fallbacks for optional fields
    JWT_SECRET: process.env.JWT_SECRET || 'wealth-ai-default-secret-dev-only-not-for-production',
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'file:local.db',
  })) as ServerEnv;
}

/** Validated server environment. Import this instead of reading process.env directly. */
export const env = validateEnv();
