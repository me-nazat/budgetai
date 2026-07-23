export const dynamic = 'force-dynamic';

/**
 * @fileoverview Bank Statement Parser API using Gemini Vision.
 *
 * POST /api/bank-import/parse
 * Extracts transaction rows from uploaded bank statement screenshots/PDFs.
 *
 * @module api/bank-import/parse
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler } from '@/lib/middleware/api-handler';
import { withAuth } from '@/lib/middleware/with-auth';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const POST = apiHandler(
  withAuth<{ params: Promise<Record<string, string>> }>(async (request) => {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64Data = buffer.toString('base64');
    const mimeType = file.type || 'image/jpeg';

    try {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are a financial statement parser. Extract all transaction items from the attached bank/credit card statement document.
Return ONLY valid JSON array with no markdown formatting.
Format:
[
  {
    "date": "YYYY-MM-DD",
    "description": "string (short description/merchant)",
    "amount": number,
    "category": "string (one of: Food, Transport, Housing, Utilities, Entertainment, Shopping, Health, Education, Business, Savings, Other)",
    "type": "expense" | "earning"
  }
]`;

      const parts = [
        { text: prompt },
        {
          inlineData: {
            data: base64Data,
            mimeType,
          },
        },
      ];

      const result = await model.generateContent(parts);
      const rawText = result.response.text().trim();
      const clean = rawText.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = clean.match(/\[[\s\S]*\]/);

      let parsed: any[] = [];
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }

      const transactions = parsed.map((item, idx) => ({
        tempId: idx + 1,
        date: item.date || new Date().toISOString().split('T')[0],
        description: item.description || 'Statement Transaction',
        amount: Math.abs(Number(item.amount) || 0),
        category: item.category || 'Other',
        type: item.type === 'earning' ? ('earning' as const) : ('expense' as const),
      }));

      return NextResponse.json({
        fileName: file.name,
        transactions: transactions.length > 0 ? transactions : [
          {
            tempId: 1,
            date: new Date().toISOString().split('T')[0],
            description: file.name.replace(/\.[^/.]+$/, ''),
            amount: 0,
            category: 'Other',
            type: 'expense' as const,
          },
        ],
      });
    } catch {
      return NextResponse.json({
        fileName: file.name,
        transactions: [
          {
            tempId: 1,
            date: new Date().toISOString().split('T')[0],
            description: file.name.replace(/\.[^/.]+$/, ''),
            amount: 0,
            category: 'Other',
            type: 'expense' as const,
          },
        ],
      });
    }
  }),
  { rateLimit: 'api' }
);
