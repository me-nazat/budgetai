/**
 * Centralized input validation and sanitization utilities.
 * All API routes MUST use these before processing user input.
 */

import { z } from "zod";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const VALID_TYPES = ['expense', 'earning'] as const;
const VALID_FREQUENCIES = ['weekly', 'monthly', 'yearly'] as const;
const MAX_AMOUNT = 999_999_999;
const MAX_TEXT_LENGTH = 500;
const MAX_NAME_LENGTH = 100;
const MAX_CATEGORY_LENGTH = 50;
const MAX_PASSWORD_LENGTH = 128;
const MAX_PAGINATION_LIMIT = 500;

// Allowed currency codes for the exchange rate API (prevents SSRF)
const ALLOWED_CURRENCIES = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'HKD', 'NZD',
    'SEK', 'KRW', 'SGD', 'NOK', 'MXN', 'INR', 'RUB', 'ZAR', 'TRY', 'BRL',
    'TWD', 'DKK', 'PLN', 'THB', 'IDR', 'HUF', 'CZK', 'ILS', 'CLP', 'PHP',
    'AED', 'COP', 'SAR', 'MYR', 'RON', 'BGN', 'ARS', 'NGN', 'EGP', 'PKR',
    'BDT', 'VND', 'UAH', 'KZT', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'LKR',
    'MMK', 'NPR', 'GHS', 'KES', 'UGX', 'TZS', 'MAD', 'XOF', 'XAF',
]);

export function isValidEmail(email: string): boolean {
    return typeof email === 'string' && email.length <= MAX_NAME_LENGTH && EMAIL_REGEX.test(email);
}

export function isValidPassword(password: string): boolean {
    return typeof password === 'string' && password.length >= 6 && password.length <= MAX_PASSWORD_LENGTH;
}

export function isValidAmount(amount: unknown): amount is number {
    const n = typeof amount === 'string' ? parseFloat(amount) : amount;
    return typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_AMOUNT;
}

export function isValidType(type: unknown): type is 'expense' | 'earning' {
    return typeof type === 'string' && VALID_TYPES.includes(type as 'expense' | 'earning');
}

export function isValidFrequency(freq: unknown): freq is 'weekly' | 'monthly' | 'yearly' {
    return typeof freq === 'string' && VALID_FREQUENCIES.includes(freq as 'weekly' | 'monthly' | 'yearly');
}

export function isValidDate(date: unknown): date is string {
    if (typeof date !== 'string') return false;
    if (!DATE_REGEX.test(date)) return false;
    // Verify it's a real date
    const d = new Date(date + 'T00:00:00Z');
    return !isNaN(d.getTime());
}

export function isValidCurrency(code: unknown): boolean {
    return typeof code === 'string' && ALLOWED_CURRENCIES.has(code.toUpperCase());
}

export function sanitizeText(text: unknown, maxLength: number = MAX_TEXT_LENGTH): string {
    if (typeof text !== 'string') return '';
    return text.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function sanitizeName(name: unknown): string {
    return sanitizeText(name, MAX_NAME_LENGTH);
}

export function sanitizeCategory(cat: unknown): string {
    return sanitizeText(cat, MAX_CATEGORY_LENGTH) || 'Other';
}

export function sanitizeDescription(desc: unknown): string {
    return sanitizeText(desc, MAX_TEXT_LENGTH);
}

export function sanitizeNotes(notes: unknown): string {
    if (typeof notes !== 'string') return '';
    // Preserve newlines, but cap length
    return notes.trim().slice(0, 1000);
}

export function clampPaginationLimit(limit: unknown): number {
    const n = typeof limit === 'string' ? parseInt(limit, 10) : (typeof limit === 'number' ? limit : 100);
    if (!Number.isFinite(n) || n < 1) return 100;
    return Math.min(n, MAX_PAGINATION_LIMIT);
}

export function clampPaginationOffset(offset: unknown): number {
    const n = typeof offset === 'string' ? parseInt(offset, 10) : (typeof offset === 'number' ? offset : 0);
    if (!Number.isFinite(n) || n < 0) return 0;
    return n;
}

// Simple in-memory rate limiter
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
    key: string,
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000
): { allowed: boolean; retryAfterMs: number } {
    const now = Date.now();
    const entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
        rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterMs: 0 };
    }

    if (entry.count >= maxAttempts) {
        return { allowed: false, retryAfterMs: entry.resetAt - now };
    }

    entry.count++;
    return { allowed: true, retryAfterMs: 0 };
}

// Cleanup stale entries periodically (every 5 min)
if (typeof globalThis !== 'undefined') {
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore) {
            if (now > entry.resetAt) rateLimitStore.delete(key);
        }
    }, 5 * 60 * 1000).unref?.();
}

export function getClientIP(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
    return 'unknown';
}

const CleanTextSchema = (min: number, max: number, message: string) =>
    z.string()
        .trim()
        .min(min, message)
        .max(max, `${message.replace(' is required', '')} is too long`)
        .transform((value) => value.replace(/\s+/g, ' '));

export const TourParticipantSchema = z.object({
    id: z.coerce.number().int().positive().optional(),
    name: CleanTextSchema(1, 100, "Name is required"),
    userId: z.coerce.number().int().positive().optional().nullable(),
}).strict();

export const CreateTourSchema = z.object({
    name: CleanTextSchema(1, 100, "Tour name is required"),
    participants: z.array(CleanTextSchema(1, 100, "Participant name is required"))
        .min(2, "Add at least two participants")
        .max(25, "A tour can include up to 25 participants")
        .superRefine((participants, ctx) => {
            const seen = new Set<string>();
            participants.forEach((participant, index) => {
                const key = participant.toLocaleLowerCase();
                if (seen.has(key)) {
                    ctx.addIssue({
                        code: "custom",
                        path: [index],
                        message: "Participant names must be unique",
                    });
                }
                seen.add(key);
            });
        }),
}).strict();

export const TourGroupSchema = CreateTourSchema;

export const TourTransactionSchema = z.object({
    amount: z.coerce.number().positive("Amount must be positive").max(MAX_AMOUNT, "Amount is too large"),
    description: CleanTextSchema(1, 500, "Description is required"),
    category: z.string().trim().max(50, "Category is too long").default("Travel").transform((value) => value || "Travel"),
    date: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, "Invalid date format"),
    paidBy: z.coerce.number().int().positive("Paid By is required"),
    paidByParticipantId: z.coerce.number().int().positive().optional(),
    splitType: z.enum(["equal", "percentage", "exact"]).default("equal"),
}).strict().transform((value) => ({
    ...value,
    paidBy: value.paidByParticipantId ?? value.paidBy,
}));

export const TourIdParamSchema = z.object({
    id: z.coerce.number().int().positive("Invalid tour ID"),
}).strict();
