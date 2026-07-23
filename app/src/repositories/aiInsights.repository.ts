import { db } from '@/db/client';
import { chatToolExecutions, aiInsightsCache } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export class AiInsightsRepository {
  /** Create pending tool execution card in chat stream */
  static async createPendingToolExecution(data: {
    userId: number;
    chatMessageId?: number;
    toolName: string;
    parametersJson: string;
  }) {
    const [execution] = await db
      .insert(chatToolExecutions)
      .values({
        userId: data.userId,
        chatMessageId: data.chatMessageId,
        toolName: data.toolName,
        parametersJson: data.parametersJson,
        status: 'pending',
      })
      .returning();
    return execution;
  }

  /** Update tool execution status (confirm or cancel) */
  static async updateToolExecutionStatus(
    id: number,
    userId: number,
    status: 'confirmed' | 'cancelled' | 'executed'
  ) {
    const [updated] = await db
      .update(chatToolExecutions)
      .set({
        status,
        executedAt: status === 'executed' ? new Date().toISOString() : undefined,
      })
      .where(and(eq(chatToolExecutions.id, id), eq(chatToolExecutions.userId, userId)))
      .returning();
    return updated;
  }

  /** Get active insights cache for user */
  static async getActiveInsights(userId: number) {
    return await db
      .select()
      .from(aiInsightsCache)
      .where(and(eq(aiInsightsCache.userId, userId), eq(aiInsightsCache.isDismissed, 0)))
      .orderBy(sql`${aiInsightsCache.createdAt} DESC`);
  }

  /** Cache a new proactive insight recommendation */
  static async cacheInsight(data: {
    userId: number;
    insightType: string;
    title: string;
    description: string;
    actionPayload?: string;
  }) {
    const [insight] = await db
      .insert(aiInsightsCache)
      .values({
        userId: data.userId,
        insightType: data.insightType,
        title: data.title,
        description: data.description,
        actionPayload: data.actionPayload,
        isDismissed: 0,
      })
      .returning();
    return insight;
  }

  /** Dismiss an insight card */
  static async dismissInsight(id: number, userId: number) {
    return await db
      .update(aiInsightsCache)
      .set({ isDismissed: 1 })
      .where(and(eq(aiInsightsCache.id, id), eq(aiInsightsCache.userId, userId)));
  }
}
