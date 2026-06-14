export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/security/session-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';

const MAX_FILE_SIZE = 8 * 1024 * 1024;

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
            return NextResponse.json({ error: 'File too large (max 8MB)' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString('base64');
        const mimeType = file.type;

        if (!mimeType.startsWith('image/') && mimeType !== 'application/pdf') {
            return NextResponse.json({ error: 'Unsupported file format for scanning' }, { status: 400 });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `You are a financial receipt scanner. Extract the key transaction details from the attached document/image.
Return ONLY valid JSON with no markdown formatting.
Format:
{
    "amount": number (the final total),
    "date": "YYYY-MM-DD" (the date of the transaction, or current date if none found),
    "description": "string" (short summary, e.g. "Grocery at Walmart", max 50 chars),
    "category": "string" (one of: Food, Transport, Housing, Utilities, Entertainment, Shopping, Health, Education, Business, Savings, Other),
    "type": "expense" | "earning" (usually expense)
}`;

        const parts = [
            { text: prompt },
            {
                inlineData: {
                    data: base64Data,
                    mimeType,
                }
            }
        ];

        const result = await model.generateContent(parts);
        const text = result.response.text().trim();
        const clean = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return NextResponse.json(parsed);
        } else {
            throw new Error('Could not parse JSON from AI response');
        }

    } catch (error) {
        console.error('Scan error:', error);
        return NextResponse.json({ error: 'Failed to scan document' }, { status: 500 });
    }
}
