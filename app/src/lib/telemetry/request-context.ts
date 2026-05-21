/**
 * @fileoverview Request context for telemetry and tracing.
 *
 * Generates unique request IDs and provides request-scoped
 * metadata for logging and error tracking.
 *
 * @module lib/telemetry/request-context
 */

import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';

/**
 * Request context data carried through the middleware pipeline.
 */
export interface RequestContextData {
  /** Unique identifier for this request. */
  requestId: string;
  /** Request method (GET, POST, etc.). */
  method: string;
  /** Request path (e.g., /api/transactions). */
  path: string;
  /** Client IP address. */
  ip: string;
  /** Request start time (for duration calculation). */
  startTime: number;
  /** User-Agent header value. */
  userAgent: string;
  /** Authenticated user ID (if available). */
  userId?: number;
}

/**
 * Creates a new request context from a Next.js request.
 *
 * @param request - The incoming Next.js request.
 * @returns A populated RequestContextData object.
 *
 * @example
 * ```ts
 * const ctx = createRequestContext(request);
 * Logger.info('Request started', { requestId: ctx.requestId, path: ctx.path });
 * ```
 */
export function createRequestContext(
  request: NextRequest
): RequestContextData {
  const url = new URL(request.url);

  return {
    requestId: randomUUID(),
    method: request.method,
    path: url.pathname,
    ip: extractClientIP(request),
    startTime: performance.now(),
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * Calculates the elapsed time since the context was created.
 *
 * @param ctx - The request context.
 * @returns Duration in milliseconds (rounded to 1 decimal).
 */
export function getRequestDuration(ctx: RequestContextData): number {
  return Math.round((performance.now() - ctx.startTime) * 10) / 10;
}

/**
 * Extracts the client IP address from a Next.js request.
 *
 * Checks headers in order of priority:
 * 1. `x-forwarded-for` (proxy/load balancer)
 * 2. `x-real-ip` (Nginx)
 * 3. `cf-connecting-ip` (Cloudflare)
 * 4. Falls back to 'unknown'
 *
 * @param request - The incoming request.
 * @returns The client's IP address.
 *
 * @security
 * - Only the first IP from `x-forwarded-for` is used.
 * - Headers are easily spoofed — do not use for security decisions.
 */
function extractClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

/**
 * Formats a request context into a structured log object.
 *
 * @param ctx - The request context.
 * @returns A clean object suitable for structured logging.
 */
export function formatContextForLog(
  ctx: RequestContextData
): Record<string, unknown> {
  return {
    requestId: ctx.requestId,
    method: ctx.method,
    path: ctx.path,
    ip: ctx.ip,
    durationMs: getRequestDuration(ctx),
    userId: ctx.userId,
  };
}
