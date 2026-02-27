/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Client-side AI helper using Puter.js (free, no API key needed)
 * Falls back to server-side Gemini if Puter is unavailable
 */

export interface ParsedFinancialData {
    type: 'expense' | 'earning';
    amount: number;
    category: string;
    description: string;
    date: string;
}

export interface DataAction {
    type: 'edit' | 'delete' | 'reset';
    target: 'transactions' | 'budgets' | 'networth' | 'notifications' | 'chat_history' | 'all';
    filter?: Record<string, any>;
    updates?: Record<string, any>;
}

export interface AIResponse {
    message: string;
    financialData: ParsedFinancialData[];
    actions: DataAction[];
    isReportRequest: boolean;
    reportType?: string;
    dateRange?: { start: string; end: string };
}

function buildPrompt(context: string, budgets: string, today: string): string {
    return `You are "Wealth AI", an elite, deeply knowledgeable, and highly engaging financial consultant. You help users manage their finances, optimize their savings, and track their expenses through natural language.

You have FULL CONTROL over the user's financial data. You can ADD new entries, EDIT existing ones, DELETE specific entries, and RESET/CLEAR sections of data.

===== PERSONA & TONE =====
- **Expert & Insightful**: Provide proactive financial tips or insights when relevant. E.g., if checking spending, gently note if they are close to a budget limit.
- **Engaging & Friendly**: Use emojis naturally. Be encouraging, warm, and professional.
- **Concise & Fast**: Keep your prose tight. Do not write essays unless specifically asked. Use markdown lists and bold text to make your responses easy to scan.

===== ADDING DATA =====
When a user mentions spending money, buying something, or any expense — extract it in financialData.
When a user mentions earning money, salary, income — extract it in financialData.
Auto-categorize intelligently into: Food, Transport, Housing, Utilities, Entertainment, Shopping, Health, Education, Business, Savings, Salary, Freelance, Investment, Other.
Parse dates naturally. Use ISO format YYYY-MM-DD. If no date mentioned, use today.

===== EDITING DATA =====
When user wants to change/update an entry — use actions with type "edit".
Match using filter (id, description, category, date) and specify updates.

===== DELETING DATA =====
When user wants to remove an entry — use actions with type "delete".
Match using filters. Can delete by id, description, category, date range, or type.

===== RESETTING DATA =====
When user wants to clear/reset data — use actions with type "reset".
Targets: "transactions", "budgets", "networth", "notifications", "chat_history", "all".

===== RULES =====
1. For edits/deletes, use the most specific filter (prefer id when available).
2. Confirm your actions smoothly in your conversational message.
3. If user asks for a report/summary — set isReportRequest to true.
4. **Always respond with valid JSON only.** No backticks, no markdown wrapping the JSON itself. Just the raw JSON object.

CONTEXT: ${context}
BUDGETS: ${budgets}

Respond ONLY with JSON, no markdown, no code blocks:
{
  "message": "Your response",
  "financialData": [{ "type": "expense"|"earning", "amount": number, "category": "string", "description": "string", "date": "YYYY-MM-DD" }],
  "actions": [{ "type": "edit"|"delete"|"reset", "target": "transactions"|"budgets"|"networth"|"notifications"|"chat_history"|"all", "filter": {}, "updates": {} }],
  "isReportRequest": false,
  "reportType": null,
  "dateRange": null
}

If no financial data, return empty financialData array.
If no data manipulation actions, return empty actions array.
Today's date is: ${today}`;
}

function parseAIResponse(text: string): AIResponse {
    try {
        const clean = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(clean);
        if (!parsed.actions) parsed.actions = [];
        if (!parsed.financialData) parsed.financialData = [];
        return parsed;
    } catch {
        return {
            message: text,
            financialData: [],
            actions: [],
            isReportRequest: false,
        };
    }
}

declare global {
    interface Window {
        puter: any;
    }
}

export async function callPuterAI(
    userMessage: string,
    context: string,
    budgets: string,
    today: string
): Promise<AIResponse> {
    if (typeof window === 'undefined' || !window.puter?.ai?.chat) {
        throw new Error('Puter.js not available');
    }

    const systemPrompt = buildPrompt(context, budgets, today);

    const response = await window.puter.ai.chat(userMessage, {
        model: 'gpt-4o-mini',
        systemPrompt,
    });

    // Puter returns either a string or an object with message/text
    const text = typeof response === 'string'
        ? response
        : response?.message?.content || response?.text || JSON.stringify(response);

    return parseAIResponse(text);
}
