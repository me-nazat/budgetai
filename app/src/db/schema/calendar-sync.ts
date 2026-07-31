import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const calendarSyncSettings = sqliteTable('calendar_sync_settings', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  googleRefreshToken: text('google_refresh_token'),
  calendarId: text('calendar_id'),
  syncBills: integer('sync_bills').notNull().default(1),
  syncSubscriptions: integer('sync_subscriptions').notNull().default(1),
  syncDebts: integer('sync_debts').notNull().default(1),
  reminderDaysBefore: integer('reminder_days_before').notNull().default(2),
  lastSyncedAt: integer('last_synced_at'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

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
    updatedAt: integer('updated_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_calendar_source').on(table.sourceType, table.sourceId),
  ]
);

export type CalendarSyncSetting = typeof calendarSyncSettings.$inferSelect;
export type NewCalendarSyncSetting = typeof calendarSyncSettings.$inferInsert;

export type CalendarEventLog = typeof calendarEventLogs.$inferSelect;
export type NewCalendarEventLog = typeof calendarEventLogs.$inferInsert;
