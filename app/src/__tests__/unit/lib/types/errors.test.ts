/**
 * @fileoverview Unit tests for the custom error hierarchy.
 *
 * @module __tests__/unit/lib/types/errors.test
 */

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  normalizeError,
  ErrorCode,
} from '@/lib/types/errors';

describe('AppError hierarchy', () => {
  it('should create an AppError with correct properties', () => {
    const error = new AppError('Test error', 400, ErrorCode.VALIDATION_FAILED);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.isOperational).toBe(true);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('should serialize to JSON without stack trace', () => {
    const error = new AppError('Test error', 400, ErrorCode.VALIDATION_FAILED);
    const json = error.toJSON();
    expect(json.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(json.message).toBe('Test error');
    expect(json.status).toBe(400);
    expect(json).not.toHaveProperty('stack');
  });

  it('should create a ValidationError (400)', () => {
    const errors = [{ field: 'email', message: 'Required' }];
    const error = new ValidationError('Invalid input', ErrorCode.VALIDATION_FAILED, errors);
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);

    const json = error.toJSON();
    expect(json.errors).toHaveLength(1);
    expect(json.errors![0].field).toBe('email');
  });

  it('should create an AuthenticationError (401)', () => {
    const error = new AuthenticationError('Unauthorized');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('should create an AuthorizationError (403)', () => {
    const error = new AuthorizationError('Forbidden');
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe(ErrorCode.FORBIDDEN);
  });

  it('should create a NotFoundError (404)', () => {
    const error = new NotFoundError('Not found');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
  });

  it('should create a ConflictError (409)', () => {
    const error = new ConflictError('Already exists');
    expect(error.statusCode).toBe(409);
    expect(error.code).toBe(ErrorCode.CONFLICT);
  });

  it('should create a RateLimitError (429)', () => {
    const error = new RateLimitError('Too fast', 30);
    expect(error.statusCode).toBe(429);
    expect(error.code).toBe(ErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.retryAfterSeconds).toBe(30);
  });

  it('should create an InternalError (500) with generic client message', () => {
    const error = new InternalError('Database crash');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(false);
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.internalMessage).toBe('Database crash');
    // Client message is generic — does NOT leak internal details
    expect(error.message).toContain('unexpected error');
  });
});

describe('normalizeError', () => {
  it('should pass through AppError instances', () => {
    const original = new NotFoundError('Not found');
    const normalized = normalizeError(original);
    expect(normalized).toBe(original);
  });

  it('should wrap generic Error as InternalError', () => {
    const original = new Error('Something broke');
    const normalized = normalizeError(original);
    expect(normalized).toBeInstanceOf(InternalError);
    expect(normalized.statusCode).toBe(500);
    // InternalError stores the original message internally, not as .message
    expect((normalized as InternalError).internalMessage).toBe('Something broke');
  });

  it('should wrap string errors', () => {
    const normalized = normalizeError('string error');
    expect(normalized).toBeInstanceOf(InternalError);
    expect((normalized as InternalError).internalMessage).toBe('string error');
  });

  it('should wrap null/undefined', () => {
    const normalized = normalizeError(null);
    expect(normalized).toBeInstanceOf(InternalError);
    expect((normalized as InternalError).internalMessage).toBe('null');
  });

  it('should wrap object errors', () => {
    const normalized = normalizeError({ error: 'bad' });
    expect(normalized).toBeInstanceOf(InternalError);
  });
});
