/**
 * @fileoverview Custom error classes for the Wealth AI application.
 *
 * Provides a hierarchy of typed errors that carry HTTP status codes,
 * error codes, and structured metadata. These errors are caught by the
 * API handler middleware and serialized into consistent error responses.
 *
 * ## Error Hierarchy
 * ```
 * AppError (base)
 * ├── ValidationError     (400)
 * ├── AuthenticationError (401)
 * ├── AuthorizationError  (403)
 * ├── NotFoundError       (404)
 * ├── ConflictError       (409)
 * ├── RateLimitError      (429)
 * └── InternalError       (500)
 * ```
 *
 * ## Design Principles
 * - Errors carry enough context for debugging but NEVER leak
 *   stack traces or internal details to the client.
 * - Each error has a machine-readable `code` for client-side handling.
 * - Errors are serializable via `toJSON()` for consistent API responses.
 *
 * @module lib/types/errors
 */

/**
 * Machine-readable error codes for client-side error handling.
 *
 * Clients can switch on these codes to display appropriate messages
 * or take specific recovery actions.
 *
 * @remarks
 * Error codes follow the convention: `DOMAIN_SPECIFIC_ERROR`.
 * New codes should be added to this enum and documented.
 */
export enum ErrorCode {
  // ── Validation ──
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_DATE_FORMAT = 'INVALID_DATE_FORMAT',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_FREQUENCY = 'INVALID_FREQUENCY',
  INVALID_CURRENCY = 'INVALID_CURRENCY',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',

  // ── Authentication ──
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  SESSION_REVOKED = 'SESSION_REVOKED',
  REFRESH_TOKEN_INVALID = 'REFRESH_TOKEN_INVALID',
  REFRESH_TOKEN_EXPIRED = 'REFRESH_TOKEN_EXPIRED',

  // ── Two-Factor Authentication ──
  TWO_FACTOR_REQUIRED = 'TWO_FACTOR_REQUIRED',
  TWO_FACTOR_INVALID = 'TWO_FACTOR_INVALID',
  TWO_FACTOR_ALREADY_ENABLED = 'TWO_FACTOR_ALREADY_ENABLED',
  TWO_FACTOR_NOT_ENABLED = 'TWO_FACTOR_NOT_ENABLED',
  BACKUP_CODE_INVALID = 'BACKUP_CODE_INVALID',

  // ── WebAuthn ──
  PASSKEY_REGISTRATION_FAILED = 'PASSKEY_REGISTRATION_FAILED',
  PASSKEY_AUTHENTICATION_FAILED = 'PASSKEY_AUTHENTICATION_FAILED',
  PASSKEY_NOT_FOUND = 'PASSKEY_NOT_FOUND',

  // ── Authorization ──
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',

  // ── Resource ──
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',
  BUDGET_NOT_FOUND = 'BUDGET_NOT_FOUND',
  GOAL_NOT_FOUND = 'GOAL_NOT_FOUND',

  // ── Conflict ──
  CONFLICT = 'CONFLICT',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  CATEGORY_ALREADY_EXISTS = 'CATEGORY_ALREADY_EXISTS',
  BUDGET_ALREADY_EXISTS = 'BUDGET_ALREADY_EXISTS',

  // ── Rate Limiting ──
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_LOGIN_ATTEMPTS = 'TOO_MANY_LOGIN_ATTEMPTS',
  TOO_MANY_REGISTER_ATTEMPTS = 'TOO_MANY_REGISTER_ATTEMPTS',

  // ── Internal ──
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Serialized error format sent to API clients.
 * Never includes stack traces or internal implementation details.
 */
export interface SerializedError {
  /** HTTP status code. */
  status: number;
  /** Machine-readable error code for client-side handling. */
  code: ErrorCode;
  /** Human-readable error message safe for display. */
  message: string;
  /** Optional field-level validation errors. */
  errors?: Array<{
    /** The field path that failed validation (e.g., 'amount', 'email'). */
    field: string;
    /** Description of the validation failure. */
    message: string;
  }>;
}

/**
 * Base error class for all application errors.
 *
 * Extends the native `Error` class with HTTP status codes, machine-readable
 * error codes, and serialization support for API responses.
 *
 * @remarks
 * - All custom errors extend this class.
 * - The `toJSON()` method produces a client-safe representation.
 * - Stack traces are available in the error object but NEVER serialized.
 * - Use specific subclasses instead of instantiating `AppError` directly.
 *
 * @example
 * ```ts
 * throw new ValidationError('Invalid email format', ErrorCode.VALIDATION_FAILED);
 * ```
 */
export class AppError extends Error {
  /** HTTP status code for the error response. */
  public readonly statusCode: number;

  /** Machine-readable error code. */
  public readonly code: ErrorCode;

  /** Whether this error should be logged as a warning vs. an error. */
  public readonly isOperational: boolean;

  /**
   * Creates a new AppError.
   *
   * @param message - Human-readable error message (safe for client display).
   * @param statusCode - HTTP status code (default: 500).
   * @param code - Machine-readable error code (default: INTERNAL_ERROR).
   * @param isOperational - Whether this is an expected error (vs. a bug).
   */
  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = ErrorCode.INTERNAL_ERROR,
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;

    // Preserve proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace (V8 engines only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Serializes the error for API response.
   * NEVER includes stack traces or internal details.
   *
   * @returns A client-safe error object.
   */
  toJSON(): SerializedError {
    return {
      status: this.statusCode,
      code: this.code,
      message: this.message,
    };
  }
}

/**
 * Validation error (HTTP 400).
 *
 * Thrown when request input fails Zod schema validation or
 * business rule validation.
 *
 * @example
 * ```ts
 * throw new ValidationError('Amount must be a positive number');
 * ```
 */
export class ValidationError extends AppError {
  /** Field-level validation errors. */
  public readonly fieldErrors: Array<{ field: string; message: string }>;

  constructor(
    message: string = 'Validation failed',
    code: ErrorCode = ErrorCode.VALIDATION_FAILED,
    fieldErrors: Array<{ field: string; message: string }> = []
  ) {
    super(message, 400, code);
    this.fieldErrors = fieldErrors;
  }

  toJSON(): SerializedError {
    return {
      ...super.toJSON(),
      errors: this.fieldErrors.length > 0 ? this.fieldErrors : undefined,
    };
  }
}

/**
 * Authentication error (HTTP 401).
 *
 * Thrown when the request lacks valid authentication credentials.
 *
 * @example
 * ```ts
 * throw new AuthenticationError('Invalid email or password');
 * ```
 */
export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication required',
    code: ErrorCode = ErrorCode.UNAUTHORIZED
  ) {
    super(message, 401, code);
  }
}

/**
 * Authorization error (HTTP 403).
 *
 * Thrown when an authenticated user attempts to access a resource
 * they don't have permission for.
 *
 * @example
 * ```ts
 * throw new AuthorizationError('You do not have access to this resource');
 * ```
 */
export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Access denied',
    code: ErrorCode = ErrorCode.FORBIDDEN
  ) {
    super(message, 403, code);
  }
}

/**
 * Not found error (HTTP 404).
 *
 * Thrown when a requested resource doesn't exist or doesn't belong
 * to the authenticated user.
 *
 * @example
 * ```ts
 * throw new NotFoundError('Transaction not found');
 * ```
 */
export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    code: ErrorCode = ErrorCode.NOT_FOUND
  ) {
    super(message, 404, code);
  }
}

/**
 * Conflict error (HTTP 409).
 *
 * Thrown when a request conflicts with the current state of the resource
 * (e.g., duplicate email, existing budget for the same category/month).
 *
 * @example
 * ```ts
 * throw new ConflictError('Email already registered', ErrorCode.EMAIL_ALREADY_EXISTS);
 * ```
 */
export class ConflictError extends AppError {
  constructor(
    message: string = 'Resource conflict',
    code: ErrorCode = ErrorCode.CONFLICT
  ) {
    super(message, 409, code);
  }
}

/**
 * Rate limit error (HTTP 429).
 *
 * Thrown when the client exceeds the configured rate limit for a route.
 * Includes the `retryAfterSeconds` field for the `Retry-After` header.
 *
 * @example
 * ```ts
 * throw new RateLimitError('Too many login attempts', 120);
 * ```
 */
export class RateLimitError extends AppError {
  /** Seconds until the rate limit window resets. */
  public readonly retryAfterSeconds: number;

  constructor(
    message: string = 'Too many requests. Please try again later.',
    retryAfterSeconds: number = 60,
    code: ErrorCode = ErrorCode.RATE_LIMIT_EXCEEDED
  ) {
    super(message, 429, code);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Internal server error (HTTP 500).
 *
 * Used for unexpected errors that indicate a bug or system failure.
 * The original error message is replaced with a generic message for clients.
 *
 * @remarks
 * - `isOperational` is set to `false` — these errors should trigger alerts.
 * - The generic message prevents leaking internal details.
 *
 * @example
 * ```ts
 * throw new InternalError('Database connection pool exhausted');
 * // Client sees: "An unexpected error occurred. Please try again later."
 * ```
 */
export class InternalError extends AppError {
  /** The original internal error message (never sent to client). */
  public readonly internalMessage: string;

  constructor(
    internalMessage: string = 'Unknown internal error',
    code: ErrorCode = ErrorCode.INTERNAL_ERROR
  ) {
    super('An unexpected error occurred. Please try again later.', 500, code, false);
    this.internalMessage = internalMessage;
  }
}

/**
 * Converts any unknown error into a structured AppError.
 *
 * Used by the API handler middleware to normalize all errors into
 * a consistent format before sending the response.
 *
 * @param error - Any thrown value (Error, string, unknown).
 * @returns An AppError instance.
 *
 * @complexity O(1)
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalError(error.message);
  }

  return new InternalError(String(error));
}
