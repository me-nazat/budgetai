export const dynamic = 'force-dynamic';

/**
 * @fileoverview Natural Language RAG Q&A Route for AI Document Vault (Module 13).
 * Answers questions about receipts, bills, and statements using top matched chunks.
 *
 * POST /api/documents/ask
 *
 * @module api/documents/ask
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { db } from '@/db/client';
import { documentMetadata, module23DocumentChunks } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  generateTextEmbedding,
  cosineSimilarity,
  generateDeterministicEmbedding,
  sanitizeRAGContext,
} from '@/lib/ai/semanticVector';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json().catch(() => ({}));
    const { question = '', documentId } = body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return NextResponse.json(
        { error: 'Question must be a non-empty string' },
        { status: 400 }
      );
    }

    // 1. Fetch user's documents
    const queryCond = documentId
      ? and(eq(documentMetadata.userId, userId), eq(documentMetadata.id, documentId))
      : eq(documentMetadata.userId, userId);

    const userDocs = await db
      .select()
      .from(documentMetadata)
      .where(queryCond);

    if (userDocs.length === 0) {
      return NextResponse.json({
        question,
        answer: 'You do not have any documents in your vault matching this query. Please upload receipts or bank statements to ask questions.',
        sources: [],
      });
    }

    const docMap = new Map(userDocs.map((d) => [d.id, d]));

    // 2. Fetch chunks
    const allChunks = await db.select().from(module23DocumentChunks);
    const relevantChunks = allChunks.filter((c) => docMap.has(c.documentId));

    // 3. Rank chunks against question embedding
    const questionVec = await generateTextEmbedding(question);

    interface Scored {
      documentId: string;
      chunkText: string;
      score: number;
    }

    const scored: Scored[] = [];
    if (relevantChunks.length > 0) {
      for (const c of relevantChunks) {
        const cVec = generateDeterministicEmbedding(c.chunkText);
        const score = cosineSimilarity(questionVec, cVec);
        scored.push({
          documentId: c.documentId,
          chunkText: c.chunkText,
          score,
        });
      }
    } else {
      for (const d of userDocs) {
        const text = `${d.merchantName || ''} ${d.fileName} ${d.ocrRawText || ''}`;
        const dVec = generateDeterministicEmbedding(text);
        const score = cosineSimilarity(questionVec, dVec);
        scored.push({
          documentId: d.id,
          chunkText: text,
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const topContext = scored.slice(0, 5);

    // 4. Build sanitized context
    const contextLines = topContext.map((c, i) => {
      const doc = docMap.get(c.documentId);
      const safeText = sanitizeRAGContext(c.chunkText);
      return `[Doc #${i + 1}: ${doc?.merchantName || doc?.fileName || 'Document'}, Date: ${doc?.documentDate || 'N/A'}, Total: $${doc?.totalAmount || 0}]\n${safeText}`;
    }).join('\n\n---\n\n');

    const sources = topContext.map((c) => {
      const doc = docMap.get(c.documentId)!;
      return {
        documentId: doc.id,
        fileName: doc.fileName,
        merchantName: doc.merchantName || 'Receipt / Invoice',
        documentDate: doc.documentDate || 'Recent',
        totalAmount: doc.totalAmount || 0,
        snippet: c.chunkText.slice(0, 140) + '...',
      };
    });

    // 5. Generate Answer via Gemini with Fallback
    let answer = '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const prompt = `You are an expert financial assistant analyzing the user's financial documents and receipts.
Answer the user's question accurately, concisely, and specifically using ONLY the provided document context.
If the information is not present in the context, clearly say so. Never invent numbers or dates.

Context:
${contextLines}

User Question: "${question}"

Provide a clear, helpful response:`;

        const result = await model.generateContent(prompt);
        answer = result.response.text().trim();
      } catch (err) {
        console.warn('Gemini RAG fallback:', err);
      }
    }

    if (!answer) {
      // Offline / Test deterministic synthesis
      const matchedMerchants = sources.map((s) => s.merchantName).join(', ');
      const matchedSum = sources.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
      answer = `Based on your documents (${matchedMerchants}), the relevant items indicate a combined total of $${matchedSum.toFixed(2)}. ${sources[0]?.snippet ? `Specifically from ${sources[0].merchantName}: "${sources[0].snippet}"` : ''}`;
    }

    return NextResponse.json({
      question,
      answer,
      sources,
    });
  })
);
