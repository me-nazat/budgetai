# Liquid & Fluent — Redesign Roadmap

Tracking doc for the app-wide UI/UX overhaul. Checked off as sessions complete
real, reviewed changes — not aspirational. Update this file as you go so
progress survives across chat sessions / Claude Code runs.

**Design system foundation:** `src/lib/motion.ts` — shared spring tokens
(`springSnap`, `springSmooth`, `springGentle`, `springBouncy`, `springTrack`,
`springTap`, `EASE_LIQUID`). New motion code should import from here rather
than hand-rolling `{ type: 'spring', stiffness, damping }`.

## Phase 0 — Shared shell (touches every page)
- [x] `lib/motion.ts` — centralized spring/easing tokens
- [x] `components/Sidebar.tsx` — shared-layout pill + accent bar, spring theme-toggle icon, tap feedback
- [x] `components/ui/PageTransition.tsx` — fixed missing `AnimatePresence` (exit variants existed but never played on any route)
- [x] `app/globals.css` `.app-surface` — ambient gradient mesh on the base canvas (light + dark)
- [ ] Sidebar collapse mode (icon-only + tooltips) — bigger change, touches `main` margin across the app shell, do as its own reviewed pass
- [ ] `AuroraBackground` — confirm/tune where it's used vs. the new `.app-surface` ambient wash so they don't compete
- [ ] Modal/overlay base (`BottomSheetModal`, generic dialog patterns) — standardize backdrop-blur ease-in + spring content mount across all modals

## Phase 1 — Landing & auth (first impression, no live user data at risk)
- [x] `app/LandingPage.tsx` — hero, parallax/tilt, `text-wrap: balance` headlines
- [x] `components/landing/FeatureCard3D.tsx`, `ScrollProgress.tsx` mounted
- [ ] `components/landing/AnimatedCounter.tsx`, `FinancialLineGraph.tsx`
- [ ] `app/login`, `app/register` — passkey/auth modal step transitions

## Phase 2 — Money overview (highest-traffic screens)
- [x] `dashboard` — stat cards, sparklines, staggered widget entrance, skeleton parity
- [x] `overview`, `analytics`, `reports`, `insights`, `benchmarks`
- [x] `charts/` components — Recharts/Chart.js curve + gradient-fill + tooltip pass

## Phase 3 — Money movement
- [ ] `transactions` (+ `[transactionSlug]`) — ledger rows, `QuickAddModal`, `TransactionDetailModal`
- [ ] `bank-import` — dropzone, OCR/scan progress
- [ ] `documents`, `history`, `notifications`

## Phase 4 — Planning tools
- [ ] `budget`, `debts` (Debt Payoff Planner), `goals`, `wealth-goals`, `forecast`, `fire`, `networth`, `my-month`
- [ ] `WhatIfSimulator.tsx`, `MonthlyHeatmap.tsx` / `YearlyHeatmap.tsx`

## Phase 5 — Social / household / travel
- [ ] `tours` (+ `[id]`, `join`, `new`) — Tour Manager "journey" card-stack treatment
- [ ] `household`, `bill-split`, `benchmarks`
- [ ] `Tour*Modal.tsx` family (Edit/AddCost/EditCost/TransactionDetail), `JoinTourModal.tsx`

## Phase 6 — Gamification & settings
- [ ] `achievements` — badge unlock animation, progress rings, 3D tilt
- [ ] `settings`, `tax-center`, `automation-rules`, `recurring-subscriptions`, `accounts`, `investments`
- [ ] `CommandPalette.tsx` (Cmd+K already fully wired — just needs a visual pass to match the new system)

---

### How to keep using this
Each session/pass: pick the next unchecked phase (or one item within it),
implement + verify (syntax/type-check, ideally visual check in a running
dev server), check it off, commit. Don't batch unrelated phases into one
diff — a `dashboard` change and a `tours` change reviewed together is how
regressions slip through on an app this size.
