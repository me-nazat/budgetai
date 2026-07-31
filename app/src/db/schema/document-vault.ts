import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

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
    extractionStatus: text('extraction_status').notNull().default('PROCESSING'), // 'PENDING', 'COMPLETED', 'FAILED'
    createdAt: integer('created_at').default(sql`(unixepoch())`),
  },
  (table) => [
    index('idx_document_user').on(table.userId),
  ]
);

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

export type DocumentMetadata = typeof documentMetadata.$inferSelect;
export type NewDocumentMetadata = typeof documentMetadata.$inferInsert;

export type DocumentLineItem = typeof documentLineItems.$inferSelect;
export type NewDocumentLineItem = typeof documentLineItems.$inferInsert;
