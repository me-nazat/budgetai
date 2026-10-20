'use client';

import { useEffect } from 'react';

/**
 * Root error boundary page for Next.js App Router.
 *
 * Implements institutional surface tokens (--bg-canvas, --bg-surface, --border-subtle)
 * and provides safe recovery routes back to the main dashboard.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global App Router Error]', error);
  }, [error]);

  const handleGoHome = (): void => {
    try {
      sessionStorage.removeItem('wealth-ai-core-meta-v1');
    } catch {}
    window.location.href = '/dashboard';
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--color-text-main)] font-sans">
      <div className="max-w-md w-full p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] text-center">
        {/* Institutional Warning Icon */}
        <div className="w-12 h-12 rounded-xl bg-[var(--finance-warning-bg)] text-[var(--finance-warning)] flex items-center justify-center mx-auto mb-4 border border-[var(--border-subtle)]">
          <svg
            className="w-6 h-6"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-[var(--color-text-main)] mb-2 tracking-[-0.01em]">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
          An unexpected error occurred while loading this page. Your financial records are secure.
        </p>

        {error.digest && (
          <p className="text-xs font-mono text-[var(--color-text-dim)] mb-6 select-all">
            Reference code: {error.digest}
          </p>
        )}

        {process.env.NODE_ENV !== 'production' && error.message && (
          <details className="mb-6 text-left border border-[var(--border-subtle)] rounded-lg p-3 bg-[var(--bg-elevated)]">
            <summary className="text-xs font-mono cursor-pointer text-[var(--color-text-muted)] select-none">
              Diagnostic details
            </summary>
            <pre className="mt-2 text-[11px] font-mono text-[var(--finance-negative)] overflow-x-auto whitespace-pre-wrap">
              {error.message}
            </pre>
          </details>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={handleGoHome}
            className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--color-text-main)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
