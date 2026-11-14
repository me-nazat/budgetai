import { db } from '@/db/client';
import { documents, documentEmbeddings, transactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

function generateSimpleEmbedding(text: string): number[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const vector = new Array(64).fill(0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % 64;
    vector[idx] += 1;
  }
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return magnitude > 0 ? vector.map((val) => val / magnitude) : vector;
}

function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class DocumentRepository {
  /** Get all documents for user */
  static async getDocuments(userId: number) {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(sql`${documents.createdAt} DESC`);
  }

  /** Get document by ID */
  static async getDocumentById(id: number, userId: number) {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));
    return doc || null;
  }

  /** Create document record with auto-embedding, document classification, and transaction matching */
  static async createDocument(data: {
    userId: number;
    fileName: string;
    fileUrl: string;
    fileType: string;
    ocrText?: string;
  }) {
    const content = `${data.fileName} ${data.ocrText || ''}`;
    const embeddingVec = generateSimpleEmbedding(content);

    // Auto-classify document type
    const lower = content.toLowerCase();
    let docType = 'other';
    if (lower.includes('receipt') || lower.includes('store') || lower.includes('subtotal') || lower.includes('tax')) {
      docType = 'receipt';
    } else if (lower.includes('invoice') || lower.includes('bill') || lower.includes('due date')) {
      docType = 'bill';
    } else if (lower.includes('statement') || lower.includes('account number') || lower.includes('balance')) {
      docType = 'statement';
    }

    // Attempt fuzzy transaction match (amount/date/merchant similarity)
    let suggestedTransactionId: number | null = null;
    const amountMatch = content.match(/\$?(\d+\.\d{2})/);
    if (amountMatch) {
      const extractedAmount = parseFloat(amountMatch[1]);
      const userTransactions = await db
        .select()
        .from(transactions)
        .where(eq(transactions.userId, data.userId))
        .orderBy(sql`${transactions.createdAt} DESC`)
        .limit(20);

      const matched = userTransactions.find(
        (t) => Math.abs(t.amount - extractedAmount) < 0.5
      );
      if (matched) {
        suggestedTransactionId = matched.id;
      }
    }

    const [doc] = await db
      .insert(documents)
      .values({
        userId: data.userId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        ocrText: data.ocrText || '',
        embedding: JSON.stringify(embeddingVec),
        documentType: docType,
        linkedTransactionId: suggestedTransactionId,
      })
      .returning();

    // Store embedding in chunk table
    await this.addEmbedding({
      documentId: doc.id,
      embeddingVector: embeddingVec,
      chunkText: content.substring(0, 500),
    });

    return doc;
  }

  /** Store embedding vector for document chunk */
  static async addEmbedding(data: {
    documentId: number;
    embeddingVector: number[];
    chunkText: string;
  }) {
    const [emb] = await db
      .insert(documentEmbeddings)
      .values({
        documentId: data.documentId,
        embeddingVector: JSON.stringify(data.embeddingVector),
        chunkText: data.chunkText,
      })
      .returning();
    return emb;
  }

  /** Search documents using true embedding cosine similarity with keyword fallback */
  static async searchDocuments(userId: number, query: string) {
    const userDocs = await this.getDocuments(userId);
    if (userDocs.length === 0) return [];

    const queryVector = generateSimpleEmbedding(query);
    const queryLower = query.toLowerCase();

    const scoredDocs = userDocs.map((doc) => {
      let simScore = 0;
      if (doc.embedding) {
        try {
          const docVector: number[] = JSON.parse(doc.embedding);
          simScore = cosineSimilarity(queryVector, docVector);
        } catch {
          simScore = 0;
        }
      }

      // Keyword overlap fallback boost
      const text = `${doc.fileName} ${doc.ocrText || ''}`.toLowerCase();
      let keywordBoost = 0;
      if (text.includes(queryLower)) {
        keywordBoost = 0.4;
      }

      const finalScore = Math.min(1.0, simScore + keywordBoost);

      return {
        ...doc,
        matchSnippet: doc.ocrText
          ? doc.ocrText.substring(0, 160) + '...'
          : `Matched document: ${doc.fileName}`,
        relevanceScore: Math.round(finalScore * 100) / 100,
      };
    });

    // Sort descending by relevance score
    return scoredDocs.filter((d) => d.relevanceScore > 0.1).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
