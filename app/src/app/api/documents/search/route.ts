export const dynamic = 'force-dynamic';

/**
 * @fileoverview AI Semantic Search API for Document Vault.
 *
 * POST /api/documents/search
 * Natural language queries over receipt OCR text & metadata.
 *
 * @module api/documents/search
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { queryAll } from '@/lib/db';

const SearchSchema = z.object({
  query: z.string().min(1).max(200),
});

export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request, { userId }) => {
    const body = await request.json();
    const { query } = SearchSchema.parse(body);

    const q = query.toLowerCase();

    const docs = await queryAll<{
      id: number;
      file_name: string;
      file_type: string;
      merchant_name: string | null;
      amount: number | null;
      extracted_text: string | null;
      uploaded_at: string;
    }>(
      `SELECT * FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC`,
      [userId]
    );

    // Simple semantic match score
    const scored = docs.map(doc => {
      let score = 0;
      const text = `${doc.file_name} ${doc.merchant_name || ''} ${doc.extracted_text || ''}`.toLowerCase();

      const words = q.split(/\s+/);
      words.forEach(w => {
        if (text.includes(w)) score += 1;
      });

      return { doc, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

    return NextResponse.json({
      query,
      results: scored.map(s => s.doc),
      totalMatches: scored.length,
    });
  }),
  { rateLimit: 'api' }
);
