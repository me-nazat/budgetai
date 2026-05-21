/**
 * @fileoverview Unified API handler wrapper with error handling, validation, and logging.
 *
 * Provides a higher-order function that wraps all API route handlers with:
 * - Automatic try/catch with structured error responses.
 * - Zod validation for request bodies and query parameters.
 * - Rate limiting via the rate limiter module.
 * - Request timing and structured logging.
 * - Consistent API response envelopes.
 *
 * ## Pipeline
 * ```
 * Request → Rate Limit → Auth Check → Zod Validation → Handler → Response
 *                                                        ↓ (error)
 *                                                   Error Response
 * ```
 *
 * @module lib/middleware/api-handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { apiError } from '@/lib/types/api';
import {
  AppError,
  ValidationError,
  RateLimitError,
  InternalError,
  ErrorCode,
  normalizeError,
} from '@/lib/types/errors';
import {
  checkRateLimit,
  getRateLimitHeaders,
  getClientIP,
  type RateLimitProfile,
} from '@/lib/security/rate-limiter';

/**
 * Configuration options for the API handler wrapper.
 */
export interface ApiHandlerOptions {
  /**
   * Rate limiting profile for this route.
   * If undefined, no rate limiting is applied.
   */
  rateLimit?: RateLimitProfile;

  /**
   * Custom rate limit identifier extractor.
   * Defaults to using the client IP address.
   */
  rateLimitIdentifier?: (request: NextRequest) => string;
}

/**
 * Wraps an API route handler with error handling, rate limiting, and logging.
 *
 * This is the outermost wrapper applied to all API routes. It ensures
 * consistent error responses, rate limit enforcement, and request timing.
 *
 * @param handler - The actual route handler function.
 * @param options - Optional configuration for rate limiting.
 * @returns A wrapped handler that catches all errors and returns structured responses.
 *
 * @example
 * ```ts
 * // Simple usage
 * export const GET = apiHandler(async (request) => {
 *   return apiSuccess({ message: 'Hello' });
 * });
 *
 * // With rate limiting
 * export const POST = apiHandler(
 *   async (request) => {
 *     const body = await request.json();
 *     return apiSuccess({ created: true });
 *   },
 *   { rateLimit: 'api' }
 * );
 * ```
 *
 * @security
 * - All unhandled exceptions are caught and logged.
 * - Stack traces are NEVER sent to the client.
 * - Rate limiting is enforced before the handler executes.
 * - Request duration is logged for performance monitoring.
 */
export function apiHandler(
  handler: (request: NextRequest) => Promise<NextResponse>,
  options: ApiHandlerOptions = {}
): (request: NextRequest) => Promise<NextResponse> {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = performance.now();
    const method = request.method;
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ── Rate Limiting ──
      if (options.rateLimit) {
        const identifier = options.rateLimitIdentifier
          ? options.rateLimitIdentifier(request)
          : getClientIP(request);

        const rateLimitResult = await checkRateLimit(identifier, options.rateLimit);

        if (!rateLimitResult.allowed) {
          const headers = getRateLimitHeaders(rateLimitResult);
          return apiError(
            new RateLimitError(
              'Too many requests. Please try again later.',
              rateLimitResult.retryAfterSeconds
            ),
            headers
          );
        }
      }

      // ── Execute Handler ──
      const response = await handler(request);

      // ── Logging ──
      const duration = (performance.now() - startTime).toFixed(1);
      const status = response.status;

      if (status >= 400) {
        console.warn(
          `[api] ${method} ${path} → ${status} (${duration}ms)`
        );
      }

      return response;
    } catch (error) {
      const duration = (performance.now() - startTime).toFixed(1);

      // ── Zod Validation Errors ──
      if (error instanceof ZodError) {
        const fieldErrors = error.errors.map((e) => ({
          field: e.path.join('.') || 'body',
          message: e.message,
        }));
        console.warn(
          `[api] ${method} ${path} → 400 VALIDATION (${duration}ms):`,
          fieldErrors.map((e) => `${e.field}: ${e.message}`).join(', ')
        );
        return apiError(
          new ValidationError(
            'Validation failed',
            ErrorCode.VALIDATION_FAILED,
            fieldErrors
          )
        );
      }

      // ── Application Errors (expected) ──
      if (error instanceof AppError) {
        if (!error.isOperational) {
          console.error(
            `[api] ${method} ${path} → ${error.statusCode} INTERNAL (${duration}ms):`,
            error.message,
            error.stack
          );
        } else {
          console.warn(
            `[api] ${method} ${path} → ${error.statusCode} ${error.code} (${duration}ms):`,
            error.message
          );
        }
        return apiError(error);
      }

      // ── Unexpected Errors (bugs) ──
      console.error(
        `[api] ${method} ${path} → 500 UNEXPECTED (${duration}ms):`,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error.stack : ''
      );

      return apiError(
        new InternalError(
          error instanceof Error ? error.message : 'Unknown error'
        )
      );
    }
  };
}
