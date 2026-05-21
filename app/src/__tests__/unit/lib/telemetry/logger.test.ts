/**
 * @fileoverview Unit tests for the structured logger.
 *
 * @module __tests__/unit/lib/telemetry/logger.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '@/lib/telemetry/logger';

describe('Logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages to console.log', () => {
    Logger.info('Test info message');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('Test info message');
  });

  it('should log warn messages to console.warn', () => {
    Logger.warn('Test warning');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const output = warnSpy.mock.calls[0][0] as string;
    expect(output).toContain('Test warning');
  });

  it('should log error messages to console.error', () => {
    Logger.error('Test error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('Test error');
  });

  it('should log fatal messages to console.error', () => {
    Logger.fatal('Test fatal');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('Test fatal');
  });

  it('should include context in log output', () => {
    Logger.info('With context', {
      requestId: 'abc-123',
      userId: 42,
      route: '/api/test',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('With context');
    expect(output).toContain('abc-123');
  });

  it('should redact sensitive fields', () => {
    Logger.info('Login attempt', {
      password: 'secret123',
    } as Record<string, unknown>);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = logSpy.mock.calls[0][0] as string;
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('secret123');
  });

  it('should extract error details', () => {
    const err = new Error('Connection failed');
    Logger.error('Database error', { error: err });

    expect(errorSpy).toHaveBeenCalled();
    const output = errorSpy.mock.calls[0][0] as string;
    expect(output).toContain('Database error');
  });
});
