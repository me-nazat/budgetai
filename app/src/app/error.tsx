/**
 * @fileoverview Global error page for unhandled server-side errors.
 *
 * Next.js displays this component when a server-side error occurs
 * during rendering. Provides retry functionality and navigation.
 *
 * @module app/error
 */

'use client';

import { useEffect } from 'react';

/**
 * Error — global server-side error page.
 *
 * @param error - The error that triggered this page.
 * @param reset - Function to retry the failed render.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global Error Page]', error);
  }, [error]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          padding: '48px 40px',
          borderRadius: '20px',
          background: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          textAlign: 'center',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Error icon */}
        <div style={{ marginBottom: '24px' }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.8 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: '#f8f8f8',
            margin: '0 0 12px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Something went wrong
        </h1>

        <p
          style={{
            fontSize: '15px',
            color: '#a0a0b0',
            lineHeight: 1.6,
            margin: '0 0 8px 0',
          }}
        >
          An unexpected error occurred while loading this page.
          Your data is safe — this is a display issue.
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: '12px',
              color: '#606070',
              margin: '0 0 24px 0',
              fontFamily: 'monospace',
            }}
          >
            Error ID: {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={reset}
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
              letterSpacing: '-0.01em',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => (window.location.href = '/dashboard')}
            style={{
              padding: '12px 28px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'transparent',
              color: '#a0a0b0',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'opacity 0.2s ease',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
