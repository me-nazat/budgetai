export const dynamic = 'force-dynamic';

/**
 * @fileoverview Background Embedding Pipeline Trigger for Document Vault (Module 13).
 * Generates vector embeddings using Gemini and encrypts them into documentMetadata.
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
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { chunkDocumentText, generateTextEmbedding } from '@/lib/ai/semanticVector';
import { encryptField, decryptField, isEncrypted } from '@/lib/crypto/encryption';

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
      let rawText = doc.ocrRawText || '';
      if (isEncrypted(rawText)) {
        try {
          rawText = decryptField(rawText, 'document-vault');
        } catch {}
      }
      if (!rawText) {
        rawText = `${doc.merchantName || ''} - ${doc.fileName}\nTotal: $${doc.totalAmount || 0}`;
      }

      // Generate document-level vector embedding
      const fullVector = await generateTextEmbedding(rawText);
      const encryptedEmbedding = encryptField(JSON.stringify(fullVector), 'document-vault');

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
      }

      // 2. Mark as READY and save encrypted embedding directly to documentMetadata
      const now = Math.floor(Date.now() / 1000);
      await db
        .update(documentMetadata)
        .set({
          embedding: encryptedEmbedding,
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
        { error: 'Embedding pipeline failed', details: err?.message },
        { status: 500 }
      );
    }
  }),
  { rateLimit: 'upload' }
);
