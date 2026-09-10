DROP TABLE `calendar_sync_tokens`;--> statement-breakpoint
DROP TABLE `document_embeddings`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
DROP TABLE `round_up_settings`;--> statement-breakpoint
DROP TABLE `tax_deduction_items`;--> statement-breakpoint
DROP TABLE `household_ledgers`;--> statement-breakpoint
DROP TABLE `household_splits`;--> statement-breakpoint
DROP TABLE `imported_statements`;--> statement-breakpoint
DROP TABLE `reconciliation_queue`;--> statement-breakpoint
DROP TABLE `module_22_missing_receipts_log`;--> statement-breakpoint
DROP TABLE `module_26_commit_log`;--> statement-breakpoint
DROP TABLE `module_26_statement_pages`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_household_settlements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`household_id` integer NOT NULL,
	`payer_id` integer NOT NULL,
	`payee_id` integer NOT NULL,
	`amount` real NOT NULL,
	`encrypted_amount` text,
	`source_rule_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`settled_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`payee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_household_settlements`("id", "household_id", "payer_id", "payee_id", "amount", "encrypted_amount", "source_rule_id", "status", "settled_at", "created_at") SELECT "id", "household_id", "payer_id", "payee_id", "amount", "encrypted_amount", "source_rule_id", "status", "settled_at", "created_at" FROM `household_settlements`;--> statement-breakpoint
DROP TABLE `household_settlements`;--> statement-breakpoint
ALTER TABLE `__new_household_settlements` RENAME TO `household_settlements`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_hh_settlements_household` ON `household_settlements` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_hh_settlements_payer` ON `household_settlements` (`payer_id`);--> statement-breakpoint
DROP INDEX "idx_accounts_user";--> statement-breakpoint
DROP INDEX "idx_accounts_archive";--> statement-breakpoint
DROP INDEX "idx_audit_user_created";--> statement-breakpoint
DROP INDEX "idx_audit_entity";--> statement-breakpoint
DROP INDEX "idx_audit_action";--> statement-breakpoint
DROP INDEX "idx_auto_audit_user";--> statement-breakpoint
DROP INDEX "idx_automation_rules_user";--> statement-breakpoint
DROP INDEX "idx_budgets_user";--> statement-breakpoint
DROP INDEX "idx_chat_messages_user";--> statement-breakpoint
DROP INDEX "idx_chat_messages_session";--> statement-breakpoint
DROP INDEX "idx_custom_categories_user";--> statement-breakpoint
DROP INDEX "idx_debts_user";--> statement-breakpoint
DROP INDEX "idx_investments_user";--> statement-breakpoint
DROP INDEX "idx_investments_ticker";--> statement-breakpoint
DROP INDEX "idx_notifications_user";--> statement-breakpoint
DROP INDEX "idx_oauth_user";--> statement-breakpoint
DROP INDEX "idx_oauth_provider";--> statement-breakpoint
DROP INDEX "idx_push_subs_user";--> statement-breakpoint
DROP INDEX "idx_push_subs_endpoint";--> statement-breakpoint
DROP INDEX "idx_recurring_user";--> statement-breakpoint
DROP INDEX "idx_savings_goals_user";--> statement-breakpoint
DROP INDEX "idx_transactions_user";--> statement-breakpoint
DROP INDEX "idx_transactions_date";--> statement-breakpoint
DROP INDEX "idx_transactions_tour";--> statement-breakpoint
DROP INDEX "idx_transactions_user_date";--> statement-breakpoint
DROP INDEX "idx_transactions_user_amount";--> statement-breakpoint
DROP INDEX "idx_transactions_composite";--> statement-breakpoint
DROP INDEX "user_passkeys_credential_id_unique";--> statement-breakpoint
DROP INDEX "idx_passkeys_user";--> statement-breakpoint
DROP INDEX "user_sessions_token_hash_unique";--> statement-breakpoint
DROP INDEX "idx_sessions_user";--> statement-breakpoint
DROP INDEX "idx_sessions_expires";--> statement-breakpoint
DROP INDEX "users_email_unique";--> statement-breakpoint
DROP INDEX "idx_hh_caps_household";--> statement-breakpoint
DROP INDEX "idx_hh_expenses_household";--> statement-breakpoint
DROP INDEX "idx_hh_expenses_user";--> statement-breakpoint
DROP INDEX "idx_hh_members_household";--> statement-breakpoint
DROP INDEX "idx_hh_members_user";--> statement-breakpoint
DROP INDEX "idx_hh_settlements_household";--> statement-breakpoint
DROP INDEX "idx_hh_settlements_payer";--> statement-breakpoint
DROP INDEX "idx_hh_split_rules_household";--> statement-breakpoint
DROP INDEX "idx_hh_split_rules_next_run";--> statement-breakpoint
DROP INDEX "idx_m20_budget_cycles_hh";--> statement-breakpoint
DROP INDEX "idx_m20_cap_allocations_cycle";--> statement-breakpoint
DROP INDEX "idx_m20_upcoming_settlements_hh";--> statement-breakpoint
DROP INDEX "idx_m20_upcoming_settlements_from";--> statement-breakpoint
DROP INDEX "idx_m20_upcoming_settlements_to";--> statement-breakpoint
DROP INDEX "idx_benchmark_cohort_metric";--> statement-breakpoint
DROP INDEX "idx_benchmark_demo_cohort";--> statement-breakpoint
DROP INDEX "idx_cat_pct_snapshots_user_month";--> statement-breakpoint
DROP INDEX "idx_m21_share_cards_user";--> statement-breakpoint
DROP INDEX "idx_m21_consents_user";--> statement-breakpoint
DROP INDEX "idx_percentile_snapshots_user";--> statement-breakpoint
DROP INDEX "module_22_fiscal_report_shares_token_unique";--> statement-breakpoint
DROP INDEX "idx_m22_report_shares_token";--> statement-breakpoint
DROP INDEX "idx_m22_report_shares_user";--> statement-breakpoint
DROP INDEX "idx_m22_tag_suggestions_user";--> statement-breakpoint
DROP INDEX "idx_m22_tag_suggestions_pattern";--> statement-breakpoint
DROP INDEX "tax_categories_code_unique";--> statement-breakpoint
DROP INDEX "tax_deductions_transaction_id_unique";--> statement-breakpoint
DROP INDEX "idx_tax_deductions_user_year";--> statement-breakpoint
DROP INDEX "idx_document_user";--> statement-breakpoint
DROP INDEX "idx_m23_chunks_doc";--> statement-breakpoint
DROP INDEX "idx_m23_query_user";--> statement-breakpoint
DROP INDEX "idx_m23_query_text";--> statement-breakpoint
DROP INDEX "user_privacy_settings_user_id_unique";--> statement-breakpoint
DROP INDEX "idx_goal_milestones_goal";--> statement-breakpoint
DROP INDEX "idx_m25_sweeps_user";--> statement-breakpoint
DROP INDEX "idx_m25_stretch_goal_user";--> statement-breakpoint
DROP INDEX "idx_round_up_pending";--> statement-breakpoint
DROP INDEX "idx_bank_import_review_user";--> statement-breakpoint
DROP INDEX "idx_statement_batches_user";--> statement-breakpoint
DROP INDEX "idx_calendar_source";--> statement-breakpoint
DROP INDEX "idx_calendar_events_user";--> statement-breakpoint
DROP INDEX "calendar_sync_settings_user_id_unique";--> statement-breakpoint
DROP INDEX "idx_m28_push_jobs_status";--> statement-breakpoint
DROP INDEX "idx_m28_push_jobs_user";--> statement-breakpoint
DROP INDEX "idx_m28_push_jobs_source";--> statement-breakpoint
DROP INDEX "idx_ai_insights_user";--> statement-breakpoint
DROP INDEX "idx_chat_tools_user";--> statement-breakpoint
DROP INDEX "idx_m29_action_perm_user";--> statement-breakpoint
DROP INDEX "idx_m29_feedback_user";--> statement-breakpoint
DROP INDEX "idx_insights_user_active";--> statement-breakpoint
ALTER TABLE `calendar_sync_settings` ALTER COLUMN "calendar_id" TO "calendar_id" text DEFAULT 'primary';--> statement-breakpoint
CREATE INDEX `idx_accounts_user` ON `accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_accounts_archive` ON `accounts` (`is_archived`);--> statement-breakpoint
CREATE INDEX `idx_audit_user_created` ON `audit_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_auto_audit_user` ON `automation_audit_log` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_automation_rules_user` ON `automation_rules` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_budgets_user` ON `budgets` (`user_id`,`month`,`year`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_user` ON `chat_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session` ON `chat_messages` (`user_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `idx_custom_categories_user` ON `custom_categories` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_debts_user` ON `debts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_investments_user` ON `investment_holdings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_investments_ticker` ON `investment_holdings` (`user_id`,`ticker`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE INDEX `idx_oauth_user` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_provider` ON `oauth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE INDEX `idx_push_subs_user` ON `push_subscriptions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_push_subs_endpoint` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_recurring_user` ON `recurring_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_savings_goals_user` ON `savings_goals` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_tour` ON `transactions` (`tour_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_amount` ON `transactions` (`user_id`,`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_composite` ON `transactions` (`user_id`,`tour_id`,`date`,`amount`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_passkeys_credential_id_unique` ON `user_passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_passkeys_user` ON `user_passkeys` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_hh_caps_household` ON `household_category_caps` (`household_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_hh_expenses_household` ON `household_expenses` (`household_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_hh_expenses_user` ON `household_expenses` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_hh_members_household` ON `household_members` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_hh_members_user` ON `household_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_hh_split_rules_household` ON `household_split_rules` (`household_id`);--> statement-breakpoint
CREATE INDEX `idx_hh_split_rules_next_run` ON `household_split_rules` (`next_run_date`);--> statement-breakpoint
CREATE INDEX `idx_m20_budget_cycles_hh` ON `module_20_household_budget_cycles` (`household_id`,`year_month`);--> statement-breakpoint
CREATE INDEX `idx_m20_cap_allocations_cycle` ON `module_20_household_cap_allocations` (`cycle_id`,`category`);--> statement-breakpoint
CREATE INDEX `idx_m20_upcoming_settlements_hh` ON `module_20_upcoming_settlements` (`household_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_m20_upcoming_settlements_from` ON `module_20_upcoming_settlements` (`from_user_id`);--> statement-breakpoint
CREATE INDEX `idx_m20_upcoming_settlements_to` ON `module_20_upcoming_settlements` (`to_user_id`);--> statement-breakpoint
CREATE INDEX `idx_benchmark_cohort_metric` ON `benchmark_aggregates` (`cohort_key`,`metric_type`);--> statement-breakpoint
CREATE INDEX `idx_benchmark_demo_cohort` ON `benchmark_demographics` (`age_tier`,`region_code`,`income_bracket`);--> statement-breakpoint
CREATE INDEX `idx_cat_pct_snapshots_user_month` ON `category_percentile_snapshots` (`user_id`,`year_month`);--> statement-breakpoint
CREATE INDEX `idx_m21_share_cards_user` ON `module_21_anonymous_share_cards` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m21_consents_user` ON `module_21_user_benchmark_consents` (`user_id`,`metric_key`);--> statement-breakpoint
CREATE INDEX `idx_percentile_snapshots_user` ON `percentile_snapshots` (`user_id`,`month`);--> statement-breakpoint
CREATE UNIQUE INDEX `module_22_fiscal_report_shares_token_unique` ON `module_22_fiscal_report_shares` (`token`);--> statement-breakpoint
CREATE INDEX `idx_m22_report_shares_token` ON `module_22_fiscal_report_shares` (`token`);--> statement-breakpoint
CREATE INDEX `idx_m22_report_shares_user` ON `module_22_fiscal_report_shares` (`user_id`,`tax_year`);--> statement-breakpoint
CREATE INDEX `idx_m22_tag_suggestions_user` ON `module_22_tax_tag_suggestions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m22_tag_suggestions_pattern` ON `module_22_tax_tag_suggestions` (`transaction_pattern`);--> statement-breakpoint
CREATE UNIQUE INDEX `tax_categories_code_unique` ON `tax_categories` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `tax_deductions_transaction_id_unique` ON `tax_deductions` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `idx_tax_deductions_user_year` ON `tax_deductions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_document_user` ON `document_metadata` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m23_chunks_doc` ON `module_23_document_chunks` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_m23_query_user` ON `module_23_search_query_log` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m23_query_text` ON `module_23_search_query_log` (`query_text`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_privacy_settings_user_id_unique` ON `user_privacy_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_goal_milestones_goal` ON `goal_milestones` (`goal_id`);--> statement-breakpoint
CREATE INDEX `idx_m25_sweeps_user` ON `module_25_round_up_sweeps` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_m25_stretch_goal_user` ON `module_25_stretch_goal_suggestions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_round_up_pending` ON `round_up_transfers` (`rule_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_bank_import_review_user` ON `bank_import_review_queue` (`user_id`,`resolution`);--> statement-breakpoint
CREATE INDEX `idx_statement_batches_user` ON `statement_import_batches` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_source` ON `calendar_event_logs` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_calendar_events_user` ON `calendar_sync_events` (`user_id`,`entity_type`,`entity_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_sync_settings_user_id_unique` ON `calendar_sync_settings` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m28_push_jobs_status` ON `module_28_push_scheduled_jobs` (`status`,`run_at`);--> statement-breakpoint
CREATE INDEX `idx_m28_push_jobs_user` ON `module_28_push_scheduled_jobs` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m28_push_jobs_source` ON `module_28_push_scheduled_jobs` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_ai_insights_user` ON `ai_insights_cache` (`user_id`,`is_dismissed`);--> statement-breakpoint
CREATE INDEX `idx_chat_tools_user` ON `chat_tool_executions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_m29_action_perm_user` ON `module_29_action_permissions` (`user_id`,`tool_name`);--> statement-breakpoint
CREATE INDEX `idx_m29_feedback_user` ON `module_29_insight_feedback` (`user_id`,`insight_id`);--> statement-breakpoint
CREATE INDEX `idx_insights_user_active` ON `proactive_insights` (`user_id`,`is_dismissed`);--> statement-breakpoint
ALTER TABLE `calendar_sync_settings` DROP COLUMN `google_refresh_token`;--> statement-breakpoint
ALTER TABLE `household_category_caps` ADD `encrypted_cap_amount` text;--> statement-breakpoint
ALTER TABLE `statement_import_batches` ADD `reconciliation_status` text DEFAULT 'UNRECONCILED' NOT NULL;--> statement-breakpoint
ALTER TABLE `statement_import_batches` ADD `opening_balance` real;--> statement-breakpoint
ALTER TABLE `statement_import_batches` ADD `closing_balance` real;--> statement-breakpoint
ALTER TABLE `statement_import_batches` ADD `period_start` text;--> statement-breakpoint
ALTER TABLE `statement_import_batches` ADD `period_end` text;--> statement-breakpoint
ALTER TABLE `statement_import_batches` ADD `source_file_token` text;--> statement-breakpoint
ALTER TABLE `users` ADD `locale` text DEFAULT 'en';--> statement-breakpoint
ALTER TABLE `tax_deductions` ADD `encrypted_eligible_amount` text;--> statement-breakpoint
ALTER TABLE `tax_deductions` ADD `encrypted_deductible_amount` text;--> statement-breakpoint
ALTER TABLE `document_metadata` ADD `embedding` text;