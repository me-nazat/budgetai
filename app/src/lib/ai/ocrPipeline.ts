import { GoogleGenerativeAI } from '@google/generative-ai';

export interface ExtractedLineItem {
  description: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice: number;
  amount?: number;
  category?: string;
}

export interface ExtractedDocumentData {
  merchantName: string;
  documentDate: string;
  totalAmount: number;
  taxAmount: number;
  currency?: string;
  suggestedCategory?: string;
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

  const genAI = new GoogleGenerativeAI(apiKey);
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];

  const prompt = `
    Analyze this financial document/receipt image or PDF. Extract the following JSON structure:
    {
      "merchantName": "string",
      "documentDate": "YYYY-MM-DD",
      "totalAmount": number,
      "taxAmount": number,
      "currency": "string (e.g. BDT, USD, EUR)",
      "suggestedCategory": "string (one of Food, Groceries, Transport, Utilities, Housing, Entertainment, Shopping, Health, Education, Other)",
      "lineItems": [
        {
          "description": "string",
          "quantity": number,
          "unitPrice": number,
          "totalPrice": number,
          "category": "string (suggested category for this line item)"
        }
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

  for (const modelName of models) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([prompt, imagePart]);
      const raw = result.response.text().trim();
      const clean = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      const match = clean.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        // Normalize lineItems
        const normalizedItems: ExtractedLineItem[] = Array.isArray(parsed.lineItems)
          ? parsed.lineItems.map((item: any) => ({
              description: String(item.description || 'Item'),
              quantity: Number(item.quantity) || 1,
              unitPrice: Number(item.unitPrice) || Number(item.totalPrice) || 0,
              totalPrice: Number(item.totalPrice) || Number(item.amount) || 0,
              amount: Number(item.totalPrice) || Number(item.amount) || 0,
              category: String(item.category || parsed.suggestedCategory || 'Other'),
            }))
          : [];

        return {
          merchantName: String(parsed.merchantName || 'Receipt'),
          documentDate: String(parsed.documentDate || new Date().toISOString().split('T')[0]),
          totalAmount: Number(parsed.totalAmount) || 0,
          taxAmount: Number(parsed.taxAmount) || 0,
          currency: String(parsed.currency || 'BDT'),
          suggestedCategory: String(parsed.suggestedCategory || 'Other'),
          lineItems: normalizedItems,
          rawSummary: String(parsed.rawSummary || ''),
        };
      }
    } catch (err) {
      console.error(`OCR model [${modelName}] error:`, err);
    }
  }

  throw new Error('Could not parse receipt contents with AI OCR');
}
