/**
 * @fileoverview Two-tier deterministic financial NLP parser.
 *
 * Runs synchronously in <5ms both in the browser (live typing preview pills)
 * and on the server. Extracts structured financial tokens (type, amount,
 * merchant, category, accountHint, date) with confidence scoring.
 *
 * @module lib/deterministic-nlp
 */

export interface DeterministicParsedTokens {
  type: 'expense' | 'earning';
  amount: number | null;
  merchant: string | null;
  category: string | null;
  accountHint: string | null;
  date: string;
  isDeterministic: boolean;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: [
    'coffee', 'cafe', 'north end', 'starbucks', 'tea', 'lunch', 'dinner',
    'breakfast', 'burger', 'pizza', 'restaurant', 'food', 'snack', 'dining',
    'takeout', 'kfc', 'mcdonald'
  ],
  Groceries: [
    'grocery', 'groceries', 'supermarket', 'agora', 'swapno', 'shwapno',
    'meenabazar', 'unimart', 'walmart', 'produce', 'vegetables', 'meat', 'milk'
  ],
  Transport: [
    'uber', 'pathao', 'ride', 'taxi', 'metro', 'bus', 'train', 'fuel',
    'gas', 'petrol', 'cng', 'transport', 'flight', 'fare', 'toll'
  ],
  Housing: [
    'rent', 'apartment', 'flat', 'house', 'maintenance', 'mortgage'
  ],
  Utilities: [
    'electricity', 'water', 'internet', 'wifi', 'bill', 'desco', 'wasa',
    'mobile recharge', 'broadband', 'phone bill', 'gas bill'
  ],
  Entertainment: [
    'movie', 'cinema', 'netflix', 'spotify', 'concert', 'game', 'gaming',
    'steam', 'playstation', 'party'
  ],
  Shopping: [
    'shopping', 'clothes', 'shoes', 'amazon', 'zara', 'h&m', 'electronics',
    'gadget', 'daraz', 'book'
  ],
  Health: [
    'doctor', 'medicine', 'pharmacy', 'hospital', 'clinic', 'dental',
    'prescription', 'gym', 'fitness', 'vitamins'
  ],
  Education: [
    'tuition', 'school', 'college', 'university', 'course', 'udemy',
    'coursera', 'books', 'training'
  ],
  Salary: [
    'salary', 'payroll', 'paycheck', 'monthly pay'
  ],
  Freelance: [
    'freelance', 'client payout', 'consulting', 'upwork', 'fiverr',
    'payout', 'contract work'
  ],
  Investment: [
    'dividend', 'stock', 'crypto', 'interest', 'shares', 'mutual fund'
  ],
};

const ACCOUNT_KEYWORDS = [
  'city bank', 'brac bank', 'ebl', 'scb', 'standard chartered', 'dhaka bank',
  'dutch bangla', 'dbbl', 'islami bank', 'hsbc', 'wise', 'bkash', 'nagad',
  'rocket', 'upay', 'cash', 'credit card', 'debit card', 'bank account', 'paypal'
];

/**
 * Extracts structured financial tokens deterministically from natural language input.
 *
 * @param text - The natural language input string.
 * @param referenceDate - Optional reference date (defaults to current local date).
 * @returns Parsed tokens with confidence rating.
 */
export function parseFinancialText(
  text: string,
  referenceDate?: Date
): DeterministicParsedTokens {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  const ref = referenceDate || new Date();
  const todayStr = ref.toISOString().split('T')[0];
  const yesterday = new Date(ref.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let detectedDate = todayStr;
  if (lower.includes('yesterday')) {
    detectedDate = yesterdayStr;
  } else {
    const isoMatch = lower.match(/\b\d{4}-\d{2}-\d{2}\b/);
    if (isoMatch) {
      detectedDate = isoMatch[0];
    }
  }

  // 1. Detect Type
  let type: 'expense' | 'earning' = 'expense';
  const earningTerms = ['salary', 'payout', 'freelance payout', 'received', 'earned', 'income', 'dividend', 'bonus', 'refund'];
  const hasPlusSign = raw.startsWith('+') || /\s\+\d/.test(raw);
  const hasMinusSign = raw.startsWith('-') || /\s-\d/.test(raw);

  if (hasPlusSign || earningTerms.some((t) => lower.includes(t))) {
    type = 'earning';
  } else if (hasMinusSign) {
    type = 'expense';
  }

  // 2. Detect Amount
  let amount: number | null = null;
  // Match numbers optionally preceded/followed by currency symbols or signs
  const amountRegex = /(?:[+\-−$৳€£]|bdt|tk|usd)?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:bdt|tk|usd|taka)?/i;
  
  // Find all candidate numbers
  const numberTokens = raw.match(/\b\d+(?:,\d{3})*(?:\.\d{1,2})?\b/g);
  if (numberTokens && numberTokens.length > 0) {
    // Pick the most plausible financial amount (often the last or after 'for'/'at'/'+')
    const candidates = numberTokens
      .map((tok) => parseFloat(tok.replace(/,/g, '')))
      .filter((n) => Number.isFinite(n) && n > 0 && n !== 2024 && n !== 2025 && n !== 2026);

    if (candidates.length > 0) {
      // If there's an explicit + or - amount, pick that
      const signMatch = raw.match(/[+\-−]\s*([0-9]+(?:\.[0-9]{1,2})?)/);
      if (signMatch) {
        amount = parseFloat(signMatch[1]);
      } else {
        amount = candidates[candidates.length - 1]; // usually at the end or price position
      }
    }
  }

  // 3. Detect Category
  let category: string | null = null;
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      category = cat;
      break;
    }
  }

  // 4. Detect Account Hint
  let accountHint: string | null = null;
  for (const acc of ACCOUNT_KEYWORDS) {
    if (lower.includes(acc)) {
      accountHint = acc.replace(/\b\w/g, (c) => c.toUpperCase());
      break;
    }
  }
  if (!accountHint) {
    // Try regex: "from X", "to Y", "via Z"
    const accMatch = lower.match(/(?:from|to|via|with|using|into)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:yesterday|today|on|at|for)|\s*$)/);
    if (accMatch && accMatch[1] && accMatch[1].trim().length < 30) {
      const candidate = accMatch[1].trim();
      if (!['the', 'my', 'a', 'an'].includes(candidate)) {
        accountHint = candidate.replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
  }

  // 5. Detect Merchant / Description
  let merchant: string | null = null;
  // Match "at [Merchant]" or "at the [Merchant]"
  const atMatch = raw.match(/\bat\s+([A-Za-z0-9\s&'-]+?)(?:\s+\d|\s+for|\s+from|\s+with|\s+yesterday|\s+today|$)/i);
  if (atMatch && atMatch[1] && atMatch[1].trim().length > 1) {
    merchant = atMatch[1].trim().replace(/^the\s+/i, '');
  } else {
    // Look for leading description before amount or preposition
    const cleanedDesc = raw
      .replace(/^[+\-−]\s*/, '')
      .replace(/\b(?:spent|paid|bought|received|earned)\b/i, '')
      .replace(/\b(?:from|to|via|with)\s+[A-Za-z0-9\s&'-]+/i, '')
      .replace(/\b(?:yesterday|today)\b/i, '')
      .replace(/\b\d+(?:,\d{3})*(?:\.\d{1,2})?\s*(?:bdt|tk|usd|taka)?\b/i, '')
      .trim();

    if (cleanedDesc.length > 2) {
      merchant = cleanedDesc;
    }
  }

  // Fallback defaults
  if (!merchant && category) {
    merchant = category;
  } else if (!merchant) {
    merchant = raw.slice(0, 40);
  }

  if (!category) {
    category = type === 'earning' ? 'Income' : 'Other';
  }

  // Compute confidence
  let confidence: 'high' | 'medium' | 'low' = 'low';
  const hasAmount = amount !== null && amount > 0;
  const hasMeaningfulMerchant = merchant !== null && merchant.length > 2;

  if (hasAmount && category !== 'Other' && (accountHint || hasMeaningfulMerchant)) {
    confidence = 'high';
  } else if (hasAmount) {
    confidence = 'medium';
  }

  return {
    type,
    amount,
    merchant,
    category,
    accountHint,
    date: detectedDate,
    isDeterministic: confidence !== 'low',
    confidence,
    rawText: raw,
  };
}
