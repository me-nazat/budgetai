# 08 · Performance Optimization & Loading Architecture — Wealth AI

## Goal

Make fast, stable rendering the foundation for every visual enhancement. The
target budgets are mobile LCP under 1.8 s on landing and 2.0 s in the app, CLS
under 0.05, TBT under 150 ms, and no avoidable hydration warnings.

## Architecture

- Keep pages and data loaders as Server Components by default. Isolate charts,
  pointer effects, and form interactions in focused Client Components.
- Stream independent dashboard regions with `Suspense` and give each a
  dimensionally equivalent skeleton. Add route `loading.tsx` fallbacks for
  expensive routes such as transactions.
- Dynamically import genuinely heavy client visualizations with `ssr: false`
  only when they cannot be server rendered. Supply an accessible chart skeleton.
- Use `next/font` with `display: "swap"`, reserve image dimensions, and keep
  the theme script before first paint.
- Virtualize measured long lists rather than rendering thousands of ledger
  rows. Use container queries for component responsiveness where appropriate.
- Introduce optimistic updates only where server reconciliation and rollback
  are implemented—not as a visual-only approximation.

## Caching and delivery

Audit Next.js 16 cache usage against the installed configuration and the
authentication model before enabling route or component caching. Never cache
user-specific financial data across users. Add prefetching only for routes that
are likely to be visited and do not cause unnecessary data transfer.

## Verification

- Measure a production build, not development mode, on landing, dashboard, and
  transactions. Include skeleton-to-data transitions in CLS checks.
- Use the bundle analyzer only after adding it deliberately to dev dependencies
  and make any CI budget realistic for the deployment environment.
- Test reduced motion, low-end mobile interaction, theme first paint, and a
  representative large ledger before merging.
