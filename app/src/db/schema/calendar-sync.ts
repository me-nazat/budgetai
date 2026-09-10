/**
 * @fileoverview Calendar sync schema — settings, event logs, and push notification scheduling.
 *
 * Consolidates:
 * - Gen 2: calendar-sync.ts (calendarSyncSettings, calendarEventLogs)
 * - Gen 3: calendar-modules28.ts (module28PushScheduledJobs)
 *
 * @module db/schema/calendar-sync
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/* ───────────────────────────────────────────────────────────────
   CALENDAR SYNC SETTINGS (Gen 2)
   ─────────────────────────────────────────────────────────────── */

export const calendarSyncSettings = sqliteTable('calendar_sync_settings', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  googleUserEmail: text('google_user_email'),
  calendarId: text('calendar_id').default('primary'),
  syncBills: integer('sync_bills').notNull().default(1),
  syncSubscriptions: integer('sync_subscriptions').notNull().default(1),
  syncDebts: integer('sync_debts').notNull().default(1),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(2),
  lastSyncedAt: integer('last_synced_at'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

export type CalendarSyncSetting = typeof calendarSyncSettings.$inferSelect;
export type NewCalendarSyncSetting = typeof calendarSyncSettings.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   CALENDAR EVENT LOGS (Gen 2)
   ─────────────────────────────────────────────────────────────── */

export const calendarEventLogs = sqliteTable(
  'calendar_event_logs',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(), // 'BILL', 'SUBSCRIPTION', 'DEBT'
    sourceId: text('source_id').notNull(),
    googleEventId: text('google_event_id').notNull(),
    lastKnownHash: text('last_known_hash').notNull(),
    nextPushAt: integer('next_push_at'),
    updatedAt: integer('updated_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_calendar_source').on(table.sourceType, table.sourceId),
  ]
);

export type CalendarEventLog = typeof calendarEventLogs.$inferSelect;
export type NewCalendarEventLog = typeof calendarEventLogs.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   PUSH NOTIFICATION SCHEDULER (ex calendar-modules28.ts Gen 3)
   SQL table name preserved: module_28_push_scheduled_jobs
   ─────────────────────────────────────────────────────────────── */

/**
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



export const calendarSyncEvents = sqliteTable(
  'calendar_sync_events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: integer('entity_id').notNull(),
    googleEventId: text('google_event_id').notNull(),
    lastSyncedAt: text('last_synced_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_calendar_events_user').on(table.userId, table.entityType, table.entityId),
  ]
);

export type CalendarSyncEvent = typeof calendarSyncEvents.$inferSelect;
export type NewCalendarSyncEvent = typeof calendarSyncEvents.$inferInsert;


