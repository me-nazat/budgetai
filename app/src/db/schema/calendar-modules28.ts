import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/**
 * Module 28: Push Notification Scheduler Queue
 * Decoupled from calendar events so notifications remain durable and schedulable
 * for morning-of alerts (due_date - reminderDaysBefore at 8 AM).
 */
export const module28PushScheduledJobs = sqliteTable(
  'module_28_push_scheduled_jobs',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceType: text('source_type', { enum: ['BILL', 'SUBSCRIPTION', 'DEBT'] }).notNull(),
    sourceId: text('source_id').notNull(),
    runAt: integer('run_at').notNull(), // Unix timestamp seconds
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'sent', 'failed', 'cancelled'] })
      .notNull()
      .default('pending'),
    sentAt: integer('sent_at'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m28_push_jobs_status').on(table.status, table.runAt),
    index('idx_m28_push_jobs_user').on(table.userId),
    index('idx_m28_push_jobs_source').on(table.sourceType, table.sourceId),
  ]
);

export type Module28PushScheduledJob = typeof module28PushScheduledJobs.$inferSelect;
export type NewModule28PushScheduledJob = typeof module28PushScheduledJobs.$inferInsert;
