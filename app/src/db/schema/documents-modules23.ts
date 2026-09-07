import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { documentMetadata } from './document-vault';
import { users } from './users';

/**
 * Module 23: Document Chunks for Semantic Search & RAG
 */
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

/**
 * Module 23: Search Query Log for Analytics and Semantic Cache
 */
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

export type Module23DocumentChunk = typeof module23DocumentChunks.$inferSelect;
export type NewModule23DocumentChunk = typeof module23DocumentChunks.$inferInsert;

export type Module23SearchQueryLog = typeof module23SearchQueryLog.$inferSelect;
export type NewModule23SearchQueryLog = typeof module23SearchQueryLog.$inferInsert;
