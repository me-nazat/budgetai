/**
 * @fileoverview Drizzle ORM client singleton for Turso/libSQL.
 *
 * Provides a single, reusable database connection instance used by all
 * repository classes. The client is lazily initialized on first access
 * and reused for the lifetime of the server process.
 *
 * @security
 * - Database URL and auth token are read from environment variables.
 * - The client is never exposed directly to API routes; all access
 *   goes through the repository layer.
 *
 * @example
 * ```ts
 * import { db } from '@/db/client';
 * import { users } from '@/db/schema';
 * const allUsers = await db.select().from(users);
 * ```
 *
 * @module db/client
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient, type Client } from '@libsql/client';
import * as schema from './schema';
import { env } from '../lib/env';

/**
 * Singleton libSQL client instance.
 * Lazily created on first `getDb()` call.
 */
let libsqlClient: Client | null = null;

/**
 * Creates and returns the libSQL client singleton.
 *
 * @returns {Client} The libSQL client instance.
 *
 * @complexity O(1) — returns cached instance after first call.
 */
function getLibSqlClient(): Client {
  if (!libsqlClient) {
    libsqlClient = createClient({
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
    });
  }
  return libsqlClient;
}

/**
 * Drizzle ORM database instance — the primary entry point for all
 * type-safe database operations.
 *
 * Uses the full schema for type inference, enabling auto-completion
 * and compile-time validation of all queries.
 *
 * @remarks
 * This is a lazy getter that initializes the client on first access.
 * Subsequent accesses return the same instance (singleton pattern).
 *
 * @example
 * ```ts
 * // Type-safe query with auto-completion
 * const user = await db.query.users.findFirst({
 *   where: eq(users.email, 'alice@example.com'),
 * });
 *
 * // Insert with type checking
 * await db.insert(transactions).values({
 *   userId: 1,
 *   type: 'expense',
 *   amount: 42.50,
 *   category: 'Food',
 *   description: 'Lunch',
 * });
 * ```
 */
export const db = drizzle(getLibSqlClient(), { schema });

/**
 * Re-export the schema for convenience.
 * Allows importing both `db` and schema types from a single module.
 */
export { schema };

/**
 * Type alias for the Drizzle database instance.
 * Useful for typing repository constructor parameters.
 */
export type Database = typeof db;
