export const dynamic = 'force-dynamic';

/**
 * @fileoverview Vault-wide document export bundle API.
 *
 * GET /api/documents/export — Exports user's entire document vault (OCR metadata, linked transactions, categories).
 *
 * @module api/documents/export
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { DocumentRepository } from '@/repositories/document.repository';

export const GET = apiHandler(
  withAuth(async (_request: NextRequest, { userId }) => {
    const docs = await DocumentRepository.getDocuments(userId);

    const manifest = {
      exportedAt: new Date().toISOString(),
      totalDocuments: docs.length,
      documents: docs.map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        documentType: d.documentType,
        ocrText: d.ocrText,
        linkedTransactionId: d.linkedTransactionId,
        createdAt: d.createdAt,
      })),
    };

    const jsonString = JSON.stringify(manifest, null, 2);

    return new NextResponse(jsonString, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="WealthAI_Document_Vault_Manifest_${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  })
);
