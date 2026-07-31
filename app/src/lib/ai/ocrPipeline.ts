import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ExtractedLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
}

export interface ExtractedDocumentData {
  merchantName: string;
  documentDate: string;
  totalAmount: number;
  taxAmount: number;
  lineItems: ExtractedLineItem[];
  rawSummary: string;
}

export async function processDocumentOCR(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractedDocumentData> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from environment variables.');
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `
    Analyze this financial document/receipt. Extract the following JSON structure:
    {
      "merchantName": "string",
      "documentDate": "YYYY-MM-DD",
      "totalAmount": number,
      "taxAmount": number,
      "lineItems": [
        { "description": "string", "quantity": number, "unitPrice": number, "totalPrice": number }
      ],
      "rawSummary": "Brief natural language summary of contents"
    }
    Return ONLY valid raw JSON without markdown codeblock formatting or extra commentary.
  `;

  const imagePart = {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  };

  const result = await model.generateContent([prompt, imagePart]);
  const responseText = result.response.text().replace(/```json|```/g, '').trim();

  return JSON.parse(responseText) as ExtractedDocumentData;
}
