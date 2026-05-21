/*
 * ============================================
 * BUDGET & SAVINGS AI — Feature List
 * ============================================
 * 1.  User Authentication (register, login, logout, JWT sessions)
 * 2.  AI Chat Assistant (natural language expense/earning input)
 * 3.  Chat/Silent Mode Toggle (conversational vs storage-only)
 * 4.  Auto-categorization of financial entries via AI
 * 5.  Date-range queries via natural language ("last week", "last month", etc.)
 * 6.  Financial Dashboard with charts and summary cards
 * 7.  Expenses & Earnings table with filtering/sorting
 * 8.  Budget Planner with monthly category limits
 * 9.  Report Generation (PDF + Excel) from chat or reports page
 * 10. Chat History Archive with full transcript view
 * 11. Net Worth Tracker with historical entries
 * 12. Budget Notifications & Alerts
 * 13. Profile Settings (name, currency, notification prefs)
 * 14. Light/Dark Theme Toggle with persistence
 * 15. Responsive design for desktop and mobile
 * 16. Data export (Excel/CSV) from any section
 * 17. Recurring transaction detection hints
 * 18. AI-powered budget optimization suggestions
 * ============================================
 */

import { createClient, type Client, type InValue } from '@libsql/client';

let client: Client | null = null;
let initialized = false;

function getClient(): Client {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error('TURSO_DATABASE_URL environment variable is not set. Please add it to your environment variables.');
    }
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return client;
}

export async function ensureDbInitialized(): Promise<void> {
  if (initialized) return;
  const c = getClient();

  await c.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      currency TEXT DEFAULT 'USD',
      notify_budget INTEGER DEFAULT 1,
      notify_overspend INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'earning')),
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL DEFAULT (date('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      mode TEXT DEFAULT 'chat' CHECK(mode IN ('chat', 'silent')),
      session_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      monthly_limit REAL NOT NULL,
      month INTEGER NOT NULL,
      year INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, category, month, year)
    )`,
    `CREATE TABLE IF NOT EXISTS net_worth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      saved_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'earning')),
      amount REAL NOT NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      frequency TEXT NOT NULL DEFAULT 'monthly' CHECK(frequency IN ('weekly', 'monthly', 'yearly')),
      next_date TEXT NOT NULL DEFAULT (date('now')),
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS custom_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'earning')),
      icon TEXT DEFAULT 'category',
      color TEXT DEFAULT 'gray',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, name, type)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(user_id, date)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(user_id, session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id, month, year)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)`,
    `CREATE INDEX IF NOT EXISTS idx_savings_goals_user ON savings_goals(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_custom_categories_user ON custom_categories(user_id)`,
  ], 'write');

  try {
    await getClient().execute('ALTER TABLE transactions ADD COLUMN notes TEXT DEFAULT \'\' ');
  } catch {
    // Ignore if column already exists
  }

  initialized = true;
}

// Helper: convert libSQL row (which may be array-like) to a plain object
function rowToObject(row: Record<string, unknown>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    // Skip numeric keys from array-like rows
    if (/^\d+$/.test(key)) continue;
    const val = row[key];
    // Convert BigInt to Number for JSON serialization
    obj[key] = typeof val === 'bigint' ? Number(val) : val;
  }
  return obj;
}

// Helper query functions (async)
export async function queryAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureDbInitialized();
  const result = await getClient().execute({ sql, args: params as InValue[] });
  return result.rows.map(row => rowToObject(row as unknown as Record<string, unknown>) as T);
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  await ensureDbInitialized();
  const result = await getClient().execute({ sql, args: params as InValue[] });
  if (result.rows.length === 0) return undefined;
  return rowToObject(result.rows[0] as unknown as Record<string, unknown>) as T;
}

export async function run(sql: string, params: unknown[] = []): Promise<{ rowsAffected: number; lastInsertRowid: number }> {
  await ensureDbInitialized();
  const result = await getClient().execute({ sql, args: params as InValue[] });
  return {
    rowsAffected: result.rowsAffected,
    lastInsertRowid: Number(result.lastInsertRowid ?? 0),
  };
}
