/**
 * @fileoverview Structured JSON logger for production telemetry.
 *
 * Provides a consistent logging interface that outputs structured JSON
 * suitable for ingestion by log aggregation systems (Datadog, Sentry,
 * ELK stack, etc.).
 *
 * ## Features
 * - Structured JSON output with consistent schema.
 * - Log levels: debug, info, warn, error, fatal.
 * - Automatic sensitive data scrubbing.
 * - Request context enrichment (ID, user, route, duration).
 * - Development-friendly console formatting.
 *
 * @module lib/telemetry/logger
 */

/**
 * Supported log levels in order of severity.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric severity for each log level (used for filtering).
 */
const LOG_LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

/**
 * Additional context attached to log entries.
 */
export interface LogContext {
  /** Unique request identifier for tracing. */
  requestId?: string;
  /** Authenticated user's ID. */
  userId?: number;
  /** API route path. */
  route?: string;
  /** Request duration in milliseconds. */
  durationMs?: number;
  /** HTTP method. */
  method?: string;
  /** HTTP status code. */
  statusCode?: number;
  /** Error object (stack trace is extracted). */
  error?: Error | unknown;
  /** Arbitrary metadata. */
  [key: string]: unknown;
}

/**
 * Structured log entry format.
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  severity: number;
  message: string;
  service: string;
  environment: string;
  context: Record<string, unknown>;
  stack?: string;
}

/**
 * Fields that are scrubbed from log output.
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'totpSecret',
  'apiKey',
  'authorization',
  'cookie',
]);

/**
 * Minimum log level based on environment.
 * Production only logs 'info' and above. Development logs everything.
 */
const MIN_LOG_LEVEL: LogLevel =
  process.env.NODE_ENV === 'production' ? 'info' : 'debug';

/**
 * Scrubs sensitive fields from an object.
 *
 * @param obj - The object to scrub.
 * @param depth - Current recursion depth (max 5).
 * @returns A new object with sensitive values replaced.
 */
function scrubSensitiveData(
  obj: Record<string, unknown>,
  depth: number = 0
): Record<string, unknown> {
  if (depth > 5) return { '[MAX_DEPTH]': true };

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      result[key] = '[REDACTED]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = scrubSensitiveData(
        value as Record<string, unknown>,
        depth + 1
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Formats a log entry as a structured JSON object.
 *
 * @param level - Log severity level.
 * @param message - Human-readable log message.
 * @param context - Additional context data.
 * @returns A formatted LogEntry.
 */
function formatLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext = {}
): LogEntry {
  const { error, ...rest } = context;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    severity: LOG_LEVEL_SEVERITY[level],
    message,
    service: 'wealth-ai',
    environment: process.env.NODE_ENV || 'development',
    context: scrubSensitiveData(rest as Record<string, unknown>),
  };

  if (error instanceof Error) {
    entry.stack = error.stack;
    entry.context.errorMessage = error.message;
    entry.context.errorName = error.name;
  }

  return entry;
}

/**
 * Logger — structured logging utility for the Wealth AI application.
 *
 * @example
 * ```ts
 * Logger.info('Transaction created', {
 *   userId: 42,
 *   route: '/api/transactions',
 *   durationMs: 15,
 * });
 *
 * Logger.error('Database connection failed', {
 *   error: new Error('ECONNREFUSED'),
 *   route: '/api/dashboard',
 * });
 * ```
 */
export class Logger {
  /**
   * Logs a debug-level message.
   * Only output in development environments.
   */
  static debug(message: string, context?: LogContext): void {
    Logger.log('debug', message, context);
  }

  /**
   * Logs an info-level message.
   * Used for normal operational events.
   */
  static info(message: string, context?: LogContext): void {
    Logger.log('info', message, context);
  }

  /**
   * Logs a warning-level message.
   * Used for unexpected but recoverable situations.
   */
  static warn(message: string, context?: LogContext): void {
    Logger.log('warn', message, context);
  }

  /**
   * Logs an error-level message.
   * Used for errors that need investigation.
   */
  static error(message: string, context?: LogContext): void {
    Logger.log('error', message, context);
  }

  /**
   * Logs a fatal-level message.
   * Used for unrecoverable errors that require immediate attention.
   */
  static fatal(message: string, context?: LogContext): void {
    Logger.log('fatal', message, context);
  }

  /**
   * Core log method. Checks severity, formats, and outputs.
   *
   * @param level - Severity level.
   * @param message - Log message.
   * @param context - Additional context.
   */
  private static log(
    level: LogLevel,
    message: string,
    context: LogContext = {}
  ): void {
    // Skip if below minimum level
    if (LOG_LEVEL_SEVERITY[level] < LOG_LEVEL_SEVERITY[MIN_LOG_LEVEL]) {
      return;
    }

    const entry = formatLogEntry(level, message, context);

    // Output based on environment
    if (process.env.NODE_ENV === 'production') {
      // Structured JSON for log aggregators
      const output = JSON.stringify(entry);
      if (level === 'error' || level === 'fatal') {
        console.error(output);
      } else if (level === 'warn') {
        console.warn(output);
      } else {
        console.log(output);
      }
    } else {
      // Human-readable format for development
      const prefix = `[${level.toUpperCase()}]`;
      const ctx = Object.keys(entry.context).length > 0
        ? ` ${JSON.stringify(entry.context)}`
        : '';

      if (level === 'error' || level === 'fatal') {
        console.error(`${prefix} ${message}${ctx}`);
        if (entry.stack) console.error(entry.stack);
      } else if (level === 'warn') {
        console.warn(`${prefix} ${message}${ctx}`);
      } else {
        console.log(`${prefix} ${message}${ctx}`);
      }
    }
  }
}
