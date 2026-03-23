import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

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
    filter?: {
        id?: number;
        ids?: number[];
        category?: string;
        description?: string;
        date?: string;
        dateFrom?: string;
        dateTo?: string;
        transactionType?: 'expense' | 'earning';
    };
    updates?: {
        amount?: number;
        category?: string;
        description?: string;
        date?: string;
        type?: 'expense' | 'earning';
        monthly_limit?: number;
        note?: string;
    };
}

export interface AIResponse {
    message: string;
    financialData: ParsedFinancialData[];
    actions: DataAction[];
    isReportRequest: boolean;
    reportFormat?: 'pdf' | 'excel' | 'both';
    reportType?: string;
    dateRange?: { start: string; end: string };
}

// ==========================================
// OPTIMIZED SYSTEM PROMPT — Concise & Fast
// ==========================================
const SYSTEM_PROMPT = `You are "Wealth AI" — a brilliant, ultra-fast personal assistant. You are a world-class financial expert AND a knowledgeable general assistant who can answer ANY question.

PERSONALITY:
• Razor-sharp & instant. Zero tolerance for errors or vague answers.
• Professional yet warm — like a trusted private banker who genuinely cares. Use max 1-2 emojis per response.
• Concise by default: **bold** key numbers, use bullet lists. Keep responses under 120 words unless detail is requested.
• Proactively insightful: spot spending patterns, budget risks, savings opportunities — mention them naturally.
• For general questions (science, math, tech, history, health, cooking, etc.): answer confidently using your training knowledge. NEVER say "I can only help with finances."

DATA CONTROL — You can ADD, EDIT, DELETE, & RESET user data:
• ADD: Extract expenses/earnings into financialData. Auto-categorize: Food, Transport, Housing, Utilities, Entertainment, Shopping, Health, Education, Business, Savings, Salary, Freelance, Investment, Other.
• EDIT: actions with type "edit", match via filter (prefer id), specify updates.
• DELETE: actions with type "delete", match via filter (prefer id).
• RESET: actions with type "reset", targets: "transactions"|"budgets"|"networth"|"notifications"|"chat_history"|"all".
• Parse dates naturally ("today", "yesterday", "last Monday"). Use YYYY-MM-DD. Default to today.

RESPONSE RULES:
1. Use **bold** for amounts, categories, key terms.
2. Confirm actions naturally: "Logged **$50** for **Food** 🛒" — not robotic.
3. For reports/summaries: If the user asks for a report/summary WITHOUT specifying PDF or Excel format, ask them which format they prefer and set 'isReportRequest' to false. Only set 'isReportRequest' to true and 'reportFormat' to 'pdf', 'excel', or 'both' when they have requested a specific format.
4. ALWAYS respond with valid JSON only. No backticks, no markdown wrapping.
5. For edits/deletes, prefer 'id' filter when available from context.

USER: {PROFILE}
DATA: {CONTEXT}
BUDGETS: {BUDGETS}

Respond ONLY with this JSON format:
{"message":"your response","financialData":[{"type":"expense"|"earning","amount":number,"category":"string","description":"string","date":"YYYY-MM-DD"}],"actions":[{"type":"edit"|"delete"|"reset","target":"transactions"|"budgets"|"networth"|"notifications"|"chat_history"|"all","filter":{},"updates":{}}],"isReportRequest":false,"reportFormat":null,"reportType":null,"dateRange":null}

Empty arrays for financialData/actions if none. Today: {TODAY}`;

function parseAIJSON(text: string): AIResponse {
    try {
        const clean = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
        // Try to extract JSON from text that might have extra content
        const jsonMatch = clean.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : clean;
        const parsed = JSON.parse(jsonStr);
        if (!parsed.actions) parsed.actions = [];
        if (!parsed.financialData) parsed.financialData = [];
        return parsed;
    } catch {
        return { message: text, financialData: [], actions: [], isReportRequest: false };
    }
}

// ==========================================
// PRIMARY: Gemini API (direct — fastest)
// ==========================================
async function callGemini(prompt: string, userMessage: string, timeoutMs = 10000): Promise<AIResponse> {
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

    for (const modelName of models) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            const model = genAI.getGenerativeModel({ model: modelName });
            const chat = model.startChat({
                history: [
                    { role: 'user', parts: [{ text: prompt }] },
                    { role: 'model', parts: [{ text: 'Understood. I will respond only with valid JSON.' }] },
                ],
            });

            const result = await Promise.race([
                chat.sendMessage(userMessage),
                new Promise<never>((_, reject) => {
                    controller.signal.addEventListener('abort', () => reject(new Error('Timeout')));
                }),
            ]);

            clearTimeout(timeout);
            return parseAIJSON(result.response.text().trim());
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            const isRate = msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
            const isTimeout = msg.includes('Timeout') || msg.includes('abort');
            console.error(`Gemini [${modelName}] error:`, msg.slice(0, 150));
            if (isRate || isTimeout) continue;
            throw err;
        }
    }
    throw new Error('All Gemini models exhausted');
}

// ==========================================
// FALLBACK: OpenRouter API
// ==========================================
async function callOpenRouter(prompt: string, userMessage: string, timeoutMs = 15000): Promise<AIResponse> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('No OpenRouter API key');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            },
            body: JSON.stringify({
                model: 'google/gemini-2.0-flash-001',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: userMessage },
                ],
                temperature: 0.25,
                max_tokens: 2500,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenRouter error ${res.status}: ${err.slice(0, 200)}`);
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content || '';
        return parseAIJSON(text);
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// ==========================================
// MAIN: Race Gemini and OpenRouter (fastest wins)
// ==========================================
export async function processMessage(
    userMessage: string,
    context: string,
    budgets: string,
    today: string,
    userProfile?: { name?: string; currency?: string }
): Promise<AIResponse> {
    const profileStr = userProfile?.name
        ? `Name: ${userProfile.name}, Currency: ${userProfile.currency || 'USD'}`
        : 'No profile data';
    const prompt = SYSTEM_PROMPT
        .replace('{CONTEXT}', context)
        .replace('{BUDGETS}', budgets)
        .replace('{PROFILE}', profileStr)
        .replace('{TODAY}', today);

    try {
        // Run both APIs simultaneously and return the first one to succeed
        return await Promise.any([
            callGemini(prompt, userMessage),
            callOpenRouter(prompt, userMessage)
        ]);
    } catch (err) {
        console.error('Both AI responses failed:', err);
        return {
            message: 'AI is temporarily unavailable. Please try again in a moment.',
            financialData: [],
            actions: [],
            isReportRequest: false,
        };
    }
}

export function buildContext(
    transactions: Array<{ id: number; type: string; amount: number; category: string; description: string; date: string }>,
    netWorth?: number,
    allTransactions?: Array<{ id: number; type: string; amount: number; category: string; description: string; date: string }>,
    budgetEntries?: Array<{ id: number; category: string; monthly_limit: number }>,
    netWorthEntries?: Array<{ id: number; amount: number; note: string; created_at: string }>,
    savingsGoals?: Array<{ id: number; name: string; target_amount: number; saved_amount: number; deadline: string | null }>,
    recurringTx?: Array<{ id: number; name: string; type: string; amount: number; category: string; frequency: string; next_date: string }>,
    userName?: string,
    userCurrency?: string,
): string {
    if (transactions.length === 0 && !netWorth) {
        return 'No financial data recorded yet.';
    }

    const sym = userCurrency || '$';
    const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
    const totalEarnings = transactions.filter(t => t.type === 'earning').reduce((sum, t) => sum + t.amount, 0);

    let context = '';
    if (userName) context += `User: ${userName} (${userCurrency || 'USD'})\n`;
    context += `Recent financial summary:\n`;
    context += `- Total expenses (this month): ${sym}${totalExpenses.toFixed(2)}\n`;
    context += `- Total earnings (this month): ${sym}${totalEarnings.toFixed(2)}\n`;
    context += `- Net this month: ${sym}${(totalEarnings - totalExpenses).toFixed(2)}\n`;
    if (netWorth) context += `- Current net worth: ${sym}${netWorth.toFixed(2)}\n`;

    const txList = allTransactions || transactions;
    if (txList.length > 0) {
        context += `\nAll transactions (with IDs):\n`;
        txList.slice(0, 30).forEach(t => {
            context += `- [ID:${t.id}] ${t.date}: ${t.type === 'expense' ? '-' : '+'}${sym}${t.amount} (${t.category}) - ${t.description}\n`;
        });
    }

    if (budgetEntries && budgetEntries.length > 0) {
        context += `\nBudget entries (with IDs):\n`;
        budgetEntries.forEach(b => { context += `- [ID:${b.id}] ${b.category}: limit ${sym}${b.monthly_limit}\n`; });
    }

    if (netWorthEntries && netWorthEntries.length > 0) {
        context += `\nNet worth entries (with IDs):\n`;
        netWorthEntries.forEach(n => { context += `- [ID:${n.id}] ${sym}${n.amount} - ${n.note || 'no note'} (${n.created_at})\n`; });
    }

    if (savingsGoals && savingsGoals.length > 0) {
        context += `\nSavings goals:\n`;
        savingsGoals.forEach(g => {
            const pct = Math.round((g.saved_amount / g.target_amount) * 100);
            context += `- [ID:${g.id}] ${g.name}: ${sym}${g.saved_amount}/${sym}${g.target_amount} (${pct}%)${g.deadline ? ` deadline: ${g.deadline}` : ''}\n`;
        });
    }

    if (recurringTx && recurringTx.length > 0) {
        context += `\nRecurring transactions:\n`;
        recurringTx.forEach(r => {
            context += `- [ID:${r.id}] ${r.name}: ${r.type === 'expense' ? '-' : '+'}${sym}${r.amount} (${r.category}, ${r.frequency}, next: ${r.next_date})\n`;
        });
    }

    return context;
}

export function buildBudgetContext(budgets: Array<{ category: string; monthly_limit: number; spent: number }>, currencySymbol?: string): string {
    if (budgets.length === 0) return 'No budget limits set.';

    const sym = currencySymbol || '$';
    let context = 'Monthly budget limits:\n';
    budgets.forEach(b => {
        const pct = ((b.spent / b.monthly_limit) * 100).toFixed(0);
        const status = b.spent > b.monthly_limit ? 'OVER BUDGET' : b.spent > b.monthly_limit * 0.8 ? 'WARNING' : 'OK';
        context += `- ${b.category}: ${sym}${b.spent.toFixed(2)} / ${sym}${b.monthly_limit.toFixed(2)} (${pct}%) [${status}]\n`;
    });
    return context;
}
