CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`old_value` text,
	`new_value` text,
	`ip_address` text,
	`user_agent` text,
	`metadata` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_audit_user_created` ON `audit_logs` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_action` ON `audit_logs` (`action`,`created_at`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`category` text NOT NULL,
	`monthly_limit` real NOT NULL,
	`month` integer NOT NULL,
	`year` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_budgets_user` ON `budgets` (`user_id`,`month`,`year`);--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`mode` text DEFAULT 'chat',
	`session_id` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chat_messages_user` ON `chat_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_messages_session` ON `chat_messages` (`user_id`,`session_id`);--> statement-breakpoint
CREATE TABLE `custom_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`icon` text DEFAULT 'category',
	`color` text DEFAULT 'gray',
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_custom_categories_user` ON `custom_categories` (`user_id`);--> statement-breakpoint
CREATE TABLE `net_worth` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`amount` real NOT NULL,
	`encrypted_amount` text,
	`note` text DEFAULT '',
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`read` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_user` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
CREATE TABLE `oauth_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`email` text,
	`display_name` text,
	`avatar_url` text,
	`encrypted_access_token` text,
	`encrypted_refresh_token` text,
	`token_expires_at` text,
	`scope` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_oauth_user` ON `oauth_accounts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_oauth_provider` ON `oauth_accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `recurring_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`frequency` text DEFAULT 'monthly' NOT NULL,
	`next_date` text DEFAULT (date('now')) NOT NULL,
	`active` integer DEFAULT 1,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_recurring_user` ON `recurring_transactions` (`user_id`);--> statement-breakpoint
CREATE TABLE `savings_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`target_amount` real NOT NULL,
	`saved_amount` real DEFAULT 0 NOT NULL,
	`encrypted_target_amount` text,
	`encrypted_saved_amount` text,
	`deadline` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_savings_goals_user` ON `savings_goals` (`user_id`);--> statement-breakpoint
CREATE TABLE `tour_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tour_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tour_id` integer NOT NULL,
	`name` text NOT NULL,
	`user_id` integer,
	FOREIGN KEY (`tour_id`) REFERENCES `tour_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`encrypted_amount` text,
	`category` text DEFAULT 'Other' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`encrypted_description` text,
	`date` text DEFAULT (date('now')) NOT NULL,
	`tour_id` integer,
	`paid_by` integer,
	`split_type` text DEFAULT 'equal',
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tour_id`) REFERENCES `tour_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paid_by`) REFERENCES `tour_participants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `user_passkeys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text DEFAULT 'My Passkey' NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`sign_count` integer DEFAULT 0 NOT NULL,
	`algorithm` integer DEFAULT -7 NOT NULL,
	`transports` text,
	`active` integer DEFAULT 1,
	`last_used_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_passkeys_credential_id_unique` ON `user_passkeys` (`credential_id`);--> statement-breakpoint
CREATE INDEX `idx_passkeys_user` ON `user_passkeys` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked` integer DEFAULT 0,
	`device_fingerprint` text,
	`device_name` text,
	`ip_address` text,
	`user_agent` text,
	`last_used_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_user` ON `user_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires` ON `user_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`currency` text DEFAULT 'BDT',
	`notify_budget` integer DEFAULT 1,
	`notify_overspend` integer DEFAULT 1,
	`totp_secret` text,
	`totp_enabled` integer DEFAULT 0,
	`backup_codes` text,
	`password_updated_at` text,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);