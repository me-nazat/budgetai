# 04 · Financial Ledger & Operations — Wealth AI

## Objective

Make the transaction ledger, tour budgeting, settings, and detail modals feel
precise, secure, and effortless. Financial auditability and accessibility take
priority over decorative animation.

## Transactions ledger

- In `src/app/(app)/transactions/page.tsx`, provide a responsive header with a
  labelled search, month/date filter, type pills (`all`, `expense`, `earning`),
  and a clear new-entry action.
- Memoize client-side filters only when they are profiled as worthwhile; use
  File 12’s worker/deferred search pattern for genuinely large lists. Preserve
  date, type, currency, and user-context correctness.
- Render dense, scannable rows with category colors from `getCategoryHex`,
  currency formatting from the existing currency hook, tabular amounts, and
  explicit expense/earning labels. Motion may stagger entry or provide a subtle
  hover translation but must not interfere with keyboard or touch operation.

## Transaction detail modal

- `src/components/TransactionDetailModal.tsx` should use an accessible dialog
  pattern with a frosted backdrop, focus management, Escape support, and a
  spring-or-static entry depending on user preference.
- Preserve a responsive metadata/notes and attachments layout, asynchronous
  save feedback, and visible edit/duplicate/delete actions. Deletion retains
  the app’s confirmation and recovery semantics.

## Tours and settings

- Tour cards may use existing `TiltCard` as optional visual polish while clearly
  exposing participants, total spend, date, and join/delete actions. Destructive
  tour actions need confirmation.
- Settings organizes profile, security, and preference tabs. Horizontal motion
  is secondary to correct forms, validation, passkey/TOTP/session management,
  currency selection, and alert preference persistence.

## Acceptance gates

- Financial operations are keyboard accessible, responsive, correctly formatted,
  and secure under loading/error/retry conditions.
- Ledger performance stays responsive for a representative large data set.
- All modals, filters, tabs, and actions work with reduced motion and no
  animation-related layout shift.
