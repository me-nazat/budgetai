import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/**
 * Module 29: Per-Tool Action Permissions
 * Allows users to revoke or grant autonomous actions (e.g. 'CREATE_TRANSACTION', 'UPDATE_BUDGET')
 */
export const module29ActionPermissions = sqliteTable(
  'module_29_action_permissions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    toolName: text('tool_name').notNull(),
    grantedAt: integer('granted_at').default(sql`(unixepoch())`),
    revokedAt: integer('revoked_at'),
  },
  (table) => [
    index('idx_m29_action_perm_user').on(table.userId, table.toolName),
  ]
);

/**
 * Module 29: Proactive Insight Feedback
 * Tracks user ratings ('helpful', 'not_helpful', 'dismissed') for generative tuning.
 */
export const module29InsightFeedback = sqliteTable(
  'module_29_insight_feedback',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    insightId: text('insight_id').notNull(),
    feedback: text('feedback', { enum: ['helpful', 'not_helpful', 'dismissed'] }).notNull(),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m29_feedback_user').on(table.userId, table.insightId),
  ]
);

export type Module29ActionPermission = typeof module29ActionPermissions.$inferSelect;
export type NewModule29ActionPermission = typeof module29ActionPermissions.$inferInsert;

export type Module29InsightFeedback = typeof module29InsightFeedback.$inferSelect;
export type NewModule29InsightFeedback = typeof module29InsightFeedback.$inferInsert;
