/**
 * @fileoverview Agentic AI schema — action logs, proactive insights, chat tool executions,
 * AI insights cache, per-tool action permissions, and insight feedback.
 *
 * Consolidates:
 * - Gen 2: agentic-ai.ts (agentActionLogs, proactiveInsights)
 * - Gen 1: index.ts Module 19 (chatToolExecutions, aiInsightsCache)
 * - Gen 3: ai-modules29.ts (module29ActionPermissions, module29InsightFeedback)
 *
 * @module db/schema/agentic-ai
 */

import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

/* ───────────────────────────────────────────────────────────────
   AGENT ACTION LOGS (Gen 2)
   ─────────────────────────────────────────────────────────────── */

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

export type AgentActionLog = typeof agentActionLogs.$inferSelect;
export type NewAgentActionLog = typeof agentActionLogs.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   PROACTIVE INSIGHTS (Gen 2)
   ─────────────────────────────────────────────────────────────── */

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
    generatedAt: integer('generated_at'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_insights_user_active').on(table.userId, table.isDismissed),
  ]
);

export type ProactiveInsight = typeof proactiveInsights.$inferSelect;
export type NewProactiveInsight = typeof proactiveInsights.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   CHAT TOOL EXECUTIONS (ex index.ts Gen 1 — Module 19)
   ─────────────────────────────────────────────────────────────── */

export const chatToolExecutions = sqliteTable(
  'chat_tool_executions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    chatMessageId: integer('chat_message_id'),
    toolName: text('tool_name').notNull(),
    parametersJson: text('parameters_json').notNull(),
    status: text('status', { enum: ['pending', 'confirmed', 'cancelled', 'executed'] })
      .notNull()
      .default('pending'),
    inverseOperationPayloadJson: text('inverse_operation_payload_json'),
    executedAt: text('executed_at'),
  },
  (table) => [
    index('idx_chat_tools_user').on(table.userId),
  ]
);

export type ChatToolExecution = typeof chatToolExecutions.$inferSelect;
export type NewChatToolExecution = typeof chatToolExecutions.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   AI INSIGHTS CACHE (ex index.ts Gen 1 — Module 19)
   ─────────────────────────────────────────────────────────────── */

export const aiInsightsCache = sqliteTable(
  'ai_insights_cache',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    insightType: text('insight_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    actionPayload: text('action_payload'),
    isDismissed: integer('is_dismissed').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_ai_insights_user').on(table.userId, table.isDismissed),
  ]
);

export type AiInsightCache = typeof aiInsightsCache.$inferSelect;
export type NewAiInsightCache = typeof aiInsightsCache.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   ACTION PERMISSIONS (ex ai-modules29.ts Gen 3)
   SQL table name preserved: module_29_action_permissions
   ─────────────────────────────────────────────────────────────── */

/** Allows users to revoke or grant autonomous actions (e.g. 'CREATE_TRANSACTION', 'UPDATE_BUDGET') */
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

export type Module29ActionPermission = typeof module29ActionPermissions.$inferSelect;
export type NewModule29ActionPermission = typeof module29ActionPermissions.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   INSIGHT FEEDBACK (ex ai-modules29.ts Gen 3)
   SQL table name preserved: module_29_insight_feedback
   ─────────────────────────────────────────────────────────────── */

/** Tracks user ratings ('helpful', 'not_helpful', 'dismissed') for generative tuning. */
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

export type Module29InsightFeedback = typeof module29InsightFeedback.$inferSelect;
export type NewModule29InsightFeedback = typeof module29InsightFeedback.$inferInsert;

