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
  createdById: integer('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type TourSpending = typeof tourSpendings.$inferSelect;
export type NewTourSpending = typeof tourSpendings.$inferInsert;

export const tourItineraryItems = sqliteTable('tour_itinerary_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tourId: integer('tour_id')
    .notNull()
    .references(() => tours.id, { onDelete: 'cascade' }),
  day: integer('day').notNull(),
  time: text('time').notNull(),
  title: text('title').notNull(),
  location: text('location').default(''),
  cost: real('cost'),
  costDisplay: text('cost_display'),
  timeEnd: text('time_end'),
  type: text('type').default('activity'),
  notes: text('notes').default(''),
  groupTitle: text('group_title').default('General Activities'),
  attachmentId: text('attachment_id'),
  attachmentName: text('attachment_name'),
  status: text('status').default('Planned'),
  latitude: text('latitude'),
  longitude: text('longitude'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type TourItineraryItem = typeof tourItineraryItems.$inferSelect;
export type NewTourItineraryItem = typeof tourItineraryItems.$inferInsert;

export const tourChecklistCategories = sqliteTable('tour_checklist_categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tourId: integer('tour_id')
    .notNull()
    .references(() => tours.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type TourChecklistCategory = typeof tourChecklistCategories.$inferSelect;
export type NewTourChecklistCategory = typeof tourChecklistCategories.$inferInsert;

export const tourChecklistItems = sqliteTable('tour_checklist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tourId: integer('tour_id')
    .notNull()
    .references(() => tours.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  assignedTo: text('assigned_to').notNull(),
  completed: integer('completed').default(0),
  description: text('description').default(''),
  attachmentId: text('attachment_id'),
  attachmentName: text('attachment_name'),
  priority: text('priority').default('Medium'),
  quantity: integer('quantity').default(1),
  completedBy: text('completed_by').default('[]'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export type TourChecklistItem = typeof tourChecklistItems.$inferSelect;
export type NewTourChecklistItem = typeof tourChecklistItems.$inferInsert;
