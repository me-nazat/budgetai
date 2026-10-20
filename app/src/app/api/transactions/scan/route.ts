export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { processDocumentOCR } from '@/lib/ai/ocrPipeline';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const form = await request.formData();
    const file = form.get('file') as File | null;
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || 'image/jpeg';

    if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'Unsupported file format for scanning' }, { status: 400 });
    }

    const ocrData = await processDocumentOCR(buffer, mimeType);

    return NextResponse.json({
      merchant: ocrData.merchantName,
      date: ocrData.documentDate,
      totalAmount: ocrData.totalAmount,
      taxAmount: ocrData.taxAmount,
      currency: ocrData.currency || 'BDT',
      suggestedCategory: ocrData.suggestedCategory || 'Other',
      lineItems: ocrData.lineItems,
      rawSummary: ocrData.rawSummary,
      // Compatibility aliases
      amount: ocrData.totalAmount,
      description: ocrData.merchantName,
      category: ocrData.suggestedCategory || 'Other',
      type: 'expense',
      transactions: [
        {
          description: ocrData.merchantName,
          amount: ocrData.totalAmount,
          category: ocrData.suggestedCategory || 'Other',
          date: ocrData.documentDate,
          type: 'expense',
        },
      ],
    });
  } catch (error) {
    console.error('Scan error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to scan document' },
      { status: 500 }
    );
  }
}
