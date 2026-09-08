/**
 * @fileoverview Comprehensive Idempotent Database Schema Synchronization Script for Turso.
 *
 * Reads all Drizzle migration files in order (0000_... through 0005_...)
 * and applies any missing tables, columns, and indexes to Turso safely and idempotently.
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@libsql/client';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('TURSO_DATABASE_URL is not set.');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function syncAll() {
  console.log('[db:sync] Connecting to Turso:', url);

  const migrationsDir = path.resolve('drizzle/migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  console.log('[db:sync] Found migration files:', files);

  // Helper to get current tables
  async function getExistingTables() {
    const masterRes = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
    return new Set(masterRes.rows.map((r) => r.name));
  }

  // Helper to get current columns for a table
  async function getColumns(tableName) {
    try {
      const colRes = await client.execute(`PRAGMA table_info(\`${tableName}\`);`);
      return new Set(colRes.rows.map((r) => r.name));
    } catch {
      return new Set();
    }
  }

  let existingTables = await getExistingTables();
  let totalCreatedTables = 0;
  let totalAddedColumns = 0;
  let totalCreatedIndexes = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const rawSql = fs.readFileSync(fullPath, 'utf8');
    const statements = rawSql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    console.log(`\n--- Processing ${file} (${statements.length} statements) ---`);

    for (const stmt of statements) {
      // 1. CREATE TABLE
      const createTableMatch = stmt.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?`?([a-zA-Z0-9_]+)`?/i);
      if (createTableMatch && stmt.toUpperCase().startsWith('CREATE TABLE')) {
        const tableName = createTableMatch[1];
        if (existingTables.has(tableName)) {
          totalSkipped++;
          continue;
        }

        const safeStmt = stmt.replace(/CREATE TABLE\s+`?([a-zA-Z0-9_]+)`?/i, 'CREATE TABLE IF NOT EXISTS `$1`');
        try {
          await client.execute(safeStmt);
          existingTables.add(tableName);
          totalCreatedTables++;
          console.log(`  + Created table: ${tableName}`);
        } catch (err) {
          console.error(`  x Failed to create table ${tableName}:`, err.message);
        }
        continue;
      }

      // 2. ALTER TABLE ... ADD
      const alterTableMatch = stmt.match(/ALTER TABLE\s+`?([a-zA-Z0-9_]+)`?\s+ADD(?:\s+COLUMN)?\s+`?([a-zA-Z0-9_]+)`?(.*)/i);
      if (alterTableMatch) {
        const tableName = alterTableMatch[1];
        const colName = alterTableMatch[2];
        const rest = alterTableMatch[3];

        if (!existingTables.has(tableName)) {
          console.warn(`  ! Table ${tableName} does not exist yet for ALTER TABLE.`);
          continue;
        }

        const cols = await getColumns(tableName);
        if (cols.has(colName)) {
          totalSkipped++;
          continue;
        }

        const alterSql = `ALTER TABLE \`${tableName}\` ADD COLUMN \`${colName}\` ${rest}`;
        try {
          await client.execute(alterSql);
          totalAddedColumns++;
          console.log(`  + Added column: ${tableName}.${colName}`);
        } catch (err) {
          console.error(`  x Failed to add column ${tableName}.${colName}:`, err.message);
        }
        continue;
      }

      // 3. CREATE INDEX
      const createIndexMatch = stmt.match(/CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF NOT EXISTS\s+)?`?([a-zA-Z0-9_]+)`?\s+ON\s+`?([a-zA-Z0-9_]+)`?/i);
      if (createIndexMatch) {
        const isUnique = /CREATE\s+UNIQUE\s+INDEX/i.test(stmt);
        const safeStmt = stmt.replace(
          /CREATE\s+(?:UNIQUE\s+)?INDEX\s+`?([a-zA-Z0-9_]+)`?/i,
          `CREATE ${isUnique ? 'UNIQUE ' : ''}INDEX IF NOT EXISTS \`$1\``
        );
        try {
          await client.execute(safeStmt);
          totalCreatedIndexes++;
        } catch (err) {
          totalSkipped++;
        }
        continue;
      }

      // Other statements
      try {
        await client.execute(stmt);
      } catch (err) {
        // Safe to ignore or log
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`[db:sync] Final Result:`);
  console.log(`  Tables created:  ${totalCreatedTables}`);
  console.log(`  Columns added:   ${totalAddedColumns}`);
  console.log(`  Indexes created: ${totalCreatedIndexes}`);
  console.log(`  Items skipped:   ${totalSkipped}`);
  console.log(`======================================================\n`);
}

syncAll().catch(console.error);
