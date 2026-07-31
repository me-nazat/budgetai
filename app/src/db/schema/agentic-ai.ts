import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

export const agentActionLogs = sqliteTable('agent_action_logs', {
  id: text('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionId: text('session_id'),
  actionType: text('action_type').notNull(), // 'CREATE_TRANSACTION', 'UPDATE_BUDGET', 'CREATE_GOAL'
  payloadJson: text('payload_json').notNull(),
  status: text('status').notNull().default('PENDING_APPROVAL'), // 'PENDING_APPROVAL', 'EXECUTED', 'REJECTED'
  executedAt: integer('executed_at'),
  createdAt: integer('created_at').default(sql`(unixepoch())`),
});

export const proactiveInsights = sqliteTable(
  'proactive_insights',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    insightType: text('insight_type').notNull(), // 'SPENDING_SPIKE', 'SUBSCRIPTION_LEAK', 'SAVINGS_OPPORTUNITY'
    severity: text('severity').notNull().default('INFO'), // 'INFO', 'WARNING', 'CRITICAL'
    title: text('title').notNull(),
    message: text('message').notNull(),
    actionLink: text('action_link'),
    isDismissed: integer('is_dismissed').notNull().default(0),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_insights_user_active').on(table.userId, table.isDismissed),
  ]
);

export type AgentActionLog = typeof agentActionLogs.$inferSelect;
export type NewAgentActionLog = typeof agentActionLogs.$inferInsert;

export type ProactiveInsight = typeof proactiveInsights.$inferSelect;
export type NewProactiveInsight = typeof proactiveInsights.$inferInsert;
