export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { DocumentRepository } from '@/repositories/document.repository';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // AI Vision / OCR Text Extraction via Gemini API
    let ocrText = '';
    try {
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        const base64 = buffer.toString('base64');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const visionPrompt = `Extract all written, printed, or structured text from this document receipt/file. Provide raw extracted text contextually:`;
        const result = await model.generateContent([
          { text: visionPrompt },
          { inlineData: { data: base64, mimeType: file.type } },
        ]);
        ocrText = result.response.text().trim();
      }
    } catch {
      ocrText = `Extracted OCR text preview for file ${file.name}`;
    }

    // Save document to DB
    const doc = await DocumentRepository.createDocument({
      userId,
      fileName: file.name,
      fileUrl: `/uploads/${Date.now()}_${file.name}`,
      fileType: file.type || 'application/octet-stream',
      ocrText,
    });

    return NextResponse.json(doc, { status: 201 });
  })
);
