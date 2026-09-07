export const dynamic = 'force-dynamic';

/**
 * @fileoverview Background Embedding Pipeline Trigger for Document Vault (Module 13).
 * Splits document into chunks and generates 1536-dim vector embeddings.
 *
 * POST /api/documents/embed
 *
 * @module api/documents/embed
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import {
  documentMetadata,
  module23DocumentChunks,
  documentEmbeddings,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { chunkDocumentText, generateTextEmbedding } from '@/lib/ai/semanticVector';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    }

    // Verify ownership
    const [doc] = await db
      .select()
      .from(documentMetadata)
      .where(and(eq(documentMetadata.id, documentId), eq(documentMetadata.userId, userId)))
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 1. Mark as EMBEDDING
    await db
      .update(documentMetadata)
      .set({ embeddingStatus: 'EMBEDDING' })
      .where(eq(documentMetadata.id, documentId));

    try {
      const rawText = doc.ocrRawText || `${doc.merchantName || ''} - ${doc.fileName}\nTotal: $${doc.totalAmount || 0}`;
      const chunks = chunkDocumentText(rawText, 800);

      const createdChunkIds: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunkId = `chunk_${crypto.randomUUID()}`;
        const chunkText = chunks[i];
        const tokenCount = Math.ceil(chunkText.length / 4);

        // Save chunk
        await db.insert(module23DocumentChunks).values({
          id: chunkId,
          documentId,
          chunkIndex: i,
          chunkText,
          tokenCount,
        });
        createdChunkIds.push(chunkId);

        // Generate vector embedding
        const vector = await generateTextEmbedding(chunkText);

        // Save embedding
        await db.insert(documentEmbeddings).values({
          documentId: Number(documentId) || Math.abs(hashString(documentId)),
          chunkText,
          embeddingVector: JSON.stringify(vector),
        });
      }

      // 2. Mark as READY
      const now = Math.floor(Date.now() / 1000);
      await db
        .update(documentMetadata)
        .set({
          embeddingStatus: 'READY',
          embeddingCompletedAt: now,
        })
        .where(eq(documentMetadata.id, documentId));

      return NextResponse.json({
        success: true,
        documentId,
        status: 'READY',
        chunksCreated: chunks.length,
        chunkIds: createdChunkIds,
      });
    } catch (err: any) {
      console.error('Embedding pipeline failure:', err);
      await db
        .update(documentMetadata)
        .set({ embeddingStatus: 'FAILED' })
        .where(eq(documentMetadata.id, documentId));

      return NextResponse.json(
        { error: 'Embedding pipeline failed', details: err.message },
        { status: 500 }
      );
    }
  })
);

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
