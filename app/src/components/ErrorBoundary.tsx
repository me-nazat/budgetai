/**
 * @fileoverview Global Error Boundary component for unhandled React errors.
 *
 * Implements institutional surface tokens (--bg-canvas, --bg-surface, --border-subtle)
 * and provides safe recovery routes back to the main dashboard.
 *
 * @module components/ErrorBoundary
 */

'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught rendering error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = (): void => {
    try {
      sessionStorage.removeItem('wealth-ai-core-meta-v1');
    } catch {}
    window.location.href = '/dashboard';
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--color-text-main)] font-sans">
          <div className="max-w-md w-full p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--finance-warning-bg)] text-[var(--finance-warning)] flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[24px]">warning</span>
            </div>

            <h1 className="text-xl font-semibold text-[var(--color-text-main)] mb-2 tracking-[-0.01em]">
              Application Error
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
              A view rendering error occurred while displaying this section. Your financial records and active sessions are intact.
            </p>

            {process.env.NODE_ENV !== 'production' && (
              <details className="mb-6 text-left border border-[var(--border-subtle)] rounded-lg p-3 bg-[var(--bg-elevated)]">
                <summary className="text-xs font-mono cursor-pointer text-[var(--color-text-muted)] select-none">
                  Diagnostic details
                </summary>
                <pre className="mt-2 text-[11px] font-mono text-[var(--finance-negative)] overflow-x-auto whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--color-text-main)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
              >
                Return to dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
