/**
 * @fileoverview Drizzle Kit configuration for Turso/libSQL.
 *
 * Configures the migration system, schema location, and database
 * connection for the Drizzle Kit CLI tools (`drizzle-kit generate`,
 * `drizzle-kit migrate`, `drizzle-kit studio`).
 *
 * @module drizzle.config
 */

import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  /** Path to the schema definition files. */
  schema: './src/db/schema/index.ts',

  /** Directory for generated SQL migration files. */
  out: './drizzle/migrations',

  /** Database dialect — SQLite-compatible via Turso/libSQL. */
  dialect: 'turso',

  /** Database connection configuration. */
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },

  /**
   * Enable verbose logging during migration generation.
   * Helpful for debugging schema diff issues.
   */
  verbose: true,

  /**
   * Enable strict mode — fails on ambiguous schema changes
   * that could lead to data loss (e.g., column renames vs. drop+create).
   */
  strict: true,
});
