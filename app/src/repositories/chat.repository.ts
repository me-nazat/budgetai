/**
 * @fileoverview Chat repository — data access for AI conversation history.
 *
 * @module repositories/chat.repository
 */

import { db } from '@/db/client';
import { chatMessages } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Input data for storing a chat message.
 */
export interface CreateChatMessageInput {
  userId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: 'chat' | 'silent';
  sessionId?: string;
}

/**
 * ChatRepository — data access for AI conversation history.
 */
export class ChatRepository {
  /**
   * Retrieves recent chat messages for a user session.
   *
   * @param userId - The user's ID.
   * @param sessionId - Optional session ID for filtering.
   * @param limit - Maximum messages to return (default: 50).
   * @returns Array of chat messages, newest first.
   */
  static async findRecent(
    userId: number,
    sessionId?: string,
    limit: number = 50
  ): Promise<Array<typeof chatMessages.$inferSelect>> {
    const conditions = [eq(chatMessages.userId, userId)];

    if (sessionId) {
      conditions.push(eq(chatMessages.sessionId, sessionId));
    }

    return db
      .select()
      .from(chatMessages)
      .where(and(...conditions))
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit);
  }

  /**
   * Creates a new chat message.
   *
   * @param data - Message data.
   * @returns The created message record.
   */
  static async create(
    data: CreateChatMessageInput
  ): Promise<typeof chatMessages.$inferSelect> {
    const result = await db
      .insert(chatMessages)
      .values({
        userId: data.userId,
        role: data.role,
        content: data.content,
        mode: data.mode || 'chat',
        sessionId: data.sessionId,
      })
      .returning();

    return result[0];
  }

  /**
   * Deletes all chat messages for a specific session.
   *
   * @param userId - The user's ID.
   * @param sessionId - The session ID to clear.
   */
  static async clearSession(
    userId: number,
    sessionId: string
  ): Promise<void> {
    await db
      .delete(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          eq(chatMessages.sessionId, sessionId)
        )
      );
  }
}
