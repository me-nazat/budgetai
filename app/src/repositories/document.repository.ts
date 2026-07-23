import { db } from '@/db/client';
import { documents, documentEmbeddings } from '@/db/schema';
import { eq, and, sql, like } from 'drizzle-orm';

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

  /** Create document record */
  static async createDocument(data: {
    userId: number;
    fileName: string;
    fileUrl: string;
    fileType: string;
    ocrText?: string;
  }) {
    const [doc] = await db
      .insert(documents)
      .values({
        userId: data.userId,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        ocrText: data.ocrText || '',
      })
      .returning();
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

  /** Search documents by text match / semantic similarity */
  static async searchDocuments(userId: number, query: string) {
    // 1. Text match search on OCR text and file names
    const textMatches = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          sql`(${documents.fileName} LIKE ${`%${query}%`} OR ${documents.ocrText} LIKE ${`%${query}%`})`
        )
      );

    return textMatches.map((doc) => ({
      ...doc,
      matchSnippet: doc.ocrText
        ? doc.ocrText.substring(0, 160) + '...'
        : `Matched document filename: ${doc.fileName}`,
      relevanceScore: 0.95,
    }));
  }
}
