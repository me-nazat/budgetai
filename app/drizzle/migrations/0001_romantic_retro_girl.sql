ALTER TABLE `tour_groups` RENAME TO `tours`;--> statement-breakpoint
ALTER TABLE `tours` ADD `created_by` integer NOT NULL REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `tours` DROP COLUMN `user_id`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_tour_participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tour_id` integer NOT NULL,
	`name` text NOT NULL,
	`user_id` integer,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_tour_participants`("id", "tour_id", "name", "user_id") SELECT "id", "tour_id", "name", "user_id" FROM `tour_participants`;--> statement-breakpoint
DROP TABLE `tour_participants`;--> statement-breakpoint
ALTER TABLE `__new_tour_participants` RENAME TO `tour_participants`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
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
	`paid_by_participant_id` integer,
	`split_type` text DEFAULT 'equal',
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`paid_by`) REFERENCES `tour_participants`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`paid_by_participant_id`) REFERENCES `tour_participants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "user_id", "type", "amount", "encrypted_amount", "category", "description", "encrypted_description", "date", "tour_id", "paid_by", "paid_by_participant_id", "split_type", "created_at") SELECT "id", "user_id", "type", "amount", "encrypted_amount", "category", "description", "encrypted_description", "date", "tour_id", "paid_by", "paid_by_participant_id", "split_type", "created_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `idx_transactions_user` ON `transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_tour` ON `transactions` (`tour_id`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_date` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `idx_transactions_user_amount` ON `transactions` (`user_id`,`amount`);--> statement-breakpoint
CREATE INDEX `idx_transactions_composite` ON `transactions` (`user_id`,`tour_id`,`date`,`amount`);