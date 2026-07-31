import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ParsedStatementTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'DEBIT' | 'CREDIT';
  suggestedCategory: string;
}

export interface ParsedStatementResult {
  accountNumberLast4: string;
  statementPeriod: { start: string; end: string };
  openingBalance: number;
  closingBalance: number;
  transactions: ParsedStatementTransaction[];
}

export async function parseStatementPDF(pdfBase64: string): Promise<ParsedStatementResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from environment variables.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

  const prompt = `
    Extract all transaction rows and statement header metadata from this bank or credit card statement PDF.
    Return ONLY a raw JSON object adhering strictly to this schema:
    {
      "accountNumberLast4": "string",
      "statementPeriod": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
      "openingBalance": number,
      "closingBalance": number,
      "transactions": [
        { "date": "YYYY-MM-DD", "description": "string", "amount": number, "type": "DEBIT"|"CREDIT", "suggestedCategory": "string" }
      ]
    }
  `;

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } },
  ]);

  const responseText = result.response.text().replace(/```json|```/g, '').trim();
  return JSON.parse(responseText) as ParsedStatementResult;
}
