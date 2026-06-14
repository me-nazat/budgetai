import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const tourGroups = sqliteTable('tour_groups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const tourParticipants = sqliteTable('tour_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tourId: integer('tour_id')
    .notNull()
    .references(() => tourGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
});

export type TourGroup = typeof tourGroups.$inferSelect;
export type NewTourGroup = typeof tourGroups.$inferInsert;

export type TourParticipant = typeof tourParticipants.$inferSelect;
export type NewTourParticipant = typeof tourParticipants.$inferInsert;
