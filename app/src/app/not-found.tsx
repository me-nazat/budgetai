/**
 * @fileoverview Custom 404 Not Found page.
 *
 * Displays a premium, glassmorphism-styled 404 page when a user
 * navigates to a non-existent route.
 *
 * @module app/not-found
 */

import Link from 'next/link';

/**
 * NotFound — custom 404 page with premium aesthetics.
 */
export default function NotFound() {
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
        {/* Large 404 number */}
        <div
          style={{
            fontSize: '96px',
            fontWeight: 800,
            letterSpacing: '-0.05em',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            lineHeight: 1,
            marginBottom: '16px',
          }}
        >
          404
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
          Page Not Found
        </h1>

        <p
          style={{
            fontSize: '15px',
            color: '#a0a0b0',
            lineHeight: 1.6,
            margin: '0 0 32px 0',
          }}
        >
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.2s ease',
            }}
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 28px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'transparent',
              color: '#a0a0b0',
              fontSize: '14px',
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'opacity 0.2s ease',
            }}
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
