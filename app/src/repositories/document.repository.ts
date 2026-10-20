/**
 * @fileoverview Document Repository for Module 13 (AI Document Vault).
 *
 * Implements:
 * - Data storage into canonical documentMetadata and documentLineItems
 * - AES-256-GCM encryption at rest for ocrRawText and embedding vectors
 * - In-process cosine-similarity semantic vector search
 * - Substring keyword fallback search when AI embedding is offline
 *
 * @module repositories/document.repository
 */

import { db } from '@/db/client';
import { documentMetadata, documentLineItems, transactions } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { encryptField, decryptField, isEncrypted } from '@/lib/crypto/encryption';
import {
  generateTextEmbedding,
  cosineSimilarity,
  generateDeterministicEmbedding,
} from '@/lib/ai/semanticVector';

export interface DocumentCreateInput {
  userId: number;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize?: number;
  merchantName?: string | null;
  documentDate?: string | null;
  totalAmount?: number | null;
  taxAmount?: number | null;
  ocrRawText?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number | null;
    unitPrice?: number | null;
    totalPrice: number;
  }>;
}

export class DocumentRepository {
  /**
   * Helper to safely decrypt a text field if encrypted.
   */
  private static safeDecrypt(value: string | null | undefined, context: string = 'document-vault'): string {
    if (!value) return '';
    if (isEncrypted(value)) {
      try {
        return decryptField(value, context);
      } catch {
        return value;
      }
    }
    return value;
  }

  /**
   * Get all documents for a user, with in-memory decryption and line items.
   */
  static async getDocuments(userId: number) {
    const rawDocs = await db
      .select()
      .from(documentMetadata)
      .where(eq(documentMetadata.userId, userId))
      .orderBy(desc(documentMetadata.createdAt));

    if (rawDocs.length === 0) return [];

    const allLineItems = await db
      .select()
      .from(documentLineItems);

    const itemsByDocId = new Map<string, typeof allLineItems>();
    for (const item of allLineItems) {
      const list = itemsByDocId.get(item.documentId) || [];
      list.push(item);
      itemsByDocId.set(item.documentId, list);
    }

    return rawDocs.map((doc) => {
      const decryptedOcr = this.safeDecrypt(doc.ocrRawText, 'document-vault');
      const decryptedEmbedding = this.safeDecrypt(doc.embedding, 'document-vault');
      const lineItems = itemsByDocId.get(doc.id) || [];

      return {
        ...doc,
        ocrRawText: decryptedOcr,
        embedding: decryptedEmbedding,
        lineItems: lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          totalPrice: li.totalPrice,
        })),
      };
    });
  }

  /**
   * Get a single document by ID with in-memory decryption and line items.
   */
  static async getDocumentById(id: string, userId: number) {
    const [doc] = await db
      .select()
      .from(documentMetadata)
      .where(and(eq(documentMetadata.id, id), eq(documentMetadata.userId, userId)));

    if (!doc) return null;

    const lineItems = await db
      .select()
      .from(documentLineItems)
      .where(eq(documentLineItems.documentId, id));

    return {
      ...doc,
      ocrRawText: this.safeDecrypt(doc.ocrRawText, 'document-vault'),
      embedding: this.safeDecrypt(doc.embedding, 'document-vault'),
      lineItems: lineItems.map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        totalPrice: li.totalPrice,
      })),
    };
  }

  /**
   * Create document with Gemini embedding generation and field-level encryption.
   */
  static async createDocument(data: DocumentCreateInput) {
    const docId = `doc_${crypto.randomUUID()}`;
    const rawOcr = data.ocrRawText || '';
    const lineItemDesc = (data.lineItems || []).map((l) => l.description).join(' ');
    const fullTextForEmbedding = [
      data.merchantName || '',
      lineItemDesc,
      rawOcr,
      data.fileName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    // 1. Generate text embedding vector
    let embeddingVector: number[] = [];
    try {
      embeddingVector = await generateTextEmbedding(fullTextForEmbedding);
    } catch {
      embeddingVector = generateDeterministicEmbedding(fullTextForEmbedding);
    }

    // 2. Encrypt sensitive ocrRawText and embedding vector at rest
    const encryptedOcr = rawOcr ? encryptField(rawOcr, 'document-vault') : null;
    const encryptedEmbedding = embeddingVector.length > 0
      ? encryptField(JSON.stringify(embeddingVector), 'document-vault')
      : null;

    // 3. Insert document metadata
    const [inserted] = await db
      .insert(documentMetadata)
      .values({
        id: docId,
        userId: data.userId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize || 0,
        fileUrl: data.fileUrl,
        merchantName: data.merchantName || null,
        documentDate: data.documentDate || new Date().toISOString().split('T')[0],
        totalAmount: data.totalAmount ?? null,
        taxAmount: data.taxAmount ?? null,
        ocrRawText: encryptedOcr,
        embedding: encryptedEmbedding,
        extractionStatus: 'COMPLETED',
        embeddingStatus: 'READY',
        embeddingCompletedAt: Math.floor(Date.now() / 1000),
      })
      .returning();

    // 4. Insert line items if present
    if (data.lineItems && data.lineItems.length > 0) {
      for (const li of data.lineItems) {
        await db.insert(documentLineItems).values({
          id: `li_${crypto.randomUUID()}`,
          documentId: docId,
          description: li.description,
          quantity: li.quantity ?? 1,
          unitPrice: li.unitPrice ?? null,
          totalPrice: li.totalPrice,
        });
      }
    }

    return {
      ...inserted,
      ocrRawText: rawOcr,
      embedding: JSON.stringify(embeddingVector),
      lineItems: data.lineItems || [],
    };
  }

  /**
   * Delete a document by ID and verify user ownership.
   */
  static async deleteDocument(id: string, userId: number) {
    const [existing] = await db
      .select({ id: documentMetadata.id })
      .from(documentMetadata)
      .where(and(eq(documentMetadata.id, id), eq(documentMetadata.userId, userId)))
      .limit(1);

    if (!existing) return false;

    // Delete associated line items first
    await db.delete(documentLineItems).where(eq(documentLineItems.documentId, id));
    // Delete document
    await db.delete(documentMetadata).where(eq(documentMetadata.id, id));
    return true;
  }

  /**
   * Search documents using fast deterministic multi-field matching
   * (merchant, fileName, OCR raw text, exact/range amounts, line items, document date)
   * blended with in-process cosine similarity fallback.
   */
  static async searchDocuments(userId: number, query: string) {
    const userDocs = await this.getDocuments(userId);
    if (userDocs.length === 0) return [];

    const queryRaw = query.trim();
    const queryClean = queryRaw.toLowerCase();
    if (!queryClean) return userDocs.map((d) => ({ ...d, relevanceScore: 1.0, matchSnippet: d.merchantName || d.fileName }));

    // Extract potential currency or numerical query (e.g. "$45.00" -> 45, "120" -> 120)
    const numMatch = queryClean.replace(/[^0-9.]/g, '');
    const queryAmount = numMatch ? parseFloat(numMatch) : null;
    const isAmountQuery = queryAmount !== null && !isNaN(queryAmount);

    let queryVector: number[] = [];
    let embeddingSuccess = true;

    try {
      queryVector = await generateTextEmbedding(queryClean);
    } catch {
      embeddingSuccess = false;
    }

    const queryTerms = queryClean
      .split(/\s+/)
      .map((t) => t.replace(/[^a-z0-9]/g, ''))
      .filter((t) => t.length >= 2);

    const scored = userDocs.map((doc) => {
      let deterministicScore = 0;
      let matchSnippet = '';

      const merchant = (doc.merchantName || '').toLowerCase();
      const fileName = (doc.fileName || '').toLowerCase();
      const docDate = (doc.documentDate || '').toLowerCase();
      const ocrText = (doc.ocrRawText || '').toLowerCase();
      const lineItemTexts = (doc.lineItems || []).map((l) => `${l.description} ${l.totalPrice}`.toLowerCase());
      const fullSearchable = `${merchant} ${fileName} ${docDate} ${ocrText} ${lineItemTexts.join(' ')}`;

      // 1. Exact merchant or filename match
      if (merchant && merchant === queryClean) {
        deterministicScore = Math.max(deterministicScore, 1.0);
        matchSnippet = `Exact merchant: ${doc.merchantName}`;
      } else if (fileName && (fileName === queryClean || fileName.includes(queryClean))) {
        deterministicScore = Math.max(deterministicScore, 0.95);
        matchSnippet = `File match: ${doc.fileName}`;
      } else if (merchant && merchant.includes(queryClean)) {
        deterministicScore = Math.max(deterministicScore, 0.92);
        matchSnippet = `Merchant: ${doc.merchantName}`;
      }

      // 2. Amount match
      if (isAmountQuery && doc.totalAmount !== null && doc.totalAmount !== undefined) {
        const diff = Math.abs(doc.totalAmount - queryAmount);
        if (diff < 0.01) {
          deterministicScore = Math.max(deterministicScore, 0.96);
          matchSnippet = matchSnippet || `Exact amount: $${doc.totalAmount.toFixed(2)}`;
        } else if (diff <= doc.totalAmount * 0.05) {
          deterministicScore = Math.max(deterministicScore, 0.85);
          matchSnippet = matchSnippet || `Approx. amount: $${doc.totalAmount.toFixed(2)}`;
        }
      }

      // 3. Line item exact / partial matches
      const matchedLine = (doc.lineItems || []).find((li) => {
        const descLower = li.description.toLowerCase();
        if (descLower.includes(queryClean)) return true;
        if (isAmountQuery && Math.abs(li.totalPrice - queryAmount) < 0.01) return true;
        return queryTerms.length > 0 && queryTerms.some((t) => descLower.includes(t));
      });

      if (matchedLine) {
        deterministicScore = Math.max(deterministicScore, 0.90);
        matchSnippet = matchSnippet || `Line item: ${matchedLine.description} ($${matchedLine.totalPrice.toFixed(2)})`;
      }

      // 4. Multi-token OCR text matching
      if (queryTerms.length > 0) {
        let matchedTerms = 0;
        for (const term of queryTerms) {
          if (fullSearchable.includes(term)) {
            matchedTerms++;
          }
        }
        const termRatio = matchedTerms / queryTerms.length;
        if (termRatio > 0) {
          const textScore = 0.5 + termRatio * 0.4;
          deterministicScore = Math.max(deterministicScore, textScore);
        }
      }

      // 5. OCR text phrase match
      if (ocrText && ocrText.includes(queryClean)) {
        deterministicScore = Math.max(deterministicScore, 0.88);
        const idx = ocrText.indexOf(queryClean);
        const start = Math.max(0, idx - 40);
        const end = Math.min(doc.ocrRawText!.length, idx + 100);
        matchSnippet = matchSnippet || (start > 0 ? '...' : '') + doc.ocrRawText!.slice(start, end) + '...';
      }

      // 6. Vector Cosine Similarity Fallback / Blend
      let cosineScore = 0;
      if (embeddingSuccess && doc.embedding) {
        try {
          const docVec: number[] = JSON.parse(doc.embedding);
          cosineScore = cosineSimilarity(queryVector, docVec);
        } catch {
          cosineScore = 0;
        }
      }

      // Prioritize strong deterministic match; otherwise blend with vector similarity
      let finalScore = deterministicScore;
      if (deterministicScore < 0.7 && cosineScore > 0) {
        finalScore = Math.max(deterministicScore, cosineScore);
      } else if (deterministicScore >= 0.7 && cosineScore > 0) {
        finalScore = Math.min(1.0, deterministicScore * 0.85 + cosineScore * 0.15);
      }

      if (!matchSnippet) {
        if (doc.ocrRawText) {
          matchSnippet = doc.ocrRawText.slice(0, 120).trim() + '...';
        } else {
          matchSnippet = `Matched: ${doc.merchantName || doc.fileName}`;
        }
      }

      return {
        ...doc,
        relevanceScore: Math.round(finalScore * 100) / 100,
        matchSnippet,
      };
    });

    // Sort descending by relevance score, filter minimum threshold
    return scored
      .filter((d) => d.relevanceScore > 0.05)
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
