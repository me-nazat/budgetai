import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const tours = sqliteTable('tours', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Backward-compatible export name for older feature code.
export const tourGroups = tours;

export const tourParticipants = sqliteTable('tour_participants', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tourId: integer('tour_id')
    .notNull()
    .references(() => tours.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
});

export type Tour = typeof tours.$inferSelect;
export type NewTour = typeof tours.$inferInsert;
export type TourGroup = Tour;
export type NewTourGroup = NewTour;

export type TourParticipant = typeof tourParticipants.$inferSelect;
export type NewTourParticipant = typeof tourParticipants.$inferInsert;
