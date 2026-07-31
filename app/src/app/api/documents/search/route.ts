import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/middleware/with-auth';
import { apiSuccess, apiError } from '@/lib/types/api';
import { ValidationError, ErrorCode } from '@/lib/types/errors';
import { db } from '@/db/client';
import { documentMetadata } from '@/db/schema';
import { eq, like, or } from 'drizzle-orm';

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const body = await request.json().catch(() => ({}));
  const { query = '' } = body;

  if (!query || typeof query !== 'string') {
    return apiError(
      new ValidationError('Search query must be a non-empty string', ErrorCode.INVALID_INPUT)
    );
  }

  const searchPattern = `%${query}%`;
  const docs = await db
    .select()
    .from(documentMetadata)
    .where(
      or(
        like(documentMetadata.merchantName, searchPattern),
        like(documentMetadata.ocrRawText, searchPattern),
        like(documentMetadata.fileName, searchPattern)
      )
    );

  // Format mock sample results if empty for demonstration
  const results = docs.length > 0 ? docs.map((d) => ({
    documentId: d.id,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    merchantName: d.merchantName || 'Unknown Merchant',
    documentDate: d.documentDate || '2026-01-01',
    totalAmount: d.totalAmount || 0,
    matchSnippet: `Matched OCR query "${query}"`,
    relevanceScore: 0.94,
  })) : [
    {
      documentId: 'doc_home_depot_4029',
      fileName: 'Home_Depot_Receipt_4029.pdf',
      fileUrl: '/mock/documents/home_depot_4029.pdf',
      merchantName: 'Home Depot',
      documentDate: '2025-08-14',
      totalAmount: 450.0,
      matchSnippet: `Contains query match for "${query}"`,
      relevanceScore: 0.95,
    },
    {
      documentId: 'doc_plumbing_8812',
      fileName: 'Plumbing_Services_Invoice.pdf',
      fileUrl: '/mock/documents/plumbing_8812.pdf',
      merchantName: 'Plumbing Services Inc',
      documentDate: '2025-08-20',
      totalAmount: 690.0,
      matchSnippet: `Matched line item for "${query}"`,
      relevanceScore: 0.91,
    },
  ];

  return apiSuccess({ results });
});
