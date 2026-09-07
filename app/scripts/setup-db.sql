-- Core household tables
CREATE TABLE IF NOT EXISTS households (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  created_by INTEGER NOT NULL,
  default_split_mode TEXT NOT NULL DEFAULT 'equal',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL,
  paid_by_user_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  expense_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_splits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  owed_amount REAL NOT NULL,
  settled INTEGER NOT NULL DEFAULT 0,
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL,
  payer_id INTEGER NOT NULL,
  payee_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  source_rule_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_category_caps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL,
  category TEXT NOT NULL,
  cap_amount REAL NOT NULL,
  rollover_policy TEXT NOT NULL DEFAULT 'none',
  allocated_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_split_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'Bills & Utilities',
  split_type TEXT NOT NULL DEFAULT 'equal',
  split_shares TEXT,
  frequency TEXT NOT NULL DEFAULT 'monthly',
  day_of_month INTEGER DEFAULT 1,
  next_run_date TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Module 20 tables
CREATE TABLE IF NOT EXISTS module_20_household_budget_cycles (
  id TEXT PRIMARY KEY,
  household_id INTEGER NOT NULL,
  year_month TEXT NOT NULL,
  total_cap REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS module_20_household_cap_allocations (
  id TEXT PRIMARY KEY,
  cycle_id TEXT NOT NULL,
  category TEXT NOT NULL,
  cap_amount REAL NOT NULL,
  contributed_by_user_id INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS module_20_upcoming_settlements (
  id TEXT PRIMARY KEY,
  household_id INTEGER NOT NULL,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER DEFAULT (unixepoch())
);

-- Module 21 tables & Benchmarks
CREATE TABLE IF NOT EXISTS user_demographics (
  id TEXT,
  user_id INTEGER PRIMARY KEY,
  age_bracket TEXT NOT NULL,
  household_size_bracket TEXT,
  region_bracket TEXT,
  region_code TEXT DEFAULT 'GLOBAL',
  income_bracket TEXT,
  employment_sector TEXT,
  is_opted_in INTEGER NOT NULL DEFAULT 1,
  opted_in_at TEXT DEFAULT (datetime('now')),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS benchmark_aggregates (
  id TEXT PRIMARY KEY,
  cohort_key TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  p10 REAL NOT NULL,
  p25 REAL NOT NULL,
  p50 REAL NOT NULL,
  p75 REAL NOT NULL,
  p90 REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  last_calculated_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS category_percentile_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  year_month TEXT NOT NULL,
  category TEXT NOT NULL,
  user_spent REAL NOT NULL,
  p50_spent REAL NOT NULL,
  p90_spent REAL NOT NULL,
  percentile_rank REAL NOT NULL,
  cohort_size INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS percentile_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  month TEXT NOT NULL,
  savings_rate_percentile REAL NOT NULL,
  health_score REAL NOT NULL,
  cohort_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_21_user_benchmark_consents (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  metric_key TEXT NOT NULL,
  granted_at INTEGER DEFAULT (unixepoch()),
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS module_21_anonymous_share_cards (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  snapshot_id INTEGER,
  claim_text TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

-- Module 22 tables & Tax Vault
CREATE TABLE IF NOT EXISTS tax_categories (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  deductible_percentage REAL NOT NULL DEFAULT 1.0,
  jurisdiction TEXT NOT NULL DEFAULT 'US_IRS',
  description TEXT
);

CREATE TABLE IF NOT EXISTS tax_deductions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  transaction_id INTEGER UNIQUE,
  tax_category_id TEXT NOT NULL,
  eligible_amount REAL NOT NULL,
  deductible_amount REAL NOT NULL,
  jurisdiction TEXT NOT NULL DEFAULT 'US_IRS',
  receipt_document_id INTEGER,
  status TEXT NOT NULL DEFAULT 'VERIFIED',
  notes TEXT,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tax_deduction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  transaction_id INTEGER,
  tax_year INTEGER NOT NULL,
  deduction_category TEXT NOT NULL,
  deductible_amount REAL NOT NULL,
  receipt_document_id INTEGER,
  status TEXT NOT NULL DEFAULT 'verified',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS module_22_tax_tag_suggestions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  transaction_pattern TEXT NOT NULL,
  suggested_category_id TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS module_22_fiscal_report_shares (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tax_year INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  last_viewed_at INTEGER,
  revoked_at INTEGER
);

CREATE TABLE IF NOT EXISTS module_22_missing_receipts_log (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  deduction_id TEXT,
  flagged_at INTEGER DEFAULT (unixepoch()),
  reason TEXT NOT NULL
);

-- Module 23: Document Chunks & Search Query Log
CREATE TABLE IF NOT EXISTS module_23_document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES document_metadata(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  token_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_m23_chunks_doc ON module_23_document_chunks(document_id);

CREATE TABLE IF NOT EXISTS module_23_search_query_log (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_text TEXT NOT NULL,
  query_embedding TEXT,
  top_chunk_ids TEXT,
  result_count INTEGER NOT NULL DEFAULT 0,
  cache_hit INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_m23_query_user ON module_23_search_query_log(user_id);
CREATE INDEX IF NOT EXISTS idx_m23_query_text ON module_23_search_query_log(query_text);

-- Module 25: Escrow Sweeps & Stretch Goals
CREATE TABLE IF NOT EXISTS module_25_round_up_sweeps (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id TEXT,
  total_amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  swept_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_m25_sweeps_user ON module_25_round_up_sweeps(user_id, status);

CREATE TABLE IF NOT EXISTS module_25_stretch_goal_suggestions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  suggested_target REAL NOT NULL,
  suggested_deadline TEXT NOT NULL,
  accepted_at INTEGER,
  dismissed_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_m25_stretch_goal_user ON module_25_stretch_goal_suggestions(user_id);

-- Module 26: Statement Pages & Commit Log
CREATE TABLE IF NOT EXISTS module_26_statement_pages (
  id TEXT PRIMARY KEY,
  statement_id TEXT NOT NULL REFERENCES imported_statements(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  raw_text TEXT,
  parsed_json TEXT,
  parse_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_m26_statement_pages_stmt ON module_26_statement_pages(statement_id, page_number);

CREATE TABLE IF NOT EXISTS module_26_commit_log (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  statement_id TEXT NOT NULL REFERENCES imported_statements(id) ON DELETE CASCADE,
  rows_committed INTEGER NOT NULL DEFAULT 0,
  started_at INTEGER DEFAULT (unixepoch()),
  finished_at INTEGER,
  status TEXT NOT NULL DEFAULT 'in_progress'
);
CREATE INDEX IF NOT EXISTS idx_m26_commit_log_batch ON module_26_commit_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_m26_commit_log_user ON module_26_commit_log(user_id);

