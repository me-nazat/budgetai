CREATE TABLE `ai_insights_cache` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`insight_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`action_payload` text,
	`is_dismissed` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ai_insights_user` ON `ai_insights_cache` (`user_id`,`is_dismissed`);--> statement-breakpoint
CREATE TABLE `bank_import_review_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`import_batch_id` integer,
	`parsed_row_data` text NOT NULL,
	`possible_match_transaction_id` integer,
	`match_confidence` real DEFAULT 0.5 NOT NULL,
	`resolution` text DEFAULT 'pending' NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`possible_match_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_bank_import_review_user` ON `bank_import_review_queue` (`user_id`,`resolution`);--> statement-breakpoint
CREATE TABLE `benchmark_demographics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`age_tier` text NOT NULL,
	`region_code` text NOT NULL,
	`income_bracket` text NOT NULL,
	`category` text NOT NULL,
	`p50_amount` real NOT NULL,
	`p90_amount` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_demo_cohort` ON `benchmark_demographics` (`age_tier`,`region_code`,`income_bracket`);--> statement-breakpoint
CREATE TABLE `calendar_sync_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`google_event_id` text NOT NULL,
	`last_synced_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_events_user` ON `calendar_sync_events` (`user_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `calendar_sync_tokens` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`calendar_id` text DEFAULT 'primary' NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_tokens_user` ON `calendar_sync_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `category_percentile_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`year_month` text NOT NULL,
	`category` text NOT NULL,
	`user_spent` real NOT NULL,
	`p50_spent` real NOT NULL,
	`p90_spent` real NOT NULL,
	`percentile_rank` real NOT NULL,
	`cohort_size` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_cat_pct_snapshots_user_month` ON `category_percentile_snapshots` (`user_id`,`year_month`);--> statement-breakpoint
CREATE TABLE `chat_tool_executions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`chat_message_id` integer,
	`tool_name` text NOT NULL,
	`parameters_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`inverse_operation_payload_json` text,
	`executed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_tools_user` ON `chat_tool_executions` (`user_id`);--> statement-breakpoint
CREATE TABLE `document_embeddings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`document_id` integer NOT NULL,
	`embedding_vector` text NOT NULL,
	`chunk_text` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_doc_embeddings_doc` ON `document_embeddings` (`document_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`file_url` text NOT NULL,
	`file_type` text NOT NULL,
	`ocr_text` text,
	`embedding` text,
	`document_type` text DEFAULT 'other' NOT NULL,
	`linked_transaction_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_documents_user` ON `documents` (`user_id`);--> statement-breakpoint
CREATE TABLE `goal_milestones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`goal_id` integer NOT NULL,
	`milestone_percentage` integer NOT NULL,
	`achieved_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_goal_milestones_goal` ON `goal_milestones` (`goal_id`);--> statement-breakpoint
CREATE TABLE `household_category_caps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`category` text NOT NULL,
	`cap_amount` real NOT NULL,
	`rollover_policy` text DEFAULT 'none' NOT NULL,
	`allocated_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`allocated_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_hh_caps_household` ON `household_category_caps` (`household_id`,`category`);--> statement-breakpoint
CREATE TABLE `household_settlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`payer_id` integer NOT NULL,
	`payee_id` integer NOT NULL,
	`amount` real NOT NULL,
	`source_rule_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`settled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_rule_id`) REFERENCES `household_split_rules`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_hh_settlements_household` ON `household_settlements` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_hh_settlements_payer` ON `household_settlements` (`payer_id`);--> statement-breakpoint
CREATE TABLE `household_split_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`category` text DEFAULT 'Bills & Utilities' NOT NULL,
	`split_type` text DEFAULT 'equal' NOT NULL,
	`split_shares` text,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`day_of_month` integer DEFAULT 1,
	`next_run_date` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_hh_split_rules_household` ON `household_split_rules` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_hh_split_rules_next_run` ON `household_split_rules` (`next_run_date`);--> statement-breakpoint
CREATE TABLE `percentile_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`month` text NOT NULL,
	`savings_rate_percentile` real NOT NULL,
	`health_score` real NOT NULL,
	`cohort_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_percentile_snapshots_user` ON `percentile_snapshots` (`user_id`,`month`);--> statement-breakpoint
CREATE TABLE `round_up_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`rounding_tier` real DEFAULT 1 NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`target_goal_id` integer,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_round_up_user` ON `round_up_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `statement_import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`bank_name` text NOT NULL,
	`file_name` text NOT NULL,
	`total_records` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_statement_batches_user` ON `statement_import_batches` (`user_id`);--> statement-breakpoint
CREATE TABLE `tax_deduction_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`transaction_id` integer,
	`tax_year` integer NOT NULL,
	`deduction_category` text NOT NULL,
	`deductible_amount` real NOT NULL,
	`receipt_document_id` integer,
	`status` text DEFAULT 'verified' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_tax_deductions_user_year` ON `tax_deduction_items` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE TABLE `user_demographics` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`age_bracket` text NOT NULL,
	`household_size_bracket` text,
	`region_bracket` text,
	`region_code` text DEFAULT 'GLOBAL' NOT NULL,
	`income_bracket` text DEFAULT '60k-100k' NOT NULL,
	`employment_sector` text,
	`is_opted_in` integer DEFAULT 1 NOT NULL,
	`opted_in_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `household_ledgers` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`category_id` text,
	`name` text NOT NULL,
	`split_mode` text DEFAULT 'EQUAL' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_household_ledgers_household` ON `household_ledgers` (`household_id`);--> statement-breakpoint
CREATE TABLE `household_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`expense_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`owed_amount` real NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`percentage_share` real NOT NULL,
	`is_settled` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_household_splits_expense` ON `household_splits` (`expense_id`);--> statement-breakpoint
CREATE INDEX `idx_household_splits_user` ON `household_splits` (`user_id`,`is_settled`);--> statement-breakpoint
CREATE TABLE `benchmark_aggregates` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_key` text NOT NULL,
	`metric_type` text NOT NULL,
	`p10` real NOT NULL,
	`p25` real NOT NULL,
	`p50` real NOT NULL,
	`p75` real NOT NULL,
	`p90` real NOT NULL,
	`sample_size` integer NOT NULL,
	`last_calculated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_benchmark_cohort_metric` ON `benchmark_aggregates` (`cohort_key`,`metric_type`);--> statement-breakpoint
CREATE TABLE `tax_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`deductible_percentage` real DEFAULT 1 NOT NULL,
	`jurisdiction` text DEFAULT 'US_IRS' NOT NULL,
	`description` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_categories_code_unique` ON `tax_categories` (`code`);--> statement-breakpoint
CREATE TABLE `tax_deductions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`transaction_id` integer,
	`tax_category_id` text NOT NULL,
	`eligible_amount` real NOT NULL,
	`deductible_amount` real NOT NULL,
	`jurisdiction` text DEFAULT 'US_IRS' NOT NULL,
	`receipt_document_id` integer,
	`status` text DEFAULT 'VERIFIED' NOT NULL,
	`notes` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tax_category_id`) REFERENCES `tax_categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tax_deductions_transaction_id_unique` ON `tax_deductions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_tax_deductions_user_year` ON `tax_deductions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `document_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` real DEFAULT 1,
	`unit_price` real,
	`total_price` real NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `document_metadata`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_metadata` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_url` text NOT NULL,
	`merchant_name` text,
	`document_date` text,
	`total_amount` real,
	`tax_amount` real,
	`ocr_raw_text` text,
	`extraction_status` text DEFAULT 'PROCESSING' NOT NULL,
	`embedding_status` text DEFAULT 'PENDING' NOT NULL,
	`embedding_completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_document_user` ON `document_metadata` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_privacy_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`auto_lock_timeout_minutes` integer DEFAULT 5 NOT NULL,
	`shake_to_hide_enabled` integer DEFAULT 1 NOT NULL,
	`mask_account_numbers` integer DEFAULT 1 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_privacy_settings_user_id_unique` ON `user_privacy_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `round_up_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`source_account_id` integer NOT NULL,
	`target_goal_id` text NOT NULL,
	`multiplier` real DEFAULT 1 NOT NULL,
	`minimum_sweep_threshold` real DEFAULT 5 NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `round_up_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`transaction_id` integer NOT NULL,
	`raw_delta` real NOT NULL,
	`multiplied_amount` real NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`sweep_window_id` text,
	`swept_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`rule_id`) REFERENCES `round_up_rules`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_round_up_pending` ON `round_up_transfers` (`rule_id`,`status`);--> statement-breakpoint
CREATE TABLE `imported_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`account_id` integer NOT NULL,
	`file_name` text NOT NULL,
	`statement_period_start` text,
	`statement_period_end` text,
	`opening_balance` real,
	`closing_balance` real,
	`total_transactions_count` integer DEFAULT 0 NOT NULL,
	`page_count` integer DEFAULT 1 NOT NULL,
	`multi_page_strategy` text DEFAULT 'single-page' NOT NULL,
	`commit_batch_id` text,
	`reconciliation_status` text DEFAULT 'UNRECONCILED' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reconciliation_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`statement_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`category_suggestion` text,
	`match_confidence` real DEFAULT 0.5 NOT NULL,
	`is_duplicate` integer DEFAULT 0 NOT NULL,
	`matched_existing_transaction_id` integer,
	`resolution` text DEFAULT 'pending' NOT NULL,
	`review_status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`statement_id`) REFERENCES `imported_statements`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`matched_existing_transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_recon_queue_statement` ON `reconciliation_queue` (`statement_id`,`review_status`);--> statement-breakpoint
CREATE TABLE `calendar_event_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`google_event_id` text NOT NULL,
	`last_known_hash` text NOT NULL,
	`next_push_at` integer,
	`updated_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_calendar_source` ON `calendar_event_logs` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `calendar_sync_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`google_refresh_token` text,
	`google_user_email` text,
	`calendar_id` text,
	`sync_bills` integer DEFAULT 1 NOT NULL,
	`sync_subscriptions` integer DEFAULT 1 NOT NULL,
	`sync_debts` integer DEFAULT 1 NOT NULL,
	`reminder_days_before` integer DEFAULT 2 NOT NULL,
	`last_synced_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_sync_settings_user_id_unique` ON `calendar_sync_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `agent_action_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`session_id` text,
	`action_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'PENDING_APPROVAL' NOT NULL,
	`executed_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `proactive_insights` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`insight_type` text NOT NULL,
	`severity` text DEFAULT 'INFO' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`action_link` text,
	`is_dismissed` integer DEFAULT 0 NOT NULL,
	`generated_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_insights_user_active` ON `proactive_insights` (`user_id`,`is_dismissed`);--> statement-breakpoint
CREATE TABLE `module_20_household_budget_cycles` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`year_month` text NOT NULL,
	`total_cap` real NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m20_budget_cycles_hh` ON `module_20_household_budget_cycles` (`household_id`,`year_month`);--> statement-breakpoint
CREATE TABLE `module_20_household_cap_allocations` (
	`id` text PRIMARY KEY NOT NULL,
	`cycle_id` text NOT NULL,
	`category` text NOT NULL,
	`cap_amount` real NOT NULL,
	`contributed_by_user_id` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`cycle_id`) REFERENCES `module_20_household_budget_cycles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`contributed_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m20_cap_allocations_cycle` ON `module_20_household_cap_allocations` (`cycle_id`,`category`);--> statement-breakpoint
CREATE TABLE `module_20_upcoming_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` integer NOT NULL,
	`from_user_id` integer NOT NULL,
	`to_user_id` integer NOT NULL,
	`amount` real NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m20_upcoming_settlements_hh` ON `module_20_upcoming_settlements` (`household_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_m20_upcoming_settlements_from` ON `module_20_upcoming_settlements` (`from_user_id`);--> statement-breakpoint
CREATE INDEX `idx_m20_upcoming_settlements_to` ON `module_20_upcoming_settlements` (`to_user_id`);--> statement-breakpoint
CREATE TABLE `module_21_anonymous_share_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`snapshot_id` integer,
	`claim_text` text NOT NULL,
	`image_url` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`snapshot_id`) REFERENCES `category_percentile_snapshots`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_m21_share_cards_user` ON `module_21_anonymous_share_cards` (`user_id`);--> statement-breakpoint
CREATE TABLE `module_21_user_benchmark_consents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`metric_key` text NOT NULL,
	`granted_at` integer DEFAULT (unixepoch()),
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m21_consents_user` ON `module_21_user_benchmark_consents` (`user_id`,`metric_key`);--> statement-breakpoint
CREATE TABLE `module_22_fiscal_report_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`tax_year` integer NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`view_count` integer DEFAULT 0 NOT NULL,
	`last_viewed_at` integer,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `module_22_fiscal_report_shares_token_unique` ON `module_22_fiscal_report_shares` (`token`);--> statement-breakpoint
CREATE INDEX `idx_m22_report_shares_token` ON `module_22_fiscal_report_shares` (`token`);--> statement-breakpoint
CREATE INDEX `idx_m22_report_shares_user` ON `module_22_fiscal_report_shares` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE TABLE `module_22_missing_receipts_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`deduction_id` text,
	`flagged_at` integer DEFAULT (unixepoch()),
	`reason` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deduction_id`) REFERENCES `tax_deductions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m22_missing_receipts_user` ON `module_22_missing_receipts_log` (`user_id`);--> statement-breakpoint
CREATE TABLE `module_22_tax_tag_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`transaction_pattern` text NOT NULL,
	`suggested_category_id` text NOT NULL,
	`hit_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`suggested_category_id`) REFERENCES `tax_categories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m22_tag_suggestions_user` ON `module_22_tax_tag_suggestions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m22_tag_suggestions_pattern` ON `module_22_tax_tag_suggestions` (`transaction_pattern`);--> statement-breakpoint
CREATE TABLE `module_23_document_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`chunk_text` text NOT NULL,
	`token_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`document_id`) REFERENCES `document_metadata`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m23_chunks_doc` ON `module_23_document_chunks` (`document_id`);--> statement-breakpoint
CREATE TABLE `module_23_search_query_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`query_text` text NOT NULL,
	`query_embedding` text,
	`top_chunk_ids` text,
	`result_count` integer DEFAULT 0 NOT NULL,
	`cache_hit` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m23_query_user` ON `module_23_search_query_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m23_query_text` ON `module_23_search_query_log` (`query_text`);--> statement-breakpoint
CREATE TABLE `module_25_round_up_sweeps` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`rule_id` text,
	`total_amount` real NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`swept_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m25_sweeps_user` ON `module_25_round_up_sweeps` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `module_25_stretch_goal_suggestions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`source_goal_id` integer NOT NULL,
	`suggested_target` real NOT NULL,
	`suggested_deadline` text NOT NULL,
	`accepted_at` integer,
	`dismissed_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_goal_id`) REFERENCES `savings_goals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m25_stretch_goal_user` ON `module_25_stretch_goal_suggestions` (`user_id`);--> statement-breakpoint
CREATE TABLE `module_26_commit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`statement_id` text NOT NULL,
	`rows_committed` integer DEFAULT 0 NOT NULL,
	`started_at` integer DEFAULT (unixepoch()),
	`finished_at` integer,
	`status` text DEFAULT 'in_progress' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`statement_id`) REFERENCES `imported_statements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m26_commit_log_batch` ON `module_26_commit_log` (`batch_id`);--> statement-breakpoint
CREATE INDEX `idx_m26_commit_log_user` ON `module_26_commit_log` (`user_id`);--> statement-breakpoint
CREATE TABLE `module_26_statement_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`statement_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`raw_text` text,
	`parsed_json` text,
	`parse_status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`statement_id`) REFERENCES `imported_statements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m26_statement_pages_stmt` ON `module_26_statement_pages` (`statement_id`,`page_number`);--> statement-breakpoint
CREATE TABLE `module_28_push_scheduled_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`run_at` integer NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`sent_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m28_push_jobs_status` ON `module_28_push_scheduled_jobs` (`status`,`run_at`);--> statement-breakpoint
CREATE INDEX `idx_m28_push_jobs_user` ON `module_28_push_scheduled_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m28_push_jobs_source` ON `module_28_push_scheduled_jobs` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `module_29_action_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`tool_name` text NOT NULL,
	`granted_at` integer DEFAULT (unixepoch()),
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m29_action_perm_user` ON `module_29_action_permissions` (`user_id`,`tool_name`);--> statement-breakpoint
CREATE TABLE `module_29_insight_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`insight_id` text NOT NULL,
	`feedback` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_m29_feedback_user` ON `module_29_insight_feedback` (`user_id`,`insight_id`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `display_masked` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `default_split_mode` text DEFAULT 'equal' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_transactions` ADD `household_id` integer REFERENCES households(id);--> statement-breakpoint
ALTER TABLE `recurring_transactions` ADD `split_rule` text;--> statement-breakpoint
ALTER TABLE `savings_goals` ADD `last_milestone_hit` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `savings_goals` ADD `streak_after_completion` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `tax_suggested` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `preferred_locale` text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE `users` ADD `benchmark_opt_in` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `demographic_age_tier` text;--> statement-breakpoint
ALTER TABLE `users` ADD `demographic_region` text;