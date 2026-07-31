import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const userPrivacySettings = sqliteTable('user_privacy_settings', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  autoLockTimeoutMinutes: integer('auto_lock_timeout_minutes').notNull().default(5), // 0 = Disabled
  shakeToHideEnabled: integer('shake_to_hide_enabled').notNull().default(1),
  maskAccountNumbers: integer('mask_account_numbers').notNull().default(1),
  updatedAt: integer('updated_at').default(sql`(unixepoch())`),
});

export type UserPrivacySettings = typeof userPrivacySettings.$inferSelect;
export type NewUserPrivacySettings = typeof userPrivacySettings.$inferInsert;
