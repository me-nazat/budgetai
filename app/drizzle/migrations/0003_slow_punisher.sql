CREATE TABLE `debts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`debt_type` text NOT NULL,
	`balance` real NOT NULL,
	`initial_balance` real NOT NULL,
	`encrypted_balance` text,
	`interest_rate_apr` real NOT NULL,
	`minimum_payment` real NOT NULL,
	`due_day_of_month` integer,
	`linked_recurring_transaction_id` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`linked_recurring_transaction_id`) REFERENCES `recurring_transactions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_debts_user` ON `debts` (`user_id`);--> statement-breakpoint
CREATE TABLE `tour_checklist_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tour_id` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tour_checklist_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tour_id` integer NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`assigned_to` text NOT NULL,
	`completed` integer DEFAULT 0,
	`description` text DEFAULT '',
	`attachment_id` text,
	`attachment_name` text,
	`priority` text DEFAULT 'Medium',
	`quantity` integer DEFAULT 1,
	`completed_by` text DEFAULT '[]',
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tour_itinerary_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tour_id` integer NOT NULL,
	`day` integer NOT NULL,
	`time` text NOT NULL,
	`title` text NOT NULL,
	`location` text DEFAULT '',
	`cost` real,
	`cost_display` text,
	`time_end` text,
	`type` text DEFAULT 'activity',
	`notes` text DEFAULT '',
	`group_title` text DEFAULT 'General Activities',
	`attachment_id` text,
	`attachment_name` text,
	`status` text DEFAULT 'Planned',
	`latitude` text,
	`longitude` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`tour_id`) REFERENCES `tours`(`id`) ON UPDATE no action ON DELETE cascade
);
