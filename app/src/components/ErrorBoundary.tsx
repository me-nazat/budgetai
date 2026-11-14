/**
 * @fileoverview Global React error boundary with premium fallback UI.
 *
 * Catches unhandled React rendering errors and displays an elegant
 * fallback instead of a blank white screen. Includes retry/recovery
 * functionality and error reporting.
 *
 * @module components/ErrorBoundary
 */

'use client';

import React, { Component, type ReactNode, type ErrorInfo } from 'react';

/**
 * Props for the ErrorBoundary component.
 */
interface ErrorBoundaryProps {
  /** Child components to render. */
  children: ReactNode;
  /** Optional custom fallback UI renderer. */
  fallback?: (error: Error, retry: () => void) => ReactNode;
}

/**
 * Internal state for the ErrorBoundary.
 */
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * GlobalErrorBoundary — catches unhandled React errors.
 *
 * Wraps the application (or sections of it) to prevent rendering failures
 * from crashing the entire page. Provides a professional fallback UI
 * with retry and navigation options.
 *
 * @example
 * ```tsx
 * <GlobalErrorBoundary>
 *   <DashboardPage />
 * </GlobalErrorBoundary>
 * ```
 */
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

    // Report to telemetry (non-blocking)
    console.error('[ErrorBoundary] Caught rendering error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  /**
   * Resets the error state and attempts to re-render children.
   */
  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  /**
   * Navigates back to the dashboard (safe page).
   */
  handleGoHome = (): void => {
    window.location.href = '/dashboard';
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Custom fallback
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleRetry);
      }

      // Default premium fallback UI
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            {/* Animated error icon */}
            <div style={styles.iconContainer}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={styles.icon}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 style={styles.title}>Something went wrong</h1>
            <p style={styles.message}>
              An unexpected error occurred while rendering this page.
              Your data is safe — this is a display issue.
            </p>

            {/* Error details (development only) */}
            {process.env.NODE_ENV !== 'production' && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details</summary>
                <pre style={styles.pre}>
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            {/* Action buttons */}
            <div style={styles.actions}>
              <button
                onClick={this.handleRetry}
                style={styles.primaryButton}
                onMouseOver={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '0.9';
                }}
                onMouseOut={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '1';
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleGoHome}
                style={styles.secondaryButton}
                onMouseOver={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '0.8';
                }}
                onMouseOut={(e) => {
                  (e.target as HTMLButtonElement).style.opacity = '1';
                }}
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Inline styles for the error fallback UI.
 * Uses inline styles to ensure they work even if CSS loading fails.
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: '24px',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  card: {
    maxWidth: '480px',
    width: '100%',
    padding: '48px 40px',
    borderRadius: '20px',
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    textAlign: 'center' as const,
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
  },
  iconContainer: {
    marginBottom: '24px',
  },
  icon: {
    color: '#ef4444',
    opacity: 0.8,
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#f8f8f8',
    margin: '0 0 12px 0',
    letterSpacing: '-0.02em',
  },
  message: {
    fontSize: '15px',
    color: '#a0a0b0',
    lineHeight: 1.6,
    margin: '0 0 24px 0',
  },
  details: {
    marginBottom: '24px',
    textAlign: 'left' as const,
  },
  summary: {
    cursor: 'pointer',
    color: '#808090',
    fontSize: '13px',
    marginBottom: '8px',
  },
  pre: {
    fontSize: '12px',
    color: '#ef4444',
    background: 'rgba(239, 68, 68, 0.1)',
    padding: '12px',
    borderRadius: '8px',
    overflow: 'auto',
    maxHeight: '200px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  primaryButton: {
    padding: '12px 28px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    color: '#fff',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    letterSpacing: '-0.01em',
  },
  secondaryButton: {
    padding: '12px 28px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    background: 'transparent',
    color: '#a0a0b0',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
};

export default GlobalErrorBoundary;
