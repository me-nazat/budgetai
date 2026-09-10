/**
 * @fileoverview Document vault schema — metadata, line items, semantic chunks,
 * and search query logging for RAG.
 *
 * Consolidates:
 * - Gen 2: document-vault.ts (documentMetadata, documentLineItems)
 * - Gen 3: documents-modules23.ts (module23DocumentChunks, module23SearchQueryLog)
 *
 * @module db/schema/document-vault
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { transactions } from './transactions';

/* ───────────────────────────────────────────────────────────────
   DOCUMENT METADATA (Gen 2)
   ─────────────────────────────────────────────────────────────── */

export const documentMetadata = sqliteTable(
  'document_metadata',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    fileType: text('file_type').notNull(), // 'pdf', 'image/png', 'image/jpeg'
    fileSize: integer('file_size').notNull(),
    fileUrl: text('file_url').notNull(),
    merchantName: text('merchant_name'),
    documentDate: text('document_date'),
    totalAmount: real('total_amount'),
    taxAmount: real('tax_amount'),
    ocrRawText: text('ocr_raw_text'),
    embedding: text('embedding'), // JSON-encoded float array or encrypted text
    extractionStatus: text('extraction_status').notNull().default('PROCESSING'), // 'PENDING', 'COMPLETED', 'FAILED'
    embeddingStatus: text('embedding_status', { enum: ['PENDING', 'EMBEDDING', 'READY', 'FAILED'] }).notNull().default('PENDING'),
    embeddingCompletedAt: integer('embedding_completed_at'),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_document_user').on(table.userId),
  ]
);

export type DocumentMetadata = typeof documentMetadata.$inferSelect;
export type NewDocumentMetadata = typeof documentMetadata.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   DOCUMENT LINE ITEMS (Gen 2)
   ─────────────────────────────────────────────────────────────── */

export const documentLineItems = sqliteTable('document_line_items', {
  id: text('id').primaryKey(),
  documentId: text('document_id')
    .notNull()
    .references(() => documentMetadata.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  quantity: real('quantity').default(1),
  unitPrice: real('unit_price'),
  totalPrice: real('total_price').notNull(),
});

export type DocumentLineItem = typeof documentLineItems.$inferSelect;
export type NewDocumentLineItem = typeof documentLineItems.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   DOCUMENT CHUNKS (ex documents-modules23.ts Gen 3)
   SQL table name preserved: module_23_document_chunks
   ─────────────────────────────────────────────────────────────── */

export const module23DocumentChunks = sqliteTable(
  'module_23_document_chunks',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documentMetadata.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    chunkText: text('chunk_text').notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m23_chunks_doc').on(table.documentId),
  ]
);

export type Module23DocumentChunk = typeof module23DocumentChunks.$inferSelect;
export type NewModule23DocumentChunk = typeof module23DocumentChunks.$inferInsert;

/* ───────────────────────────────────────────────────────────────
   SEARCH QUERY LOG (ex documents-modules23.ts Gen 3)
   SQL table name preserved: module_23_search_query_log
   ─────────────────────────────────────────────────────────────── */

export const module23SearchQueryLog = sqliteTable(
  'module_23_search_query_log',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    queryText: text('query_text').notNull(),
    queryEmbedding: text('query_embedding'), // JSON encoded float array
    topChunkIds: text('top_chunk_ids'), // JSON array of matched chunk IDs
    resultCount: integer('result_count').notNull().default(0),
    cacheHit: integer('cache_hit').notNull().default(0),
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_m23_query_user').on(table.userId),
    index('idx_m23_query_text').on(table.queryText),
  ]
);

export type Module23SearchQueryLog = typeof module23SearchQueryLog.$inferSelect;
export type NewModule23SearchQueryLog = typeof module23SearchQueryLog.$inferInsert;



