export const dynamic = 'force-dynamic';

/**
 * @fileoverview Semantic Cosine-Similarity Search for AI Document Vault (Module 13).
 * Performs in-process cosine-similarity vector search against stored document embeddings
 * with substring fallback and search query logging.
 *
 * POST /api/documents/search
 *
 * @module api/documents/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { DocumentRepository } from '@/repositories/document.repository';
import { db } from '@/db/client';
import { module23SearchQueryLog } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { generateTextEmbedding } from '@/lib/ai/semanticVector';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { query = '' } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return NextResponse.json(
        { error: 'Search query must be a non-empty string' },
        { status: 400 }
      );
    }

    const normalizedQuery = query.trim().toLowerCase();

    // 1. Check module_23_search_query_log for cached query
    const [cachedQuery] = await db
      .select()
      .from(module23SearchQueryLog)
      .where(
        and(
          eq(module23SearchQueryLog.userId, userId),
          eq(module23SearchQueryLog.queryText, normalizedQuery)
        )
      )
      .orderBy(desc(module23SearchQueryLog.createdAt))
      .limit(1);

    // 2. Perform in-process semantic search with substring fallback via DocumentRepository
    const results = await DocumentRepository.searchDocuments(userId, query);

    // 3. Log search query asynchronously for analytics
    try {
      const queryVec = await generateTextEmbedding(normalizedQuery);
      const logId = `qlog_${crypto.randomUUID()}`;
      await db.insert(module23SearchQueryLog).values({
        id: logId,
        userId,
        queryText: normalizedQuery,
        queryEmbedding: JSON.stringify(queryVec),
        topChunkIds: JSON.stringify(results.slice(0, 5).map((r) => r.id)),
        resultCount: results.length,
        cacheHit: cachedQuery ? 1 : 0,
      });
    } catch {
      // Non-blocking log failure
    }

    return NextResponse.json({
      query,
      cacheHit: Boolean(cachedQuery),
      totalResults: results.length,
      results,
    });
  }),
  { rateLimit: 'api' }
);
