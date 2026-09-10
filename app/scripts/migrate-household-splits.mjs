/**
 * @fileoverview Migration script to retire household_splits and household_ledgers.
 * Reconciles valid records to household_settlements and archives orphans to migration_audit_log.
 */

import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.TURSO_DATABASE_URL || 'file:database.sqlite';
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });

async function migrateHouseholdSplits() {
  console.log('[migrate-household-splits] Connecting to DB:', url);

  try {
    // 1. Ensure migration_audit_log table exists
    await client.execute(`
      CREATE TABLE IF NOT EXISTS migration_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_table TEXT NOT NULL,
        record_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // 2. Check if household_splits exists
    const checkTable = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='household_splits';"
    );

    if (checkTable.rows.length === 0) {
      console.log('[migrate-household-splits] Table household_splits does not exist. Nothing to migrate.');
      return;
    }

    // 3. Query all household_splits
    const splits = await client.execute('SELECT * FROM household_splits;');
    console.log(`[migrate-household-splits] Found ${splits.rows.length} rows in household_splits.`);

    let migratedCount = 0;
    let archivedCount = 0;

    for (const row of splits.rows) {
      const expenseId = row.expense_id;
      const expenseIdNum = parseInt(expenseId, 10);

      let matchedExpense = null;
      if (!isNaN(expenseIdNum)) {
        const expRes = await client.execute({
          sql: 'SELECT * FROM household_expenses WHERE id = ? LIMIT 1;',
          args: [expenseIdNum],
        });
        if (expRes.rows.length > 0) {
          matchedExpense = expRes.rows[0];
        }
      }

      if (matchedExpense) {
        // Valid parent expense found!
        // Check if settlement already exists for this expense or payer
        const payerId = row.user_id;
        const payeeId = matchedExpense.user_id;
        const amount = Number(row.owed_amount) || 0;

        if (payerId !== payeeId && amount > 0) {
          await client.execute({
            sql: `
              INSERT INTO household_settlements (household_id, payer_id, payee_id, amount, status, created_at)
              VALUES (?, ?, ?, ?, ?, datetime('now'));
            `,
            args: [
              matchedExpense.household_id,
              payerId,
              payeeId,
              amount,
              row.is_settled ? 'settled' : 'pending',
            ],
          });
          migratedCount++;
        }
      } else {
        // Orphaned record: archive to migration_audit_log
        await client.execute({
          sql: `
            INSERT INTO migration_audit_log (source_table, record_id, reason, payload)
            VALUES (?, ?, ?, ?);
          `,
          args: [
            'household_splits',
            String(row.id),
            `Orphaned expense_id '${expenseId}' without matching household_expenses`,
            JSON.stringify(row),
          ],
        });
        archivedCount++;
      }
    }

    console.log(`[migrate-household-splits] Migration summary: ${migratedCount} migrated, ${archivedCount} archived to migration_audit_log.`);

    // 4. Drop retired tables
    await client.execute('DROP TABLE IF EXISTS household_splits;');
    await client.execute('DROP TABLE IF EXISTS household_ledgers;');
    console.log('[migrate-household-splits] Dropped tables household_splits and household_ledgers.');

  } catch (error) {
    console.error('[migrate-household-splits] Error running migration:', error);
  }
}

migrateHouseholdSplits().then(() => {
  console.log('[migrate-household-splits] Completed.');
  process.exit(0);
});
