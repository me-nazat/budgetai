/**
 * @fileoverview Authentication middleware for API route protection.
 *
 * Provides a higher-order function that wraps API route handlers with
 * automatic JWT verification. Extracts the user's identity from the
 * access token cookie and injects it into the handler context.
 *
 * ## Usage
 * ```ts
 * import { withAuth, type AuthenticatedRequest } from '@/lib/middleware/with-auth';
 *
 * export const GET = withAuth(async (request, context) => {
 *   const userId = context.userId;
 *   // ... handle request
 * });
 * ```
 *
 * @module lib/middleware/with-auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, type SessionPayload } from '@/lib/security/session-manager';
import { apiError } from '@/lib/types/api';
import { AuthenticationError, ErrorCode } from '@/lib/types/errors';

/**
 * Context injected into authenticated route handlers.
 *
 * Contains the verified user identity and session metadata
 * extracted from the access JWT.
 */
export interface AuthContext {
  /** The authenticated user's database ID. */
  userId: number;
  /** The authenticated user's email address. */
  email: string;
  /** The full decoded session payload. */
  session: SessionPayload;
}

/**
 * Type for route handler functions that require authentication.
 *
 * @template T Optional Next.js route handler params (e.g., `{ params: { id: string } }`).
 */
export type AuthenticatedHandler<T = Record<string, never>> = (
  request: NextRequest,
  context: AuthContext,
  routeContext?: T
) => Promise<NextResponse>;

/**
 * Higher-order function that wraps an API route handler with authentication.
 *
 * Verifies the access token from cookies, extracts the user identity,
 * and passes it to the handler via `AuthContext`. If the token is missing
 * or invalid, returns a 401 Unauthorized response.
 *
 * @template T Optional route context type (for dynamic routes).
 * @param handler - The authenticated route handler function.
 * @returns A standard Next.js route handler that performs auth checks.
 *
 * @example
 * ```ts
 * // In src/app/api/transactions/route.ts
 * export const GET = withAuth(async (request, { userId }) => {
 *   const transactions = await transactionService.getAll(userId);
 *   return apiSuccess({ transactions });
 * });
 * ```
 *
 * @security
 * - Token verification is performed on every request (no caching).
 * - Failed auth returns a generic message to prevent user enumeration.
 * - The handler never executes if authentication fails.
 */
export function withAuth<T = Record<string, never>>(
  handler: AuthenticatedHandler<T>
) {
  return async (
    request: NextRequest,
    routeContext?: T
  ): Promise<NextResponse> => {
    try {
      const session = await getSession();

      if (!session || typeof session.userId !== 'number') {
        return apiError(
          new AuthenticationError(
            'Authentication required. Please log in.',
            ErrorCode.UNAUTHORIZED
          )
        );
      }

      const authContext: AuthContext = {
        userId: session.userId,
        email: session.email as string,
        session,
      };

      return await handler(request, authContext, routeContext);
    } catch (error) {
      // JWT verification errors
      if (error instanceof AuthenticationError) {
        return apiError(error);
      }

      // Unexpected errors during auth
      console.error('[auth-middleware] Unexpected error:', error);
      return apiError(
        new AuthenticationError(
          'Authentication failed. Please log in again.',
          ErrorCode.TOKEN_INVALID
        )
      );
    }
  };
}

/**
 * Extracts the user ID from the current session without throwing.
 *
 * Useful for optional authentication where some features are available
 * to both authenticated and anonymous users.
 *
 * @returns The user ID if authenticated, or null.
 */
export async function getOptionalUserId(): Promise<number | null> {
  try {
    const session = await getSession();
    return session?.userId ?? null;
  } catch {
    return null;
  }
}
