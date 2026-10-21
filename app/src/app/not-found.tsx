import Link from 'next/link';

/**
 * NotFound — 404 page styled with institutional surface tokens.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)] text-[var(--color-text-main)] font-sans">
      <div className="max-w-md w-full p-8 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-[0_1px_2px_rgba(0,0,0,0.25),0_0_0_1px_var(--border-subtle)] text-center">
        {/* Large 404 number */}
        <div className="text-6xl font-extrabold tracking-tight text-[var(--color-text-dim)] font-mono leading-none mb-3">
          404
        </div>

        <h1 className="text-xl font-semibold text-[var(--color-text-main)] mb-2 tracking-[-0.01em]">
          Page Not Found
        </h1>

        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-6">
          The requested page could not be located. It may have been moved or the URL might be invalid.
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="h-9 px-4 inline-flex items-center justify-center rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary-hover)] text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="h-9 px-4 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--color-text-main)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}

