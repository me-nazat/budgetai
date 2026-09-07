export const dynamic = 'force-dynamic';

/**
 * @fileoverview Semantic Cosine-Similarity Search for AI Document Vault (Module 13).
 * Replaces keyword search with vector embeddings over OpenAI / Gemini vectors,
 * with caching in module_23_search_query_log.
 *
 * POST /api/documents/search
 *
 * @module api/documents/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  documentMetadata,
  module23DocumentChunks,
  module23SearchQueryLog,
  documentLineItems,
} from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import {
  generateTextEmbedding,
  cosineSimilarity,
  generateDeterministicEmbedding,
} from '@/lib/ai/semanticVector';

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

    // 1. Check module_23_search_query_log for cache hit
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

    // 2. Fetch all user's documents
    const userDocs = await db
      .select()
      .from(documentMetadata)
      .where(eq(documentMetadata.userId, userId));

    if (userDocs.length === 0) {
      return NextResponse.json({
        query,
        cacheHit: false,
        results: [],
      });
    }

    const docMap = new Map(userDocs.map((d) => [d.id, d]));

    // 3. Generate or retrieve query embedding
    let queryVec: number[];
    let cacheHit = false;

    if (cachedQuery?.queryEmbedding) {
      try {
        queryVec = JSON.parse(cachedQuery.queryEmbedding);
        cacheHit = true;
      } catch {
        queryVec = await generateTextEmbedding(normalizedQuery);
      }
    } else {
      queryVec = await generateTextEmbedding(normalizedQuery);
    }

    // 4. Retrieve materialized chunks for user's documents
    const chunks = await db
      .select()
      .from(module23DocumentChunks);

    // Filter chunks to user's documents
    const userChunks = chunks.filter((c) => docMap.has(c.documentId));

    interface ScoredChunk {
      documentId: string;
      chunkId: string;
      chunkText: string;
      score: number;
    }

    const scoredChunks: ScoredChunk[] = [];

    if (userChunks.length > 0) {
      for (const chunk of userChunks) {
        const chunkVec = generateDeterministicEmbedding(chunk.chunkText);
        const score = cosineSimilarity(queryVec, chunkVec);
        scoredChunks.push({
          documentId: chunk.documentId,
          chunkId: chunk.id,
          chunkText: chunk.chunkText,
          score,
        });
      }
    } else {
      // Fallback: evaluate document metadata directly if chunks not yet generated
      for (const doc of userDocs) {
        const docText = `${doc.merchantName || ''} ${doc.fileName} ${doc.ocrRawText || ''}`;
        const docVec = generateDeterministicEmbedding(docText);
        const score = cosineSimilarity(queryVec, docVec);
        scoredChunks.push({
          documentId: doc.id,
          chunkId: `doc_${doc.id}`,
          chunkText: doc.ocrRawText || `${doc.merchantName || ''} ${doc.fileName}`,
          score,
        });
      }
    }

    // Sort by score descending
    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, 10);

    // Group by document
    const groupedByDoc = new Map<string, ScoredChunk[]>();
    for (const item of topChunks) {
      const existing = groupedByDoc.get(item.documentId) || [];
      existing.push(item);
      groupedByDoc.set(item.documentId, existing);
    }

    // Fetch line items for matched documents
    const results = [];
    for (const [docId, matchedItems] of groupedByDoc.entries()) {
      const doc = docMap.get(docId)!;
      const lineItems = await db
        .select()
        .from(documentLineItems)
        .where(eq(documentLineItems.documentId, docId));

      const bestChunk = matchedItems[0];
      results.push({
        documentId: doc.id,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        merchantName: doc.merchantName || 'Receipt / Statement',
        documentDate: doc.documentDate || 'Recent',
        totalAmount: doc.totalAmount || 0,
        taxAmount: doc.taxAmount || 0,
        embeddingStatus: doc.embeddingStatus || 'READY',
        relevanceScore: Number(bestChunk.score.toFixed(3)),
        matchSnippet: highlightSnippet(bestChunk.chunkText, query),
        matchedChunks: matchedItems.map((m) => m.chunkText),
        lineItems: lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          totalPrice: li.totalPrice,
        })),
      });
    }

    // Sort final results by top relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // 5. Log query to module_23_search_query_log
    const logId = `qlog_${crypto.randomUUID()}`;
    await db.insert(module23SearchQueryLog).values({
      id: logId,
      userId,
      queryText: normalizedQuery,
      queryEmbedding: JSON.stringify(queryVec),
      topChunkIds: JSON.stringify(topChunks.map((c) => c.chunkId)),
      resultCount: results.length,
      cacheHit: cacheHit ? 1 : 0,
    });

    return NextResponse.json({
      query,
      cacheHit,
      totalResults: results.length,
      results,
    });
  })
);

function highlightSnippet(text: string, query: string): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  const qTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (qTerms.length === 0) return clean.slice(0, 160) + '...';

  // Find first match
  let firstIdx = -1;
  for (const term of qTerms) {
    const idx = clean.toLowerCase().indexOf(term);
    if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
      firstIdx = idx;
    }
  }

  if (firstIdx === -1) return clean.slice(0, 160) + '...';

  const start = Math.max(0, firstIdx - 40);
  const end = Math.min(clean.length, firstIdx + 120);
  const snippet = (start > 0 ? '...' : '') + clean.slice(start, end) + (end < clean.length ? '...' : '');
  return snippet;
}
