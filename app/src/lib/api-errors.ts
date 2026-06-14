export function getApiErrorMessage(payload: unknown, fallback = 'Something went wrong'): string {
  if (!payload || typeof payload !== 'object') return fallback;

  const record = payload as Record<string, unknown>;
  const error = record.error;

  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.message === 'string') return errorRecord.message;
    const errors = errorRecord.errors;
    if (Array.isArray(errors)) {
      const first = errors.find((item) => item && typeof item === 'object') as Record<string, unknown> | undefined;
      if (typeof first?.message === 'string') return first.message;
    }
  }

  if (typeof record.message === 'string') return record.message;
  return fallback;
}
