/**
 * @fileoverview Privacy utilities for data masking, account sanitization,
 * and export redaction (Module 14 — Global Privacy Mode).
 *
 * Provides regex-based financial identifier masking and recursive payload
 * sanitization for client and server-side privacy enforcement.
 *
 * @module lib/security/privacy
 */

/**
 * Standard account / card number regex matching 13 to 19 contiguous or formatted digits.
 * Supports groups of 4 separated by spaces or hyphens.
 */
export const ACCOUNT_OR_CARD_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

/**
 * Masks a single account or card number string, retaining only the trailing 4 digits.
 *
 * @param value - Raw account or card string (e.g. "4532-1234-5678-9012" or "123456789012")
 * @returns Masked account representation (e.g. "•••• •••• •••• 9012")
 *
 * @example
 * ```ts
 * maskAccountNumber('4532-1234-5678-9012'); // '•••• •••• •••• 9012'
 * maskAccountNumber('9876543210');          // '•••• 3210'
 * ```
 */
export function maskAccountNumber(value: string): string {
  if (!value || typeof value !== 'string') return value;

  // Extract pure digits
  const digits = value.replace(/\D/g, '');
  if (digits.length < 8) {
    // If fewer than 8 digits, mask first half if at least 4 digits
    if (digits.length >= 4) {
      const last4 = digits.slice(-4);
      return `•••• ${last4}`;
    }
    return value;
  }

  const last4 = digits.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

/**
 * Scans an arbitrary text string for card / account numbers and replaces them with masked tokens.
 */
export function maskEmbeddedAccountNumbers(text: string): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(ACCOUNT_OR_CARD_REGEX, (match) => maskAccountNumber(match));
}

/** Keys in JSON payloads that identify account/card identifiers requiring masking. */
const ACCOUNT_IDENTIFIER_KEYS = new Set([
  'accountnumber',
  'account_number',
  'cardnumber',
  'card_number',
  'iban',
  'accountno',
  'account_no',
  'routingnumber',
  'routing_number',
]);

/** Keys representing sensitive financial amounts redacted to 0 in Privacy Mode. */
const SENSITIVE_AMOUNT_KEYS = new Set([
  'amount',
  'balance',
  'currentbalance',
  'current_balance',
  'totalnetworth',
  'total_net_worth',
  'networth',
  'net_worth',
  'savedamount',
  'saved_amount',
  'targetamount',
  'target_amount',
  'spent',
  'limit',
]);

/**
 * Recursively sanitizes export data (PDF, CSV, Excel, Snapshot) by masking
 * account identifiers and optionally masking sensitive amounts.
 *
 * @param data - Any array or object data payload
 * @param options - Masking configurations
 * @returns Clean, privacy-compliant cloned data structure
 */
export function sanitizeExportData<T>(
  data: T,
  options: { maskAccountNumbers?: boolean; maskAmounts?: boolean } = { maskAccountNumbers: true }
): T {
  if (!data || typeof data !== 'object') {
    if (typeof data === 'string' && options.maskAccountNumbers) {
      return maskEmbeddedAccountNumbers(data) as unknown as T;
    }
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeExportData(item, options)) as unknown as T;
  }

  const sanitized: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    const lowerKey = key.toLowerCase();

    if (options.maskAccountNumbers && ACCOUNT_IDENTIFIER_KEYS.has(lowerKey) && typeof val === 'string') {
      sanitized[key] = maskAccountNumber(val);
    } else if (options.maskAmounts && SENSITIVE_AMOUNT_KEYS.has(lowerKey) && typeof val === 'number') {
      sanitized[key] = 0;
    } else if (typeof val === 'string' && options.maskAccountNumbers) {
      sanitized[key] = maskEmbeddedAccountNumbers(val);
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeExportData(val, options);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized as T;
}
