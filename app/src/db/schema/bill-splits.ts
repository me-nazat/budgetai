import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
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

export const tourSpendings = sqliteTable('tour_spendings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tourId: integer('tour_id')
    .notNull()
    .references(() => tours.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  category: text('category').notNull().default('Travel'),
  description: text('description').notNull().default(''),
  date: text('date').notNull().default(sql`(date('now'))`),
  paidByParticipantId: integer('paid_by_participant_id')
    .notNull()
    .references(() => tourParticipants.id, { onDelete: 'cascade' }),
  splitType: text('split_type', { enum: ['equal', 'percentage', 'exact'] }).default('equal'),
  linkedTransactionId: integer('linked_transaction_id'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type TourSpending = typeof tourSpendings.$inferSelect;
export type NewTourSpending = typeof tourSpendings.$inferInsert;
