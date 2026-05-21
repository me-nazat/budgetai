/**
 * @fileoverview Standardized API response types and helper functions.
 *
 * All API routes return responses wrapped in a consistent envelope format.
 * This ensures clients can reliably parse success and error responses
 * without inspecting HTTP status codes.
 *
 * ## Success Response
 * ```json
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": { "timestamp": "...", "requestId": "..." }
 * }
 * ```
 *
 * ## Error Response
 * ```json
 * {
 *   "success": false,
 *   "error": {
 *     "code": "VALIDATION_FAILED",
 *     "message": "...",
 *     "errors": [{ "field": "email", "message": "Invalid format" }]
 *   }
 * }
 * ```
 *
 * @module lib/types/api
 */

import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import {
  AppError,
  ValidationError,
  normalizeError,
  ErrorCode,
  type SerializedError,
} from './errors';

/* ═══════════════════════════════════════════════════════════════
   RESPONSE TYPES
   ═══════════════════════════════════════════════════════════════ */

/**
 * Response metadata included in every API response.
 */
export interface ApiMeta {
  /** ISO-8601 timestamp of the response. */
  timestamp: string;
  /** Unique request identifier for tracing. */
  requestId?: string;
}

/**
 * Successful API response envelope.
 * @template T The type of the response data payload.
 */
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta: ApiMeta;
}

/**
 * Failed API response envelope.
 */
export interface ApiErrorResponse {
  success: false;
  error: SerializedError;
  meta: ApiMeta;
}

/**
 * Paginated API response for list endpoints.
 * @template T The type of each item in the data array.
 */
export interface PaginatedResponse<T = unknown> {
  success: true;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  meta: ApiMeta;
}

/* ═══════════════════════════════════════════════════════════════
   RESPONSE BUILDERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Creates a successful API response.
 *
 * @template T The type of the response data.
 * @param data - The response payload.
 * @param status - HTTP status code (default: 200).
 * @param headers - Additional response headers.
 * @returns A NextResponse with the standardized success envelope.
 *
 * @example
 * ```ts
 * return apiSuccess({ user: { id: 1, name: 'Alice' } }, 201);
 * ```
 */
export function apiSuccess<T>(
  data: T,
  status: number = 200,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true as const,
      data,
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status, headers }
  );
}

/**
 * Creates an error API response from an AppError.
 *
 * @param error - The application error (or any error to be normalized).
 * @param headers - Additional response headers (e.g., Retry-After).
 * @returns A NextResponse with the standardized error envelope.
 *
 * @example
 * ```ts
 * return apiError(new NotFoundError('Transaction not found'));
 * ```
 */
export function apiError(
  error: AppError | Error | unknown,
  headers?: Record<string, string>
): NextResponse<ApiErrorResponse> {
  const appError = normalizeError(error);

  return NextResponse.json(
    {
      success: false as const,
      error: appError.toJSON(),
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status: appError.statusCode, headers }
  );
}

/**
 * Creates a paginated API response.
 *
 * @template T The type of each item in the data array.
 * @param data - Array of response items.
 * @param total - Total number of matching items (before pagination).
 * @param limit - Page size used for this query.
 * @param offset - Starting offset used for this query.
 * @returns A NextResponse with pagination metadata.
 *
 * @example
 * ```ts
 * return apiPaginated(transactions, 150, 20, 0);
 * // { data: [...], pagination: { total: 150, limit: 20, offset: 0, hasMore: true } }
 * ```
 */
export function apiPaginated<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): NextResponse<PaginatedResponse<T>> {
  return NextResponse.json({
    success: true as const,
    data,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + data.length < total,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
}

/* ═══════════════════════════════════════════════════════════════
   VALIDATION HELPERS
   ═══════════════════════════════════════════════════════════════ */

/**
 * Validates input against a Zod schema and returns a typed result.
 *
 * Converts Zod validation errors into structured `ValidationError`
 * instances with field-level error details.
 *
 * @template T The expected output type of the Zod schema.
 * @param schema - The Zod schema to validate against.
 * @param data - The raw input data to validate.
 * @returns The validated and typed data.
 *
 * @throws {ValidationError} If validation fails, with field-level error details.
 *
 * @example
 * ```ts
 * const body = await request.json();
 * const validData = validateInput(CreateTransactionDTO, body);
 * // validData is fully typed and validated
 * ```
 *
 * @complexity O(n) where n is the number of fields being validated.
 */
export function validateInput<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const fieldErrors = formatZodErrors(result.error);
    throw new ValidationError(
      'Validation failed: ' + fieldErrors.map((e) => e.message).join(', '),
      ErrorCode.VALIDATION_FAILED,
      fieldErrors
    );
  }

  return result.data;
}

/**
 * Converts a ZodError into structured field-level errors.
 *
 * @param zodError - The Zod validation error.
 * @returns Array of { field, message } objects.
 *
 * @example
 * ```ts
 * // ZodError with path ['amount'] and message 'Expected number'
 * // => [{ field: 'amount', message: 'Expected number' }]
 * ```
 */
function formatZodErrors(
  zodError: ZodError
): Array<{ field: string; message: string }> {
  return zodError.issues.map((err: any) => ({
    field: err.path.join('.') || 'body',
    message: err.message,
  }));
}

/**
 * Extracts and validates query parameters from a URL.
 *
 * @template T The expected output type of the Zod schema.
 * @param url - The request URL.
 * @param schema - The Zod schema for query parameters.
 * @returns The validated query parameters.
 *
 * @throws {ValidationError} If query parameter validation fails.
 *
 * @example
 * ```ts
 * const { month, week } = validateQuery(request.url, DashboardQueryDTO);
 * ```
 */
export function validateQuery<T>(url: string, schema: ZodType<T>): T {
  const { searchParams } = new URL(url);
  const params: Record<string, string> = {};

  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  return validateInput(schema, params);
}
