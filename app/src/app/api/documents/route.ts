export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { DocumentRepository } from '@/repositories/document.repository';
import { getGenAI } from '@/lib/ai';

export const GET = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const docs = await DocumentRepository.getDocuments(userId);
    return NextResponse.json({ documents: docs });
  })
);

export const POST = apiHandler(
  withAuth(async (request: NextRequest, { userId }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // AI Vision / OCR Text Extraction via Gemini API using getGenAI()
    let ocrText = '';
    let merchantName: string | null = null;
    let documentDate: string | null = null;
    let totalAmount: number | null = null;
    let taxAmount: number | null = null;
    let lineItems: Array<{ description: string; quantity?: number; unitPrice?: number; totalPrice: number }> = [];

    try {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const base64 = buffer.toString('base64');
        const genAI = getGenAI();
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Extract structured financial data from this receipt/statement/bill document.
Return a valid JSON object strictly matching this schema:
{
  "merchantName": "string or null",
  "documentDate": "YYYY-MM-DD or null",
  "totalAmount": number or null,
  "taxAmount": number or null,
  "lineItems": [
    { "description": "item name", "quantity": 1, "unitPrice": 10.0, "totalPrice": 10.0 }
  ],
  "rawText": "full plain extracted text from the document"
}
Do not enclose in markdown code fences. Respond with raw JSON only.`;

        const result = await model.generateContent([
          { text: prompt },
          { inlineData: { data: base64, mimeType: file.type } },
        ]);

        const rawResponse = result.response.text().trim().replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(rawResponse);
        merchantName = parsed.merchantName || null;
        documentDate = parsed.documentDate || null;
        totalAmount = typeof parsed.totalAmount === 'number' ? parsed.totalAmount : null;
        taxAmount = typeof parsed.taxAmount === 'number' ? parsed.taxAmount : null;
        if (Array.isArray(parsed.lineItems)) {
          lineItems = parsed.lineItems.map((li: any) => ({
            description: String(li.description || 'Item'),
            quantity: typeof li.quantity === 'number' ? li.quantity : 1,
            unitPrice: typeof li.unitPrice === 'number' ? li.unitPrice : null,
            totalPrice: typeof li.totalPrice === 'number' ? li.totalPrice : 0,
          }));
        }
        ocrText = parsed.rawText || rawResponse;
      }
    } catch {
      ocrText = `Extracted document text preview for ${file.name}`;
      merchantName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    }

    // Save document to DB with encrypted fields and in-process embedding
    const doc = await DocumentRepository.createDocument({
      userId,
      fileName: file.name,
      fileUrl: `/uploads/${Date.now()}_${file.name}`,
      fileType: file.type || 'application/octet-stream',
      fileSize: file.size,
      merchantName,
      documentDate,
      totalAmount,
      taxAmount,
      ocrRawText: ocrText,
      lineItems,
    });

    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  }),
  { rateLimit: 'upload' }
);
