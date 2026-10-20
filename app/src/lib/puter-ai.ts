/**
 * @fileoverview Server-delegating AI stub (Batch 8 Part 4).
 * Replaces external Puter.js third-party client bloat.
 * All completions, OCR, and categorization route cleanly to server-side AI endpoints.
 *
 * @module lib/puter-ai
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

/**
 * Server-delegating AI completion helper.
 * Calls secure server-side /api/chat instead of downloading external client scripts.
 */
export async function callPuterAI(
  userMessage: string,
  contextData: any = {},
  locale: string = 'en'
): Promise<AIResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: userMessage,
      context: contextData,
      locale,
    }),
  });

  if (!res.ok) {
    throw new Error('Server AI completion failed');
  }

  const data = await res.json();
  return {
    message: data.reply || data.message || '',
    financialData: data.financialData || [],
    actions: data.actions || [],
    isReportRequest: Boolean(data.isReportRequest),
    reportType: data.reportType,
    dateRange: data.dateRange,
  };
}
