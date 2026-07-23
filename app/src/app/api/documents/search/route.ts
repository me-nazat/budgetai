export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { DocumentRepository } from '@/repositories/document.repository';

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Search query string is required' }, { status: 400 });
    }

    const matches = await DocumentRepository.searchDocuments(userId, query.trim());
    return NextResponse.json({ query, results: matches });
  })
);
