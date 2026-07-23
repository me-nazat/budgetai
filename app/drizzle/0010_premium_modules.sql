-- Migration: Add tables for Modules 2-9
-- push_subscriptions, investment_holdings, automation_audit_log,
-- dashboard_layouts, households, household_members, household_expenses
-- Also adds priority column to automation_rules

-- Module 2: Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  enabled_categories TEXT DEFAULT '["budget","subscriptions","goals","security"]',
  quiet_hours_start TEXT,
  quiet_hours_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint);

-- Module 3: Investment Holdings
CREATE TABLE IF NOT EXISTS investment_holdings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  ticker TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity REAL NOT NULL,
  avg_cost_basis REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investment_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_ticker ON investment_holdings(user_id, ticker);

-- Module 6: Automation audit log + priority column
ALTER TABLE automation_rules ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS automation_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_id INTEGER REFERENCES automation_rules(id) ON DELETE SET NULL,
  transaction_id INTEGER,
  action_performed TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  undone INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_auto_audit_user ON automation_audit_log(user_id, created_at);

-- Module 7: Dashboard Layouts
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  widget_order TEXT NOT NULL DEFAULT '[]',
  hero_widget TEXT,
  hidden_widgets TEXT DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Module 9: Households
CREATE TABLE IF NOT EXISTS households (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS household_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hh_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_hh_members_user ON household_members(user_id);

CREATE TABLE IF NOT EXISTS household_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  split_between TEXT NOT NULL DEFAULT 'all',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hh_expenses_household ON household_expenses(household_id, created_at);
CREATE INDEX IF NOT EXISTS idx_hh_expenses_user ON household_expenses(user_id);

-- Users demographic columns for peer benchmarking
ALTER TABLE users ADD COLUMN benchmark_opt_in INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN demographic_age_tier TEXT;
ALTER TABLE users ADD COLUMN demographic_region TEXT;

-- Module 10: Household Settlements & Category Caps
CREATE TABLE IF NOT EXISTS household_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  payer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payee_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  settled_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hh_settlements_household ON household_settlements(household_id);
CREATE INDEX IF NOT EXISTS idx_hh_settlements_payer ON household_settlements(payer_id);

CREATE TABLE IF NOT EXISTS household_category_caps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  cap_amount REAL NOT NULL,
  allocated_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_hh_caps_household ON household_category_caps(household_id, category);

-- Module 11: Benchmark Demographics
CREATE TABLE IF NOT EXISTS benchmark_demographics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  age_tier TEXT NOT NULL,
  region_code TEXT NOT NULL,
  income_bracket TEXT NOT NULL,
  category TEXT NOT NULL,
  p50_amount REAL NOT NULL,
  p90_amount REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_benchmark_demo_cohort ON benchmark_demographics(age_tier, region_code, income_bracket);

-- Module 12: Tax Deduction Items
CREATE TABLE IF NOT EXISTS tax_deduction_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  tax_year INTEGER NOT NULL,
  deduction_category TEXT NOT NULL,
  deductible_amount REAL NOT NULL,
  receipt_document_id INTEGER,
  status TEXT NOT NULL DEFAULT 'verified',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tax_deductions_user_year ON tax_deduction_items(user_id, tax_year);

-- Module 13: Documents & Embeddings
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  ocr_text TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);

CREATE TABLE IF NOT EXISTS document_embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  embedding_vector TEXT NOT NULL,
  chunk_text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_doc_embeddings_doc ON document_embeddings(document_id);

-- Module 15: Round Up Settings & Milestones
CREATE TABLE IF NOT EXISTS round_up_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  rounding_tier REAL NOT NULL DEFAULT 1.0,
  multiplier REAL NOT NULL DEFAULT 1.0,
  target_goal_id INTEGER REFERENCES savings_goals(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_round_up_user ON round_up_settings(user_id);

CREATE TABLE IF NOT EXISTS goal_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  milestone_percentage INTEGER NOT NULL,
  achieved_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_goal_milestones_goal ON goal_milestones(goal_id);

-- Module 16: Statement Import Batches
CREATE TABLE IF NOT EXISTS statement_import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_statement_batches_user ON statement_import_batches(user_id);

-- Module 18: Google Calendar Sync
CREATE TABLE IF NOT EXISTS calendar_sync_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_user ON calendar_sync_tokens(user_id);

CREATE TABLE IF NOT EXISTS calendar_sync_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  google_event_id TEXT NOT NULL,
  last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_sync_events(user_id, entity_type, entity_id);

-- Module 19: Chat Tool Executions & AI Insights Cache
CREATE TABLE IF NOT EXISTS chat_tool_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chat_message_id INTEGER,
  tool_name TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  executedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_chat_tools_user ON chat_tool_executions(user_id);

CREATE TABLE IF NOT EXISTS ai_insights_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_payload TEXT,
  is_dismissed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user ON ai_insights_cache(user_id, is_dismissed);

