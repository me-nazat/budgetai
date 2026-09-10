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
   * Search documents using true in-process cosine similarity with substring fallback.
   */
  static async searchDocuments(userId: number, query: string) {
    const userDocs = await this.getDocuments(userId);
    if (userDocs.length === 0) return [];

    const queryClean = query.trim().toLowerCase();
    let queryVector: number[] = [];
    let embeddingSuccess = true;

    try {
      queryVector = await generateTextEmbedding(queryClean);
    } catch {
      embeddingSuccess = false;
    }

    const scored = userDocs.map((doc) => {
      let cosineScore = 0;
      let matchedViaEmbedding = false;

      if (embeddingSuccess && doc.embedding) {
        try {
          const docVec: number[] = JSON.parse(doc.embedding);
          cosineScore = cosineSimilarity(queryVector, docVec);
          matchedViaEmbedding = true;
        } catch {
          cosineScore = 0;
        }
      }

      // Keyword & line-item overlap fallback / boost
      const searchableText = [
        doc.fileName,
        doc.merchantName || '',
        doc.ocrRawText || '',
        ...(doc.lineItems || []).map((l) => l.description),
      ]
        .join(' ')
        .toLowerCase();

      let keywordMatch = 0;
      const terms = queryClean.split(/\s+/).filter((t) => t.length > 2);
      let matchedTermsCount = 0;

      for (const term of terms) {
        if (searchableText.includes(term)) {
          matchedTermsCount++;
        }
      }

      if (terms.length > 0 && matchedTermsCount > 0) {
        keywordMatch = matchedTermsCount / terms.length;
      }

      // Final hybrid score: if embedding succeeded, blend cosine + keyword; otherwise pure keyword
      const finalScore = matchedViaEmbedding
        ? Math.min(1.0, Math.max(0, cosineScore * 0.7 + keywordMatch * 0.3))
        : keywordMatch;

      // Extract best matching line item or OCR snippet
      let matchSnippet = '';
      const matchedLine = (doc.lineItems || []).find((li) =>
        li.description.toLowerCase().includes(queryClean) ||
        terms.some((t) => li.description.toLowerCase().includes(t))
      );

      if (matchedLine) {
        matchSnippet = `Line match: ${matchedLine.description} (${matchedLine.totalPrice})`;
      } else if (doc.ocrRawText) {
        const idx = doc.ocrRawText.toLowerCase().indexOf(queryClean);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(doc.ocrRawText.length, idx + 100);
          matchSnippet = (start > 0 ? '...' : '') + doc.ocrRawText.slice(start, end) + '...';
        } else {
          matchSnippet = doc.ocrRawText.slice(0, 120) + '...';
        }
      } else {
        matchSnippet = `Matched: ${doc.merchantName || doc.fileName}`;
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
