export const dynamic = 'force-dynamic';

/**
 * @fileoverview Documents Vault API — Upload, index, and list stored receipts & invoices.
 *
 * GET  — List documents with category/search filters
 * POST — Index a new document
 *
 * @module api/documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll, queryOne, run } from '@/lib/db';

const DocSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().default('image/jpeg'),
  driveFileId: z.string().optional(),
  linkedTransactionId: z.number().int().optional(),
  merchantName: z.string().optional(),
  amount: z.number().optional(),
  extractedText: z.string().optional(),
});

export const GET = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    await run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT DEFAULT 'image/jpeg',
        drive_file_id TEXT,
        linked_transaction_id INTEGER,
        merchant_name TEXT,
        amount REAL,
        extracted_text TEXT,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const url = new URL(request.url);
    const search = url.searchParams.get('q')?.toLowerCase() || '';

    let sql = 'SELECT * FROM documents WHERE user_id = ?';
    const params: unknown[] = [userId];

    if (search) {
      sql += ' AND (LOWER(file_name) LIKE ? OR LOWER(merchant_name) LIKE ? OR LOWER(extracted_text) LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY uploaded_at DESC LIMIT 100';

    const docs = await queryAll<{
      id: number;
      file_name: string;
      file_type: string;
      drive_file_id: string | null;
      linked_transaction_id: number | null;
      merchant_name: string | null;
      amount: number | null;
      extracted_text: string | null;
      uploaded_at: string;
    }>(sql, params);

    return NextResponse.json({ documents: docs });
  })
);

export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const v = DocSchema.parse(body);

    await run(`
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT DEFAULT 'image/jpeg',
        drive_file_id TEXT,
        linked_transaction_id INTEGER,
        merchant_name TEXT,
        amount REAL,
        extracted_text TEXT,
        uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const result = await run(
      `INSERT INTO documents (user_id, file_name, file_type, drive_file_id, linked_transaction_id, merchant_name, amount, extracted_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, v.fileName, v.fileType, v.driveFileId || null, v.linkedTransactionId || null, v.merchantName || null, v.amount || null, v.extractedText || null]
    );

    return NextResponse.json({ id: result.lastInsertRowid, message: 'Document indexed successfully' }, { status: 201 });
  }),
  { rateLimit: 'api' }
);
