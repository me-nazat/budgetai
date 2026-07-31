/**
 * @fileoverview One-off migration to consolidate benchmark opt-in data.
 *
 * Backfills the `userDemographics` table from `users.benchmarkOptIn = 1` rows
 * that don't yet have a corresponding `userDemographics` record.
 *
 * Pattern: matches the existing `src/db/migrate-tours.ts` one-off migration style.
 *
 * Usage:
 *   npx tsx src/db/migrate-benchmark-optin.ts
 *
 * @module db/migrate-benchmark-optin
 */

import { db } from '@/db/client';
import { users, userDemographics } from '@/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';

async function main() {
  console.log('[migrate-benchmark-optin] Starting backfill...');

  // Find users with benchmarkOptIn = 1 who lack a userDemographics row
  const optedInUsers = await db
    .select({
      id: users.id,
      ageTier: users.demographicAgeTier,
      region: users.demographicRegion,
    })
    .from(users)
    .where(eq(users.benchmarkOptIn, 1));

  let backfilled = 0;
  let skipped = 0;

  for (const user of optedInUsers) {
    // Check if userDemographics row already exists
    const [existing] = await db
      .select({ userId: userDemographics.userId })
      .from(userDemographics)
      .where(eq(userDemographics.userId, user.id));

    if (existing) {
      skipped++;
      continue;
    }

    // Backfill with user's existing demographic data or defaults
    await db.insert(userDemographics).values({
      userId: user.id,
      ageBracket: user.ageTier || '25-34',
      householdSizeBracket: '1-2', // Default since legacy schema didn't store this
      regionBracket: user.region || 'GLOBAL',
    });

    backfilled++;
  }

  console.log(`[migrate-benchmark-optin] Done. Backfilled: ${backfilled}, Skipped (already had record): ${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[migrate-benchmark-optin] Fatal error:', err);
  process.exit(1);
});
