# WealthAI — Master Implementation Specification
**Audit + Premium Feature Expansion Plan (Modules 10–19)**

> Authored from a direct audit of `me-nazat/budgetai` (commit `main`) and the live production deployment at `https://wealthai-red.vercel.app/`. Every claim in this document is traceable to a file path, route, or table read from the repository.

---

## Section 1 — Verified Ground Truth

### 1.1 Stack Breakdown (Confirmed Against `app/package.json` + Source)

| Layer | Verified Value | Evidence |
|---|---|---|
| **Framework** | **Next.js `^16.2.6`** (App Router) | `app/package.json` → `dependencies.next`. Note: the README claims "Next.js 14". This is **outdated** — the codebase is on Next 16 with the React-19-era features (`'use client'` boundaries, `use()` hook, etc.). Build script uses `next build --webpack`. |
| **Runtime** | React `19.2.3` + React-DOM `19.2.3` | `app/package.json`. Strict-mode + new hook semantics. |
| **Language** | TypeScript `^5`, `strict: true` | `tsconfig.json`; `npm run typecheck` script exists. |
| **Styling** | **Tailwind CSS v4** (no `tailwind.config.ts` — v4 uses CSS-first config) | `app/package.json` (`tailwindcss: "^4"`, `@tailwindcss/postcss: "^4"`); `app/src/app/globals.css` uses `@import "tailwindcss"; @theme inline { … }`. |
| **Animations** | Framer Motion `^12.35.0` | Confirmed in `Sidebar.tsx`, `MobileMenu.tsx`, `MobileTabBar.tsx`. |
| **Charts** | Chart.js `4.5.1` + `react-chartjs-2 5.3.1` (primary) **and** Recharts `^3.8.1` (secondary) | Both installed and used: Chart.js dominates the dashboard (`Bar`, `Doughnut`), Recharts is used in `DashboardStatCards` and net-worth sparkline. |
| **Database** | **Turso / libSQL** (`@libsql/client ^0.17.0`) | The README's "Turso (libSQL)" claim is correct here, but the README is wrong that the data access layer is "raw SQL repositories" — see below. |
| **ORM** | **Drizzle ORM `^0.45.2`** + `drizzle-kit ^0.31.10` | `app/package.json`, `drizzle.config.ts`, `app/src/db/schema/*.ts`. **README is wrong**: it claims "raw SQL, parameterized" — in fact the schema is fully defined in Drizzle's `sqliteTable` DSL and accessed via Drizzle's query builder. |
| **Migrations** | `drizzle-kit generate/migrate/push/studio` scripts wired | `app/package.json` → `db:*` scripts; `app/drizzle/` contains 5 committed migration SQL files + meta journal. |
| **AI — Vision / Parsing** | **Google Gemini** via `@google/generative-ai ^0.24.1` | `app/package.json`; `app/src/lib/ai/ocrPipeline.ts`, `statementParser.ts`. |
| **AI — Chat / Coach** | **OpenRouter** (model `google/gemini-flash-1.5` per README; consistent with the `OPENROUTER_API_KEY` env var) | `app/src/app/api/coach/insights/route.ts`, `app/src/app/api/chat/route.ts`. Streaming responses use `ReadableStream`. |
| **Auth — Primary** | **JWT (jose `^6.1.3`) + bcryptjs `^3.0.3`** with refresh-token rotation | `app/src/middleware.ts` (edge JWT verify), `app/src/services/auth.service.ts`, `app/src/lib/security/session-manager.ts`. Cookies: `wai-access` (15 min) + `wai-refresh` (7 days, hashed at rest, one-time-use). |
| **Auth — 2FA** | **TOTP** (`otpauth ^9.5.1`) | `app/src/lib/crypto/totp.ts`, `users.totp_secret` column, route at `/api/auth/2fa`. |
| **Auth — Passkeys** | **WebAuthn** via `@simplewebauthn/server ^13.3.0` + `@simplewebauthn/browser ^13.3.0` | Routes: `/api/auth/passkeys/register/options|verify`, `/api/auth/passkeys/login/options|verify`, `/api/auth/verify-passkey`. Tables: `user_passkeys`, `oauth_accounts`, `user_sessions` in `sessions.ts`. |
| **State Management** | **SWR `^2.4.1`** (primary server-state cache) + React Context for cross-cutting state | `app/src/components/SWRProvider.tsx`, `useDashboard`, `useUser`, `useMarketNews`, `useExchangeRates`, `useLayout` hooks. |
| **API Wrapper** | **Custom `apiHandler()` HOF** in `app/src/lib/middleware/api-handler.ts` | Wraps every API route. Pipeline: `Rate Limit → Auth → Zod Validate → Handler → Error Envelope`. Also injects **server-side Privacy Mode redaction** for sensitive paths. |
| **Rate Limiting** | **Upstash Redis `^1.38.0`** sliding-window (with in-memory fallback) | `app/src/lib/security/rate-limiter.ts`. Profiles: `auth` (50/15m), `passwordReset` (3/h), `twoFactor` (5/5m), `api` (100/min). |
| **Validation** | **Zod `^4.4.3`** | Per-route schemas under `app/src/lib/validators/`. |
| **Encryption** | **AES-256-GCM** for at-rest fields (`encrypted_amount`, `encrypted_saved_amount`, `encrypted_target_amount`, `encrypted_balance`, `totp_secret`) | `app/src/lib/crypto/encryption.ts`. |
| **Push Notifications** | **`web-push ^3.6.7`** + service worker `app/public/sw.js` | `app/src/app/api/push/subscribe/route.ts`, `push_subscriptions` table, VAPID env vars. |
| **Export — PDF** | **jsPDF `^4.2.0` + jspdf-autotable `^5.0.7`** | `app/src/lib/export/taxExporter.ts`. |
| **Export — Excel** | **exceljs `^4.4.0`** | `app/src/components/ExportButton.tsx`. |
| **PWA** | `next-pwa`-style manual service worker (`app/public/sw.js`, `manifest.json`) + `InstallPrompt.tsx` | Confirmed. |
| **Test Stack** | **Vitest `^4.1.7`** + `@testing-library/react ^16.3.2` + Playwright `^1.60.0` for E2E | `vitest.config.ts`, `app/src/__tests__/unit/*.test.ts`. Existing unit tests: `bengali-formatter`, `debts-simulator`, `generative-art`, `household-settlement`, `round-up-engine`, plus crypto/telemetry/types. |
| **Charts Misc** | `canvas-confetti ^1.9.4` for streak/badge celebrations | Used in `Sidebar`, achievements. |
| **Voice** | `useVoiceRecognition` hook present | Custom Web-Speech-API wrapper. |
| **Deployment** | Vercel (`vercel.json` present) | Confirmed. |

### 1.2 Design System Tokens (Live in `app/src/app/globals.css` + `app/src/styles/enterprise.css`)

**Color tokens** (CSS custom properties via Tailwind v4 `@theme`):

```
/* Extreme Dark (OLED-first) */
--color-bg-dark:        #0A0E1B   /* not #0A0A0A as the README claims */
--color-surface-dark:   #12182B
--color-surface-dark-2: #1A2238
--color-surface-hover:  #1E293B
--color-surface-border: rgba(255, 255, 255, 0.08)

/* Brand accents */
--color-primary:         #136dec   /* the "WAI Blue" */
--color-primary-hover:   #0f5ec8
--color-primary-light:   rgba(19, 109, 236, 0.10)
--color-accent-emerald:  #10b981
--color-accent-amber:    #FFB800
--color-accent-rose:     #FF2A5F

/* Text */
--color-text-main:     #FAFAFA
--color-text-muted:    #8E8E93
--color-text-secondary:#A1A1A6

/* Light mode (Premium White) */
--color-bg-light:      #F7F9FC
--color-surface-light: #FFFFFF

/* Landing-page specific (kept for marketing) */
--color-lp-cyan:       #5b8ff9
--color-lp-cyan-dark:  #136dec
--color-lp-bg-dark:    #0A0E1B
--color-lp-card-dark:  #12182B
--color-lp-navy:       #1A2238
--color-lp-navy-light: #f0f2f8

/* Premium gradient (used for stat cards / hero accents) */
--color-gradient-start: #136dec
--color-gradient-mid:   #1e3a8a
--color-gradient-end:   #10b981
```

**Typography** (Google Fonts loaded via `next/font`):
- `--font-geist` → body / UI text
- `--font-outfit` → all headings (h1–h6)
- `--font-playfair` → reserved for landing-page serif accent

**Glassmorphism utilities** (in `@layer utilities`):
- `.glass-card` → `backdrop-filter: blur(12px)`
- `.glass-panel` → `backdrop-filter: blur(24px) saturate(1.2)` + 1px translucent border + soft shadow (the workhorse for premium cards)
- `.app-surface` → ambient gradient background, dark/light variants
- `app/styles/enterprise.css` adds `.glass-card-elevated` (blur 30px, 10% border) and `.gradient-mesh-bg` (fixed, behind everything, layered radial gradients)
- `.shimmer-skeleton`, `.skeleton-panel`, `.skeleton-shimmer` → all loading states (zero raw spinners)

**Dark / Light toggling**:
- Class-based: `<html class="dark">` controls the `:where(.dark)` variants throughout
- Theme toggle persists in `localStorage` under `budget-ai-theme`; observer-driven re-render avoids flash
- Chart colors are tokenized via `var(--color-chart-line)`, `var(--graph-grid-color)`, `var(--graph-axis-text)`, `var(--graph-gradient-start|end)` so themes swap without rerunning data
- `prefers-reduced-motion` is **not yet globally respected** — Framer Motion variants accept it but no global media query disables it. **(Gap: Section 2 mandates adding it.)**

**Shared UI primitives** (under `app/src/components/ui/`):
`AuroraBackground`, `FluidButton`, `PageTransition`, `Skeleton`, `SmoothScroll`, `TiltCard` — all reusable, all already import-ready.

### 1.3 Audit Findings — What's Actually Built vs. What's Stubs

The README is **significantly out of date**. It describes 15 features; the actual codebase contains **29 protected routes, 70+ API route files, and 20 schema modules** — most of which the README never mentions. Below is the ground truth.

#### A. Fully built & shipped (UI + schema + API all live)
| Feature | Schema table(s) | API routes | UI route(s) | Notes |
|---|---|---|---|---|
| Auth (JWT + refresh) | `users`, `user_sessions`, `user_passkeys`, `oauth_accounts` | `/api/auth/*` (11 routes) | `/login`, `/register` | Refresh-token rotation + global edge middleware (`app/src/middleware.ts`) |
| 2FA TOTP | `users.totp_secret` | `/api/auth/2fa` | settings | Encrypted at rest via AES-256-GCM |
| Passkeys (WebAuthn) | `user_passkeys` | `/api/auth/passkeys/*` (4 routes) | settings | Full register/login ceremony |
| Transactions | `transactions` (+ encrypted cols) | `/api/transactions/*` (4 routes + batch-sync) | `/transactions`, `/dashboard` | NLP parse (`/api/transactions/nlp`), receipt scan (`/api/transactions/scan`), file attachments, bulk CSV import |
| Recurring | `recurring_transactions` | `/api/recurring` | `/recurring-subscriptions` | |
| Custom categories | `custom_categories` | `/api/categories` | settings, modals | |
| Accounts | `accounts` | `/api/accounts/[id]` | `/accounts` | |
| Budgets | `budgets` | `/api/budgets` | `/budget` | Includes `health-score` sub-API |
| Health score | (derived) | `/api/health-score` | dashboard widget | |
| Net worth | `net_worth` | `/api/networth` | `/networth` | Includes encrypted `encrypted_amount` |
| Savings goals | `savings_goals` | `/api/goals`, `/api/goals/milestones` | `/wealth-goals` | Milestones table already wired |
| Subscriptions | `subscriptions` | `/api/subscriptions/[id]` | `/recurring-subscriptions` | |
| Debts | `debts` | `/api/debts/[id]` | `/debts` | Avalanche/snowball simulator (test exists) |
| Investments | `investment_holdings` | `/api/investments` | `/investments` | Live market via `/api/market` |
| Automation rules | `automation_rules`, `automation_audit_log` | `/api/automation-rules/*` (3 routes) | `/automation-rules` | Includes audit-trail undo |
| Notifications | `notifications` | `/api/notifications` | `/notifications` | Mark-read, dismiss |
| Push subscriptions | `push_subscriptions` | `/api/push/subscribe`, cron at `/api/cron/push-check` | settings | VAPID keys via env |
| Achievements / Badges | `automation_audit_log` reused, `badges` | `/api/badges`, `/api/achievements` | `/achievements` | Confetti on unlock (4 user levels: Bronze→Silver→Gold→Platinum) |
| My-Month calendar | `transactions` (read-only) | `/api/calendar` | `/my-month` | Day-popup with full CRUD |
| FIRE simulator | (client-side math) | none | `/fire` | Lean / Regular / Fat modes |
| What-If simulator | (client-side math) | none | (embedded in `/forecast`?) | |
| Forecast (cashflow) | `recurring_transactions` | `/api/forecast` | `/forecast` | |
| Reports | n/a | `/api/report/annual` | `/reports` | PDF via jsPDF + autotable |
| Tours (group trips) | `tours`, `tour_participants`, `tour_itinerary_items`, `tour_checklist_categories`, `tour_checklist_items`, `tour_spendings` | `/api/bill-splits/tours/*` (8 routes) | `/tours`, `/tours/new`, `/tours/[id]`, `/tours/join/[code]` | Real-time SSE sync at `/api/bill-splits/tours/[id]/sync` |
| Quick bill split | `bill_splits` | `/api/bill-splits` | `/bill-split` | |
| Chat (AI Coach) | `chat_messages` | `/api/chat/*` (4 routes), `/api/coach/insights` | `/chat` | Streaming via ReadableStream |
| Snapshot sharing | `snapshots` (in db) | `/api/snapshot/*` | `/snapshot/[uuid]` | html2canvas export |
| Dashboard layout customization | `dashboard_layouts` | `/api/dashboard/layout`, `/api/settings/layout` | `/dashboard` | Widget order, hero widget, hidden widgets |
| Multi-currency | `users.base_currency` | `/api/rates`, `/api/exchange-rates` | `/settings` | Hourly cache, open.er-api.com |
| Households (basic) | `households`, `household_members`, `household_expenses` | `/api/households/*` (5 routes) | `/household` | |
| Heatmap | n/a | `/api/heatmap` | dashboard | |
| Crypto/Stock market | n/a | `/api/market` | dashboard "Intel Hub" | |

#### B. Schema defined + API scaffolding present, **UI partially or fully missing** (highest-value expansion targets)

| Module | Schema | API | UI status | Gap |
|---|---|---|---|---|
| **M10 Household Settlements** | `household_settlements`, `household_category_caps`, `household_split_rules` | `/api/households/settlements`, `/api/households/caps`, `/api/households/rules`, cron at `/api/cron/household-splits` | `/household` page exists but settlements/caps UI not exposed | Settlement engine + auto-scheduler UI missing |
| **M11 Benchmarks** | `user_demographics`, `benchmark_aggregates`, `category_percentile_snapshots`, `percentile_snapshots` | `/api/benchmarking/percentiles` | `/benchmarks` exists, basic UI present | Cohort radar chart exists (`components/benchmarks/CohortRadarChart.tsx`) but opt-in flow + percentile math is incomplete |
| **M12 Tax** | `tax_categories`, `tax_deductions`, `tax_deduction_items` | `/api/tax/deductions`, `/api/tax/export` | `/tax-center` page exists | UI exists, exporter (`taxExporter.ts`) exists, but tagging flow on transactions is manual-only |
| **M13 Documents** | `document_metadata`, `document_line_items`, `documents`, `document_embeddings` (text-only) | `/api/documents/*` (3 routes), `/api/documents/search`, `/api/documents/export` | `/documents` page exists | Embedding column exists but **no vector similarity search** — `embeddingVector` is stored but never queried semantically |
| **M14 Privacy** | `user_privacy_settings` | not in audit | `<LockScreen />` + `<PrivacyToggle />` exist | **Critical: `app/src/app/(app)/layout.tsx` renders `<LockScreen timeoutMinutes={0} lockOnBackground={false} />`** — i.e. lock is permanently disabled. Privacy settings UI is missing. |
| **M15 Round-ups** | `round_up_settings`, `goal_milestones`, `round_up_rules`, `round_up_transfers` | `/api/round-up/process`, `/api/round-ups/history` | `<RoundUpCard />` exists, `/wealth-goals` shows it | Engine works; goal-milestone hook not auto-triggered when a round-up hits a tier |
| **M16 Bank Import** | `statement_import_batches`, `imported_statements`, `reconciliation_queue`, `bank_import_review_queue` | `/api/bank-import/parse`, `/review`, `/commit` | `/bank-import` page + `<DuplicateReconciliationModal />` exist | Review queue UI is partial — confidence-based bulk merge is incomplete |
| **M17 Bilingual** | n/a (locale data) | n/a | `<LanguageContext />` + `bn.json`/`en.json` + `toBengaliNumerals` exist | **Major gap:** `bn.json` is a 30-line stub — only nav labels are translated. No localized forms, charts, dates, error messages, or empty states. Currency formatter is built but only used in 1–2 places. |
| **M18 Calendar Sync** | `calendar_sync_tokens`, `calendar_sync_events`, `calendar_sync_settings`, `calendar_event_logs` | `/api/calendar/auth/callback`, `/api/calendar/sync` (Google OAuth + `googleapis ^171.4.0`) | `<CalendarSyncCard />` exists | OAuth callback exists but **the route returns no UI**; in-app "Connected" state and per-source-type sync toggles are not exposed in settings |
| **M19 Agentic AI** | `agent_action_logs`, `proactive_insights`, `chat_tool_executions`, `ai_insights_cache` | `/api/chat/confirm` (action confirm) | `<UnifiedInsightsHub />` exists, `<DashboardIntelHub />` exists | Tool-execution confirmation UI is incomplete; `agentTools.ts` defines tools but the chat UI doesn't render "Confirm / Reject" panels yet |

#### C. Hidden gems the README never mentions (worth surfacing in the marketing site)
1. **Automation rules with audit-trail undo** — every rule-fire is logged with previous/new value; user can roll back (`/api/automation-rules/audit`).
2. **Dashboard layout customization** — widgets are user-reorderable with persistent JSON config in `dashboard_layouts`.
3. **Passkeys (WebAuthn)** — full register/login ceremony alongside 2FA TOTP.
4. **OAuth accounts table** — the schema supports Google/GitHub social login even though it's not exposed in the UI yet.
5. **Cash-flow forecast** (`/forecast`) — distinct from the What-If simulator; uses recurring transactions to project.
6. **Generative art** (`/generative-art`, `<FinancialMandala />`, `<DataRiverChart />`, `<GenerativeExporter />`) — visual storytelling layer.
7. **Guest mode** — `user.isGuest` flag in `/api/auth/me`; mobile bottom bar collapses to just Tours + Menu for unauthenticated visitors.

#### D. Landing page → UI promise gap
The `LandingPage.tsx` hero promises **AI Financial Coach** prominently, but the chat route is at `/chat` — the **README still calls it `/coach`**. This 404-on-landing risk needs a redirect. Other navigation labels in the landing CTA buttons must be validated against `NAVIGATION_REGISTRY` to prevent dead clicks.

#### E. Security posture (confirmed in `app/src/middleware.ts`, `api-handler.ts`, `rate-limiter.ts`)
- ✅ Strict CSP, HSTS, X-Frame-Options DENY, Permissions-Policy locking camera/mic/geo
- ✅ All API routes flow through `apiHandler()` → Zod validate → `requireAuth` → rate limit
- ✅ Source maps disabled, `X-Powered-By` removed
- ✅ AES-256-GCM for PII at rest
- ✅ Account lockout (5 failed → 15 min)
- ✅ Refresh-token rotation with one-time-use hash invalidation
- ✅ DOMPurify on user-supplied strings
- ⚠️ Privacy Mode redaction is server-side, but only covers `/api/dashboard`, `/api/networth`, `/api/accounts`, `/api/households/expenses` — needs to extend to `/api/budgets`, `/api/transactions` for completeness

---

## Section 2 — Global Mobile-Desktop Parity Framework

This section codifies the contract between `app/src/components/Sidebar.tsx`, `MobileTabBar.tsx`, and `MobileMenu.tsx` so that every Module 10–19 deliverable obeys the same rules.

### 2.1 Single Source of Truth — The `NAVIGATION_REGISTRY`

`app/src/lib/navigation/registry.ts` is **the** contract. Every new feature must:
1. Add exactly **one** `NavItem` to `NAVIGATION_REGISTRY`.
2. Set `category: 'core' | 'analytics' | 'tools' | 'smart' | 'system'`.
3. Optionally set `mobileTab: true` to be exposed in the bottom bar (max 5 slots; the current slots are Dashboard / Overview / Add / AI Chat / Menu — see "Mobile tab slot scarcity" below).
4. Optionally set `guestAllowed: true` if the page renders meaningfully for unauthenticated visitors (the `MobileTabBar` collapses to Tours + Menu for guests).

**Mobile tab slot scarcity.** Today only 3 slots are filled by `mobileTab: true` (Dashboard, Chat, Overview). Add, Menu, Home are special. There is **no spare slot** for new modules — new feature surfacing on mobile must come through the **Menu drawer** (`MobileMenu.tsx`) or via the **QuickAdd** center button. Section 3 plans accordingly.

### 2.2 Routing Parity Rules

| Rule | Desktop (≥1024px / `lg:`) | Mobile (<1024px) |
|---|---|---|
| Primary nav | Fixed left sidebar (256 px wide, `lg:ml-64` on `<main>`) | Floating glass bottom bar at `bottom: max(0.75rem, env(safe-area-inset-bottom))` + full-screen drawer from the "Menu" tab |
| Page transitions | Framer Motion `PageTransition` wrapper | Identical wrapper, identical motion (respect `prefers-reduced-motion`) |
| Active state | Sidebar item gets primary-color left border + `bg-primary-light` | Bottom bar icon fills + label weight; drawer item gets full-width pill background |
| Hidden nav from bottom bar | Use `mobileTab: false` | Use `MobileMenu` drawer grouping (matches `NAV_GROUPS` exactly) |
| Quick add | Sidebar has inline "Quick Add" button | Bottom bar center `+` button → `<QuickAddModal />` |
| Notifications | Sidebar bell with badge | Bell inside `<MobileMenu />` drawer header (badge: amber) |
| Theme toggle | Sidebar footer | Drawer footer |
| Privacy toggle | Sidebar header | Drawer header |
| Currency selector | Global top-right `<CurrencySelector />` | Identical global position |
| Command palette (⌘K) | `Cmd+K` or `/` | Identical (mobile keyboards expose ⌘) |

### 2.3 Modal Transformation Rules

Every desktop modal **must** have a mobile bottom-sheet variant. The platform already ships `<BottomSheetModal />` (`app/src/components/BottomSheetModal.tsx`); new modals must use it via the `useBottomSheet()` hook contract:

| Desktop modal behavior | Mobile bottom-sheet behavior |
|---|---|
| Centered overlay, max-width 480–640 px | Full-width sheet at bottom, `max-height: 92vh`, drag handle at top |
| Click outside to close | Drag handle down OR tap backdrop to close |
| 32 px top/bottom padding | 16 px horizontal, 20 px top, `env(safe-area-inset-bottom)` bottom |
| Close button top-right | Drag handle replaces close button; swiping 30%+ downward closes |
| Forms scroll inside modal | Forms use a sticky footer with primary action button above the safe-area |
| Animations: fade-in + 4 px rise, 200 ms | Identical timing, identical easing (Material standard `cubic-bezier(0.32, 0.72, 0, 1)`) |
| Trap focus on open | Identical + restore focus on close |

### 2.4 Hard UI Constraints (Enforced for All Modules)

| Constraint | Spec | Where it's enforced |
|---|---|---|
| Touch targets | Min **44 × 44 px** (`min-h-[44px] min-w-[44px]`) | Tailwind utility class on every interactive `<button>`, `<a>`, `<input>`, `<select>`, custom checkbox, switch |
| Input font size | **≥ 16 px** on mobile to prevent iOS auto-zoom | `input, select, textarea { font-size: 16px }` in `globals.css` (already set) |
| Safe-area insets | Use `env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, `env(safe-area-inset-left/right)` on all sticky elements | Already applied in `app/src/app/(app)/layout.tsx` (`pt-[env(safe-area-inset-top)] mb-[env(safe-area-inset-bottom)]`); every new bottom-anchored FAB, sheet, toast must respect it |
| Bottom bar clearance | `main` has `pb-28 lg:pb-0`; no content can sit under the bottom bar | `<MobileTabBar />` fixed at bottom — new pages cannot render fixed action buttons in the bottom 100 px without `bottom: calc(env(safe-area-inset-bottom) + 88px)` |
| Color tokens | Only `var(--color-*)` — never hard-coded hex | ESLint rule (add to `eslint.config.mjs`): `no-restricted-syntax` for hex literals outside `globals.css` |
| Dark mode | Every component reads theme via `useTheme()` / `isDark` state; never hard-codes `bg-white` or `text-black` | Lint rule + visual regression on each PR via Playwright |
| Reduced motion | Wrap every `motion.*` with `useReducedMotion()` and short-circuit to opacity-only transitions when true | Add `lib/motion.ts` helper `const motionProps = (reduce) => reduce ? { initial: { opacity: 0 }, animate: { opacity: 1 } } : variants;` and use throughout |
| Tap highlight | `-webkit-tap-highlight-color: transparent` (already set globally) | OK |
| Focus rings | Visible on `:focus-visible` for keyboard nav (already in `globals.css` via Tailwind defaults) | OK |
| Charts | 320 px height desktop / 220 px mobile (per README §Mobile) | New charts: use `ResponsiveContainer` from Recharts or Chart.js `maintainAspectRatio: false` with `aspect-ratio` set per breakpoint |
| Tables | Multi-column at `md:` breakpoint, horizontally scrollable below with sticky first column | New tables must implement this contract |

### 2.5 The Parity Test Plan (must pass for every Module 10–19 ship)

Each module ships with a **Parity Checklist** in its Definition of Done. The test is run by Playwright on three viewports:

| Viewport | Width | Class |
|---|---|---|
| iPhone SE | 375 × 667 | mobile |
| iPad Mini | 768 × 1024 | tablet |
| Desktop | 1280 × 800 | desktop |

For each viewport, the Playwright spec asserts:
1. Every navigation entry registered in `NAVIGATION_REGISTRY` for the feature is reachable.
2. Every interactive element is ≥ 44 × 44 px.
3. No horizontal scroll on the `<main>`.
4. All `var(--color-*)` tokens resolve to non-`undefined` values in both themes.
5. All forms accept input without iOS auto-zoom (input `font-size >= 16px`).
6. All bottom-anchored elements respect the safe-area inset.
7. The reduced-motion media query collapses transitions to ≤ 100 ms.

---

## Section 3 — The 10 Premium Feature Modules

> **Numbering convention preserved:** every new table is named `module_NN_*` consistent with the existing `module 10: household settlements & category caps`, `module 11: anonymous peer benchmarks`, etc. headers in `app/src/db/schema/index.ts`. New tables for these features pick up at **Module 20** (this is a follow-up batch, not a replacement of existing work).

---

### Module 10 — Advanced Multi-Member Household Budgeting & Automated Split Settlements

**Pitch.** Elevate the current `/household` page (which only supports ad-hoc shared expenses) into a first-class **family finance workspace** where multiple members share a unified budget, recurring bills auto-split on a schedule, and a debt-minimization engine (already shipped as `lib/algorithms/minSettlement.ts`) produces the fewest possible payments to settle the household.

**Audit Reference.**
- ✅ Already built: `households`, `household_members`, `household_expenses`, `household_ledgers`, `household_splits` (`app/src/db/schema/household-splits.ts`).
- ✅ Already built: `household_settlements`, `household_category_caps`, `household_split_rules` (declared inline in `app/src/db/schema/index.ts`).
- ✅ Already built: `lib/algorithms/minSettlement.ts` (greedy cash-flow minimization).
- ✅ Already built: `/api/households/*` route tree, plus the `cron/household-splits` route for scheduled execution.
- ⚠️ Missing: UI to view/decline proposed settlements; the percentage vs. fixed split editor; the auto-execution preview; the household-level "monthly budget view" aggregating per-member spending; the dashboard widget.

#### Feature 10.1 — Household Budget Caps & Per-Category Allocation Wheel

**UX logic.** From `/household/[id]`, an "Allocations" tab exposes a **circular budget allocation wheel** (one ring per category, ring length = % of monthly cap). Drag a category's arc end to resize. Below the wheel, a stacked bar shows each member's **contribution to that category this month** with running totals. Tapping a segment opens a **bottom sheet** with the underlying transactions and a "Rebalance" action that re-distributes remaining cap using the largest-remainder method.

**Data requirements.**
- Reuses `household_category_caps` (already in schema).
- New table `module_20_household_budget_cycles` (id, household_id, year_month, total_cap, status, created_at) for monthly cap snapshot.
- New table `module_20_household_cap_allocations` (id, cycle_id, category, cap_amount, contributed_by_user_id) for member-level contributions.
- New column on `household_category_caps`: `rollover_policy` enum (`'none' | 'next_month' | 'pool'`) defaulting to `'none'`.

**State flow.**
1. Owner opens the "Allocations" tab → SWR fetches `/api/household/[id]/allocations?yearMonth=YYYY-MM`.
2. Drag handlers dispatch optimistic updates via `mutate()` on SWR cache; the API persists to `household_category_caps` + `household_budget_cycles` atomically.
3. Each member's transactions since the cycle start are summed server-side and joined to `cap_allocations` to compute the per-member contribution.
4. On every cap change, the server re-emits an SSE event on the household's sync channel (`/api/bill-splits/tours/[id]/sync` extended to households) so all open tabs re-render the wheel in <500 ms.

**Mobile design behavior.**
- On mobile, the wheel collapses to a **vertical stacked bar** with drag handles; the same tap-to-open bottom sheet pattern.
- Touch target for the arc-drag handle is a 56 × 56 px grabber to stay well above the 44 px minimum.
- Pull-to-refresh triggers the cycle re-computation.

#### Feature 10.2 — Recurring Auto-Split Bills + Settlement Workflow

**UX logic.** A **"Bills"** sub-tab lists all `household_split_rules` with frequency, total amount, and a per-member share preview. A "+ New bill" FAB opens a sheet with: name, amount, category, frequency, day-of-month, and a 3-tab split editor (Equal / Percentage / Fixed) that live-previews each member's share. Once saved, a card surfaces on the household dashboard **the day before execution** with a "Confirm & send" CTA; a "Skip this cycle" secondary action. After execution, a **"Settlements"** sub-tab lists open balances (computed by `minSettlement.ts`) and presents the minimal-payment plan as a one-tap "Settle all" action that produces an `upcoming_settlement` row per payment + a push notification to the payee.

**Data requirements.**
- Reuses `household_split_rules`, `household_settlements` (both already in schema).
- New table `module_20_upcoming_settlements` (id, household_id, from_user_id, to_user_id, amount, due_date, status enum `pending|confirmed|paid|cancelled`, created_at).
- New column on `household_settlements`: `source_rule_id` (FK to `household_split_rules.id`, nullable).
- New column on `households`: `default_split_mode` enum (`equal|pro_rata|custom`) defaulting to `equal`.

**State flow.**
1. The existing cron at `/api/cron/household-splits` (already wired) iterates due rules each morning at 07:00 user-local; new logic creates the `household_expenses` row + the N `household_splits` rows + the `upcoming_settlements` preview row.
2. The receiving member gets a Web-Push notification (using the existing `push_subscriptions` infrastructure + `web-push` SDK) **and** an in-app toast when they're online.
3. Confirmation flow: payee taps "Mark paid" → server validates against the household balance → moves `upcoming_settlement.status` to `paid` → recomputes the settlement plan via `minSettlement.ts`.
4. The household dashboard widget subscribes to `/api/household/[id]/sync` SSE and re-renders within 1 s of any settlement change.

**Mobile design behavior.**
- "+ New bill" FAB is the standard bottom-right floating action (already used in `<FloatingActionButton />`).
- The "Settlements" list is a single-column scrollable card stack; each card has a 1-tap "Mark paid" button (the 44 × 44 px touch target with a 24 px icon).
- A swipe-left on a pending settlement row reveals "Remind again" / "Cancel".

**Definition of Done.**
- ✅ Migrations: 3 new tables (`module_20_household_budget_cycles`, `module_20_household_cap_allocations`, `module_20_upcoming_settlements`) + 2 new columns.
- ✅ New API routes: `/api/household/[id]/allocations` (GET/PUT), `/api/household/[id]/bills` (GET/POST/DELETE), `/api/household/[id]/settlements/preview` (POST, returns `minSettlement` output), `/api/household/[id]/settlements/[sid]/confirm` (POST).
- ✅ UI: 3 new tabs in `app/src/app/(app)/household/[id]/page.tsx` (Allocations, Bills, Settlements).
- ✅ Cron: extend `/api/cron/household-splits/route.ts` to create `upcoming_settlements` rows.
- ✅ Push: integrate the existing `push_subscriptions` + `web-push` to notify on settlement creation.
- ✅ Unit tests: extend `__tests__/unit/household-settlement.test.ts` with cap-rollover + min-settlement edge cases.
- ✅ Parity: Playwright spec at 375 / 768 / 1280 confirms wheel/stacked-bar parity + 44 px targets.
- ✅ Security: every new route uses `apiHandler({ rateLimit: 'api' })` + `requireAuth()`; household membership checked before any read/write.

---

### Module 11 — Anonymous Peer Benchmarking & Demographic Health Percentiles

**Pitch.** Add an **opt-in privacy-preserving** benchmarking layer that lets a user see how their savings rate, emergency-fund coverage, and category spend compare against anonymous peers matched on **age × region × income bracket** — without ever revealing their identity or raw numbers. The cohort radar chart (`components/benchmarks/CohortRadarChart.tsx`) already exists in the codebase; this module wires it to live, privacy-safe data.

**Audit Reference.**
- ✅ Already built: `user_demographics`, `benchmark_aggregates` (`app/src/db/schema/benchmarks.ts`).
- ✅ Already built: `category_percentile_snapshots`, `percentile_snapshots` (in `app/src/db/schema/index.ts`).
- ✅ Already built: `/api/benchmarking/percentiles` and `/benchmarks` page with `CohortRadarChart`.
- ⚠️ Missing: the opt-in flow with granular consent; the nightly aggregation cron; the cohort-membership re-bucketing; the privacy guarantee (k-anonymity threshold of N≥30 before a percentile is exposed); the per-category drill-down; the "share my percentile anonymously" toggle.

#### Feature 11.1 — Demographic Opt-In Wizard & Granular Consent

**UX logic.** On first visit to `/benchmarks`, a **multi-step wizard** (1: Welcome, 2: Demographics, 3: Granular consent, 4: Confirmation) collects age bracket, region, income bracket, and lets the user toggle which **metrics** they want compared. Each consent row explains in plain language what is shared (e.g. "We share that your monthly savings rate is 22% — never your income or transactions"). A persistent "Withdraw from benchmarks" button lives in `/settings/privacy` and revokes all sharing immediately.

**Data requirements.**
- Reuses `user_demographics` (adds `is_opted_in` field — already there) and `benchmark_aggregates`.
- New table `module_21_user_benchmark_consents` (id, user_id, metric_key, granted_at, revoked_at) — supports per-metric revocation without re-running the wizard.
- New column on `user_demographics`: `employment_sector` (already declared but unused).

**State flow.**
1. User completes the wizard → server writes one row to `user_demographics` and one row per granted metric to `module_21_user_benchmark_consents`.
2. Server kicks off the per-user percentile computation at `/api/benchmarking/percentiles` which already exists; new logic enforces **k-anonymity**: a percentile is only returned if the cohort has ≥ 30 active members.
3. Withdrawing from a metric flips `revoked_at` on the consent row; the next nightly cron drops the user from that metric's `benchmark_aggregates` recalculation.

**Mobile design behavior.**
- Wizard is a `BottomSheetModal` stepper (drag handle disabled until step 4).
- Consent toggles use 56 × 32 px switches (above the 44 px target when including padding).
- A persistent "Re-take wizard" entry in `/settings/privacy` opens the wizard in "edit" mode.

#### Feature 11.2 — Category-Level Percentile Drill-Down & Anonymous Insights

**UX logic.** On `/benchmarks`, a **category table** lists every spending category the user touched this month, shows their amount, the cohort's p50/p90, and a colored bar of where they sit. Tapping a row opens a bottom sheet with: a horizontal percentile bar (0 → 100), the cohort's distribution (histogram, 6 bins), the user's rank among cohort peers, and an "Anonymous share card" — a pre-formatted, image-exportable card the user can post to social media showing "I save more than 78% of peers in my cohort" (never raw numbers).

**Data requirements.**
- Reuses `category_percentile_snapshots` (already in schema).
- New table `module_21_anonymous_share_cards` (id, user_id, snapshot_id, claim_text, image_url, created_at) for the share-card feature.
- New column on `category_percentile_snapshots`: `cohort_size` (denormalized count for k-anonymity UI).

**State flow.**
1. SWR fetches `/api/benchmarking/percentiles?yearMonth=YYYY-MM` (already exists, returns 403 if k<30).
2. Tap a row → opens `BottomSheetModal` with locally-computed percentile bar + histogram (rendered client-side from the same payload).
3. "Generate share card" → server builds a 1200 × 630 px PNG via `html2canvas` (already used in `/snapshot` flow) → stores URL in `module_21_anonymous_share_cards` → returns the image for download + native share sheet.

**Mobile design behavior.**
- Category table is a vertically-scrolling card list on mobile (each card = one category, includes the horizontal percentile bar inline).
- The share card preview in the bottom sheet shows a 320 × 168 px thumbnail; tap expands to full-screen.
- A **"Compare with last month"** pill at the top of the table triggers a comparison view (delta badges).

**Definition of Done.**
- ✅ Migrations: 2 new tables (`module_21_user_benchmark_consents`, `module_21_anonymous_share_cards`) + 1 new column.
- ✅ New API routes: `/api/benchmarking/consent` (POST/DELETE), `/api/benchmarking/share-card` (POST, generates PNG).
- ✅ New cron: `/api/cron/benchmark-aggregate` (nightly, recalculates `benchmark_aggregates` from consented users only, enforces k≥30).
- ✅ UI: 4-step wizard at `/benchmarks/onboarding`; category drill-down on `/benchmarks`.
- ✅ Tests: `__tests__/unit/benchmarks.test.ts` — k-anonymity edge cases (k=29 returns 403; k=30 returns percentile).
- ✅ Security: cohorts are server-aggregated; user-level data never leaves the server in identifiable form; the share-card endpoint never returns raw numbers, only pre-rendered claims.

---

### Module 12 — Tax Tagging, Deductible Tracking & Export-Ready Fiscal Reporting

**Pitch.** Turn the existing `/tax-center` page (which has the schema and the exporter but no tagging UX) into a one-click **"Tag this as deductible"** flow on every transaction, an annual PDF/Excel fiscal report that accountants can drop straight into TurboTax / Xero, and a year-end summary that auto-detects missing documentation.

**Audit Reference.**
- ✅ Already built: `tax_categories`, `tax_deductions`, `tax_deduction_items` (`app/src/db/schema/tax-vault.ts`).
- ✅ Already built: `lib/export/taxExporter.ts` (PDF generation).
- ✅ Already built: `/api/tax/deductions`, `/api/tax/export`, `/tax-center` page.
- ⚠️ Missing: inline tagging UI on the transaction row; receipt-to-deduction auto-link; jurisdiction selector; missing-receipt detection; the Excel export; the accountant-shareable view-only link.

#### Feature 12.1 — Inline Tax Tagging + Receipt Auto-Linking

**UX logic.** Every transaction row in `/transactions` and the Day-Detail popup gets a **"Tag" pill** (a small `local_offer` icon, amber when tagged, gray when not). Tapping opens a bottom sheet listing applicable `tax_categories` filtered by the transaction's category (e.g. a "Software" expense suggests `SCH_C_OFFICE`, `SOFTWARE_100`). Selecting a category marks the transaction; if a document (receipt) is attached, the deduction row is auto-linked via the existing `documentMetadata` + `transactions` join. A **"Bulk-tag from last month"** CTA on `/tax-center` surfaces every un-tagged transaction that matches a learned pattern (e.g. all "AWS" → `SOFTWARE_100`).

**Data requirements.**
- Reuses `tax_deductions` (already has `transactionId UNIQUE` constraint).
- New column on `tax_deductions`: `jurisdiction` (default `US_IRS`) — already in `tax_categories` table.
- New table `module_22_tax_tag_suggestions` (id, user_id, transaction_pattern, suggested_category_id, hit_count, last_used_at) for the learn-from-history feature.

**State flow.**
1. Tap "Tag" → `BottomSheetModal` opens → SWR fetches `/api/tax/categories?txnCategory=…` (new route, returns filtered categories).
2. User selects category → POST `/api/tax/deductions` with `transactionId` + `taxCategoryId` → server computes `deductible_amount = amount * deductible_percentage` from the selected `tax_categories` row.
3. If a `document_metadata` row has `linked_transaction_id = transactionId`, the deduction row's `receipt_document_id` is auto-set.
4. Bulk-tag: server scans the user's transactions, matches against `tax_tag_suggestions` by `description` regex, returns a preview list; user confirms → server bulk-inserts.

**Mobile design behavior.**
- The "Tag" pill sits at the right edge of the transaction row (replaces the existing kebab menu on mobile).
- Bottom sheet's category list is filtered and alphabetically sorted; a search field appears above the list when the user starts typing.
- Bulk-tag preview is a 2-pane sheet: top half is the matched list, bottom half is sticky "Apply N tags" primary action.

#### Feature 12.2 — Annual Fiscal Report Export (PDF + Excel) + Shareable View-Only Link

**UX logic.** From `/tax-center`, a **"Generate Annual Report"** CTA opens a sheet with: jurisdiction (default `US_IRS`), year, currency, optional "Include itemized line notes" toggle, and two big primary buttons: **Download PDF** and **Download Excel**. PDF is generated via `jspdf` + `jspdf-autotable` (already installed) and includes: cover page, deductions summary, category breakdown chart, itemized transaction table, missing-receipt callout. Excel is generated via `exceljs` (already installed) and contains multiple sheets: `Summary`, `ByCategory`, `ItemizedTransactions`, `MissingReceipts`. A third button **"Share with accountant"** generates a 30-day view-only token URL (e.g. `/tax/view/[token]`) that renders the same PDF inline but without any edit controls; token revocation is a one-tap button on the report card.

**Data requirements.**
- Reuses `tax_deductions` + `taxExporter.ts`.
- New table `module_22_fiscal_report_shares` (id, user_id, tax_year, token, expires_at, view_count, last_viewed_at, revoked_at) for the view-only share.
- New table `module_22_missing_receipts_log` (id, user_id, deduction_id, flagged_at, reason) auto-populated by a daily cron that scans for deductions where `receipt_document_id IS NULL` and the amount > $75 (configurable).

**State flow.**
1. User taps "Download PDF" → POST `/api/tax/export` with year + jurisdiction + flags (route already exists; this extends it).
2. Server reads `tax_deductions` joined to `tax_categories` and `transactions`, generates the PDF in-memory, returns as `application/pdf` stream.
3. User taps "Share with accountant" → POST `/api/tax/share` → server creates a `fiscal_report_shares` row with a `crypto.randomUUID()` token and 30-day expiry → returns the public URL.
4. Anyone with the URL hits `/tax/view/[token]` → server validates the token + expiry + revocation → renders a stripped-down version of the report (no balances, no other transactions, no settings).

**Mobile design behavior.**
- The "Generate Annual Report" sheet is a single-column form on mobile; jurisdiction and year are presented as segmented controls.
- The generated PDF is opened in a new tab (mobile browsers handle PDF natively) and the share URL is copied to clipboard with a toast confirmation.
- The "Active shares" list (a card list on `/tax-center` under the report) shows expiry, view count, and a "Revoke" button.

**Definition of Done.**
- ✅ Migrations: 3 new tables (`module_22_tax_tag_suggestions`, `module_22_fiscal_report_shares`, `module_22_missing_receipts_log`).
- ✅ New API routes: `/api/tax/categories` (GET, filtered by txn category), `/api/tax/bulk-tag` (POST), `/api/tax/share` (POST), `/api/tax/view/[token]` (GET, public, no auth).
- ✅ Extended routes: `/api/tax/export` gains `format` param (`pdf|xlsx`).
- ✅ UI: inline "Tag" pill in `TransactionRowActions.tsx`; bulk-tag sheet; report-generator sheet; active-shares list.
- ✅ Tests: `__tests__/unit/tax.test.ts` — jurisdiction filtering, missing-receipt detection, share-token validation.
- ✅ Security: public share endpoint rate-limited at 30 req/min/IP; tokens are UUID v4 + constant-time compared; response strips any data outside the requested year.

---

### Module 13 — AI Document Vault with Semantic Search

**Pitch.** The codebase already has a `documents` table with an `embedding` text column — but the column is unused. This module makes the **search actually semantic** (cosine similarity over OpenAI `text-embedding-3-small` vectors), layers it on top of the existing OCR pipeline, and surfaces it via a `/documents` UI that lets users **ask natural-language questions** of their receipts, bills, and statements ("What was my total dining spend in Sylhet last March?").

**Audit Reference.**
- ✅ Already built: `document_metadata`, `document_line_items` (`app/src/db/schema/document-vault.ts`).
- ✅ Already built: `documents` + `document_embeddings` (in `app/src/db/schema/index.ts`).
- ✅ Already built: `lib/ai/ocrPipeline.ts` (Gemini-powered OCR).
- ✅ Already built: `/api/documents/*` (3 routes), `/api/documents/search`, `/api/documents/export`.
- ⚠️ Missing: the actual vector embedding generation on upload; cosine similarity SQL query; the natural-language Q&A box; the chunking strategy; the line-item-level embedding; the search-results UI.

#### Feature 13.1 — Embedding Pipeline + Chunked Document Storage

**UX logic.** On every document upload (existing flow: receipt scanner, file-drop, or transaction attachment), the server runs a **three-step pipeline**: (1) OCR via `ocrPipeline.ts` (already built), (2) **chunking** (semantic chunking — splits on paragraph + table boundaries, max 800 tokens/chunk), (3) **embedding** via OpenAI `text-embedding-3-small` (1536-dim) stored in `document_embeddings.embedding_vector` as a JSON-encoded `Float32Array`. The `/documents` page shows a live status badge per file: `PENDING` → `EMBEDDING` → `READY` (or `FAILED` with retry).

**Data requirements.**
- Reuses `document_embeddings` (already exists, but the `embedding_vector` field is `text` — we'll store as JSON-encoded array).
- New table `module_23_document_chunks` (id, document_id, chunk_index, chunk_text, token_count, created_at) — materializes the chunks for explainability.
- New column on `document_metadata`: `embedding_status` enum (`'PENDING' | 'EMBEDDING' | 'READY' | 'FAILED'`) defaulting to `'PENDING'`.
- New column on `document_metadata`: `embedding_completed_at` (nullable timestamp).

**State flow.**
1. Upload triggers existing `/api/documents` route → row inserted with `embedding_status = 'PENDING'`.
2. Server-side background worker (reuses the existing Vercel background functions pattern) picks up pending rows, runs the pipeline, updates the row.
3. On `READY`, a record is written per chunk to `module_23_document_chunks` and a row per embedding to `document_embeddings`.
4. Client polls `/api/documents?status=READY` (already exists); the badge updates.

**Mobile design behavior.**
- Status badge is a 20 × 20 px pill with an animated dot for `EMBEDDING` state.
- Tap-to-retry on `FAILED` rows is a 44 × 44 px icon button.
- The documents list uses the existing virtualized list pattern for >500 items.

#### Feature 13.2 — Natural-Language Q&A Search

**UX logic.** A **prominent search bar** at the top of `/documents` (sticky on scroll). Typing 3+ characters triggers debounced (300 ms) semantic search: the query is embedded client-side (we'll add a browser-side MiniLM model as a progressive enhancement; fallback is server-embedded) and the top 10 most similar chunks are returned. Results are grouped by document, each with: file name, date, total amount, highlighted matching chunk text, and a **"Show me the lines"** inline accordion. A **"Ask AI"** button at the top of the search bar opens a chat-style Q&A mode where the user types a question (e.g. "What was my highest dining receipt in June?") and the AI Coach (`/api/coach/insights` — already exists) answers using only the matched chunks as context (RAG pattern).

**Data requirements.**
- Reuses `document_embeddings` + `module_23_document_chunks`.
- New table `module_23_search_query_log` (id, user_id, query_text, query_embedding, top_chunk_ids, result_count, created_at) — for analytics + caching.
- New column on `search_query_log`: `cache_hit` boolean — if a query string matches a prior query (string equality on normalized text), reuse the prior result set to skip re-embedding.

**State flow.**
1. User types in search → SWR debounces → POST `/api/documents/search` with the query.
2. Server embeds the query via OpenAI (or a cached row from `search_query_log`) → computes cosine similarity against all `document_embeddings` rows for the user → returns the top 10 chunks grouped by `document_id`.
3. User taps "Ask AI" → POST `/api/coach/insights` with the chunks as context → response streams back via the existing `ReadableStream` pattern.

**Mobile design behavior.**
- The search bar is a fixed 56 px input at the top of `/documents`; on scroll it stays sticky.
- Results render as full-width cards on mobile, each card collapsing the "Show me the lines" accordion by default to save vertical space.
- The Q&A chat is a full-screen bottom sheet with the standard `BottomSheetModal` pattern.

**Definition of Done.**
- ✅ Migrations: 1 new table (`module_23_document_chunks`) + 1 query-log table (`module_23_search_query_log`) + 2 new columns on `document_metadata`.
- ✅ New API routes: `/api/documents/embed` (POST, background-triggers the pipeline), `/api/documents/search` (POST, semantic — replaces the existing keyword one), `/api/documents/ask` (POST, RAG Q&A).
- ✅ UI: status badges on document list; semantic search bar; Q&A sheet.
- ✅ Tests: `__tests__/unit/document-search.test.ts` — cosine similarity math, chunking boundaries, cache-hit logic.
- ✅ Security: every search is scoped to the authenticated user; embeddings never leak across users; Q&A context is sanitized to prevent prompt injection from OCR text (DOMPurify is already wired in `lib/crypto/encryption.ts`'s broader stack).

---

### Module 14 — Global Privacy Mode (Balance Masking) & Biometric/Passkey Quick-Lock

**Pitch.** Wire up the existing-but-disabled `<LockScreen />` and the existing `<PrivacyContext />` into a **production-grade privacy layer**: configurable auto-lock timeout (with biometric/passkey unlock), per-scope masking (all / balances only / transactions only), shake-to-hide on mobile, and account-number masking on screenshots.

**Audit Reference.**
- ✅ Already built: `user_privacy_settings` (`app/src/db/schema/privacy-settings.ts`).
- ✅ Already built: `<PrivacyContext />` with `maskScope: 'all' | 'balances_only' | 'transactions_only'`.
- ✅ Already built: `<PrivacyToggle />`, `<LockScreen />`, server-side redaction in `api-handler.ts`.
- ⚠️ Missing: the settings UI; the auto-lock timeout actually enabled in the layout; the passkey/biometric unlock integration; the shake-to-hide; the account-number masking; the keyboard shortcut `⌘⇧P` documentation.

#### Feature 14.1 — Privacy Settings Center + Auto-Lock with Biometric Unlock

**UX logic.** A new `/settings/privacy` page (linked from the existing settings index) renders three sections: (1) **Masking** — three radio cards for `All / Balances only / Transactions only` with a live preview; (2) **Auto-Lock** — segmented control for `Never / 1 min / 5 min / 15 min / On background`, plus a "Use biometric / passkey to unlock" toggle (defaulting on for users with a registered passkey); (3) **Account-number masking** — toggle to mask the middle 6 digits of any account number in screenshots and exports. A **"Test lock now"** button at the bottom of the page immediately locks the app — to unlock, the user must re-authenticate (password, or passkey if enabled).

**Data requirements.**
- Reuses `user_privacy_settings` (already in schema; columns: `auto_lock_timeout_minutes`, `shake_to_hide_enabled`, `mask_account_numbers`).
- No new tables. Pure feature work.

**State flow.**
1. On settings save, PUT `/api/settings/privacy` updates `user_privacy_settings` row.
2. The `(app)/layout.tsx` reads the current user's settings via SWR and passes them to `<LockScreen timeoutMinutes={settings.autoLockTimeoutMinutes} lockOnBackground={settings.lockOnBackground} />` — currently it passes `0` and `false` (always disabled), so the first ship must fix this single binding.
3. On lock screen: if user has a registered passkey (`user_passkeys` count > 0) and the biometric toggle is on, the lock screen shows a "Use passkey" button that triggers the existing `/api/auth/passkeys/login/options` → `/verify` flow. Otherwise it falls back to password re-entry.
4. The global `KeyboardEvent` listener for `Cmd/Ctrl+Shift+P` is added in `PrivacyProvider` (already partly implemented) — verified in this module.

**Mobile design behavior.**
- The settings page renders as a single-column stack on mobile; each section is an accordion with 44 × 44 px tap targets.
- The lock screen on mobile uses a 1-tap "Use Face ID / Touch ID" button if `window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()` returns true; otherwise password.
- Shake-to-hide (uses the `DeviceMotion` API) toggles privacy mode for 3 seconds, then re-enables.

#### Feature 14.2 — Account-Number Masking + Export Sanitization

**UX logic.** When the user takes a screenshot of any page, or generates a PDF/Excel report, the existing `ExportButton.tsx` and the new `Snapshot` flow automatically mask any detected account number (regex: `\b(?:\d[ -]*?){13,16}\b`) to show only the last 4 digits, prefixed with `•••• •••• `. The same masking is applied server-side to the JSON returned from `/api/accounts/[id]` when the `X-Privacy-Mode: 1` header is present. A **"Mask account numbers"** toggle on `/settings/privacy` controls both client and server behavior.

**Data requirements.**
- No new tables. Reuses `user_privacy_settings.mask_account_numbers` and extends `lib/validators/` with a `maskAccountNumber()` util.
- New column on `accounts`: `display_masked` boolean (default `true`) — server-side hint for whether the response should pre-mask.

**State flow.**
1. Server-side: in `api-handler.ts`, the existing redaction block is extended to walk any `accountNumber` / `cardNumber` field in the response and mask the middle digits when `X-Privacy-Mode: 1`.
2. Client-side: `useAccount()` hook returns masked values when `isPrivacyMode && fieldScope === 'balance'`.
3. Export pipeline: `ExportButton.tsx` and `taxExporter.ts` invoke `maskAccountNumber()` on every string before serialization.

**Mobile design behavior.**
- Account numbers on mobile lists show only last-4 by default (no toggle needed on the row).
- The shake-to-hide gesture respects the `shake_to_hide_enabled` column.

**Definition of Done.**
- ✅ Zero new tables.
- ✅ Extended route: `/api/settings/privacy` (GET/PUT).
- ✅ Fixed binding in `app/src/app/(app)/layout.tsx`: `<LockScreen />` reads from the user's settings instead of hard-coded `0` / `false`.
- ✅ UI: `/settings/privacy` page.
- ✅ Tests: `__tests__/unit/privacy.test.ts` — masking util, account-number regex, server redaction.
- ✅ Security: passkey unlock requires the same `jose` JWT issuance; the lock screen is a true full-bleed overlay (z-index > 1000) blocking all pointer events except the unlock form; the keyboard shortcut is no-op when an input is focused (to avoid hijacking form typing).

---

### Module 15 — Micro-Savings Auto-Round-Ups + Goal-Milestone Auto-Trigger

**Pitch.** Promote the working `roundUpEngine.ts` + `roundUpCard` into a **fully automatic pipeline**: every transaction triggers a round-up calculation; the delta is **held in escrow** until the user-configured sweep threshold is met, then transferred to a goal; when a milestone (25/50/75/100%) is crossed, a celebration triggers and the goal is locked behind a new "stretch goal" suggestion.

**Audit Reference.**
- ✅ Already built: `round_up_settings`, `goal_milestones`, `round_up_rules`, `round_up_transfers` (`app/src/db/schema/round-ups.ts` + `index.ts`).
- ✅ Already built: `lib/finance/roundUpEngine.ts` (calculation engine with multiplier cap).
- ✅ Already built: `/api/round-up/process`, `/api/round-ups/history`, `<RoundUpCard />`, `/wealth-goals` page.
- ⚠️ Missing: the auto-trigger on every new transaction; the sweep-threshold transfer flow; the milestone auto-detection; the confetti on milestone; the "stretch goal" suggestion.

#### Feature 15.1 — Real-Time Round-Up Processing on Transaction Create

**UX logic.** The moment a user creates a transaction (anywhere — `/transactions` form, quick-add modal, voice input, receipt scanner), the backend runs `calculateRoundUp(amount, multiplier)` from the existing engine. The result is recorded as a `round_up_transfers` row in `PENDING` state. A **"Pending Round-Ups"** strip on the home dashboard shows the accumulating total with a "Sweep now" CTA. The sweep is gated by `roundUpSettings.minimumSweepThreshold` (default ৳50 / $5); once the pending total crosses the threshold, the sweep auto-fires and the delta is deposited into the target goal — visible immediately on `/wealth-goals` as a tiny progress ring bump.

**Data requirements.**
- Reuses `round_up_rules`, `round_up_transfers`, `round_up_settings` (all already exist).
- New column on `round_up_transfers`: `sweep_window_id` (UUID, nullable) — groups multiple pending transfers swept in a single batch.
- New table `module_25_round_up_sweeps` (id, user_id, rule_id, total_amount, status enum `pending|completed|failed`, swept_at) — one row per sweep batch.

**State flow.**
1. POST `/api/transactions` (existing) — after the transaction row is inserted, the server queries for the user's active `round_up_rules`, computes the delta via `roundUpEngine.ts`, inserts a `round_up_transfers` row with `status = 'PENDING'`.
2. A nightly cron at `/api/cron/round-up-sweep` (new) groups pending transfers by rule, sums them, and if the total ≥ threshold, creates a `module_25_round_up_sweeps` row + deposits to the target goal + marks the transfers as `SWEPT`.
3. The dashboard SWR (`/api/dashboard`) includes the pending total in its payload; the strip updates without polling.

**Mobile design behavior.**
- The "Pending Round-Ups" strip is a horizontal-scrolling pill row above the dashboard stat cards.
- "Sweep now" is a 44 × 44 px button; on tap, it shows a skeleton for 800 ms then the strip transitions to "Swept ৳35 → Vacation goal".

#### Feature 15.2 — Goal Milestone Auto-Detection + Stretch-Goal Suggestion

**UX logic.** When a sweep (or any direct contribution) pushes a goal's `savedAmount / targetAmount` past a milestone threshold (25 / 50 / 75 / 100%), the server: (1) writes a `goal_milestones` row (if not already present), (2) emits a confetti burst via the existing `canvas-confetti` helper, (3) displays a special "Milestone Unlocked" toast (the existing `<AchievementDetailModal />` works), (4) once 100% is hit, surfaces a **"Set a stretch goal"** CTA inside the goal card — a one-tap flow that pre-fills a new goal form with `target = current * 1.5` and a deadline of `today + 6 months`.

**Data requirements.**
- Reuses `goal_milestones` (already in schema).
- New column on `savings_goals`: `streak_after_completion` integer (count of consecutive months the user contributed after hitting 100%).
- New table `module_25_stretch_goal_suggestions` (id, user_id, source_goal_id, suggested_target, suggested_deadline, accepted_at, dismissed_at) — for tracking which suggestions the user acted on.

**State flow.**
1. On any goal-deposit (sweep, direct contribution, or transfer), the server computes the new percentage, checks against milestone thresholds not yet in `goal_milestones`, inserts a new milestone row if crossed.
2. A webhook to the client (via the existing SSE pattern on `/api/notifications/sse`) fires `goal_milestone` with the goal_id + milestone.
3. Client renders confetti + toast + (if 100%) the stretch-goal sheet.
4. If the user accepts the stretch suggestion, the existing `POST /api/goals` creates the new goal with the suggested values, marked with `source_goal_id` for analytics.

**Mobile design behavior.**
- Confetti triggers the **haptics** hook (`useHaptics` — already exists) for a 50 ms vibration on supported devices.
- The stretch-goal sheet is a 3-tap flow: confirm target → confirm deadline → done.

**Definition of Done.**
- ✅ Migrations: 1 new table (`module_25_round_up_sweeps`) + 1 new table (`module_25_stretch_goal_suggestions`) + 2 new columns.
- ✅ New API routes: `/api/cron/round-up-sweep` (POST, nightly), `/api/goals/[id]/milestones` (GET), `/api/goals/stretch-suggestion` (POST).
- ✅ Extended: existing `POST /api/transactions` to call `roundUpEngine.ts` after insert.
- ✅ UI: dashboard "Pending Round-Ups" strip; confetti hook on milestone; stretch-goal sheet.
- ✅ Tests: `__tests__/unit/round-up-engine.test.ts` (already exists) extended with threshold/sweep edge cases.
- ✅ Security: sweep is server-authoritative — client cannot mark a transfer as `SWEPT` directly.

---

### Module 16 — AI-Powered PDF Bank/Card Statement Parser + Duplicate-Reconciliation Queue

**Pitch.** The `bank-import` page and `imported_statements` + `reconciliation_queue` tables already exist. This module makes the **duplicate detection** production-grade with a confidence-scored reconciliation queue, the **batch-commit flow** atomic, and the **multi-page PDF** support real (current implementation assumes a single table per page).

**Audit Reference.**
- ✅ Already built: `imported_statements`, `reconciliation_queue`, `bank_import_review_queue` (`app/src/db/schema/statement-imports.ts` + `index.ts`).
- ✅ Already built: `lib/ai/statementParser.ts` (Gemini-powered).
- ✅ Already built: `/api/bank-import/parse`, `/review`, `/commit`, `<DuplicateReconciliationModal />`, `/bank-import` page.
- ⚠️ Missing: the confidence-scoring rubric; the multi-page PDF chunking; the atomic commit with rollback; the per-row side-by-side comparison view; the auto-merge on high-confidence matches.

#### Feature 16.1 — Multi-Page PDF Parsing + Confidence Scoring

**UX logic.** The `parse` route accepts PDFs up to 25 MB and 200 pages. The server splits the PDF into pages using a lightweight in-process library, calls Gemini per page with **structured output** (JSON schema enforced), then merges and deduplicates cross-page entries. Each parsed row gets a `match_confidence` score (0.0 – 1.0) computed against existing transactions in the user's account: high-confidence matches (≥ 0.92) are auto-flagged as `MATCHED` and pre-selected for "merge"; medium (0.7 – 0.92) require a tap; low (< 0.7) go to a "create new" bucket.

**Data requirements.**
- Reuses `reconciliation_queue` (adds column: `match_confidence` — already declared as `real` in `bank_import_review_queue`).
- New table `module_26_statement_pages` (id, statement_id, page_number, raw_text, parsed_json, parse_status enum `pending|parsed|failed`, created_at) for the per-page pipeline.
- New column on `imported_statements`: `page_count` integer, `multi_page_strategy` enum (`split-then-merge|single-page`).

**State flow.**
1. POST `/api/bank-import/parse` accepts a file + `accountId` → server creates an `imported_statements` row with `reconciliation_status = 'PROCESSING'`.
2. The background worker splits the PDF, parses each page, writes rows to `module_26_statement_pages`.
3. Once all pages are parsed, the server cross-references the merged dataset against existing `transactions` for that account, scoring each row by date-distance + amount-equality + description-similarity (Jaccard on tokens).
4. The `reconciliation_queue` rows are populated with `match_confidence` and the corresponding `matched_existing_transaction_id` if found.
5. The client polls `/api/bank-import/status/[id]` every 2 s (or via SSE) and transitions to the review screen.

**Mobile design behavior.**
- The progress screen is a single full-screen view with a percentage indicator and a "X of N pages parsed" label.
- On 3G/slow networks, the screen explains that parsing happens server-side and the user can close it.

#### Feature 16.2 — Side-by-Side Review + Atomic Commit

**UX logic.** The review screen is a vertically-scrolling list of `reconciliation_queue` rows. Each row has three states pre-selected: **Merge** (existing tx matches with high confidence), **Create New** (low confidence), or **Skip** (duplicate). Tapping a row opens a **side-by-side sheet**: left = the parsed bank entry, right = the matched existing transaction, with the diff highlighted. The user can override the action per row. A sticky bottom bar shows the running count ("Merge 12, Create 3, Skip 1") and a **"Commit 15 changes"** primary button. The commit is **atomic** — either all 15 changes succeed, or none do (server wraps them in a single Drizzle transaction). On success, `reconciliation_status` flips to `COMMITTED` and a success toast appears.

**Data requirements.**
- Reuses `reconciliation_queue` (adds column: `resolution` enum — already there).
- New column on `imported_statements`: `commit_batch_id` (UUID, nullable) — groups the per-row updates in a commit.
- New table `module_26_commit_log` (id, batch_id, user_id, statement_id, rows_committed, started_at, finished_at, status enum `in_progress|committed|rolled_back`).

**State flow.**
1. User taps "Commit" → POST `/api/bank-import/commit` with the full queue-state payload.
2. Server opens a Drizzle transaction: for each row, perform the action (merge → update `transactions`; create → insert; skip → mark `reconciliation_queue.resolution = 'discarded'`).
3. On any error, the transaction rolls back, `commit_log.status = 'rolled_back'`, and the user sees a "Commit failed — please retry" toast with the row that caused the failure.
4. On success, `imported_statements.reconciliation_status = 'COMMITTED'`, `commit_log.status = 'committed'`, and the dashboard's net worth / account balance refreshes via the existing SWR invalidation pattern.

**Mobile design behavior.**
- The side-by-side sheet on mobile stacks the two entries vertically (parsed on top, existing below) with a divider.
- The sticky bottom bar's primary button is the standard 56 px mobile action height.

**Definition of Done.**
- ✅ Migrations: 1 new table (`module_26_statement_pages`) + 1 new table (`module_26_commit_log`) + 2 new columns.
- ✅ New API routes: `/api/bank-import/status/[id]` (GET, SSE), `/api/bank-import/commit` (POST, atomic).
- ✅ Extended: existing `/api/bank-import/parse` to handle multi-page PDFs.
- ✅ UI: multi-page progress screen; side-by-side review sheet; sticky commit bar.
- ✅ Tests: `__tests__/unit/statement-parser.test.ts` — confidence scoring math, rollback path, multi-page merge.
- ✅ Security: rate-limited at 10 req/min for the parse endpoint; commit endpoint is idempotent (same `commit_batch_id` returns the prior result).

---

### Module 17 — Native Bilingual Localization (EN ⇄ বাংলা) + Locale-Aware Formatting

**Pitch.** The plumbing for bilingual support is there (`LanguageContext`, `bn.json`, `toBengaliNumerals`), but the actual `bn.json` is a 30-line stub and Bengali isn't actually used in the UI. This module makes the **full UI bilingual** — every label, every chart, every date, every error message — and adds locale-aware number/currency/date formatting using the existing `formatLocaleCurrency` util.

**Audit Reference.**
- ✅ Already built: `<LanguageContext />`, `useLanguage()`, `t()` translation helper.
- ✅ Already built: `bn.json` and `en.json` in `app/src/locales/`.
- ✅ Already built: `lib/formatters/bengaliNumerals.ts` (converts Western digits to ০-৯, formats with `Intl.NumberFormat('bn-BD')`).
- ⚠️ Missing: a complete `bn.json` translation; locale-aware form components; localized date pickers; chart axis labels in Bengali; error message catalog; Right-to-Left fallback (Bengali is LTR but Urdu/Arabic may come later — designed for).

#### Feature 17.1 — Full UI Translation (bn.json) + Translation Coverage Tooling

**UX logic.** Build a **complete `bn.json`** with 600+ keys covering every label, button, error, tooltip, empty state, and chart axis. The keys follow a strict namespace convention: `nav.dashboard`, `dashboard.stat.netWorth.label`, `transactions.emptyState.title`, `errors.network.timeout`, `charts.spending.xAxis`, etc. A **translation-coverage CI check** fails the build if any new `t('foo')` call doesn't have a key in both `en.json` and `bn.json`. The `<LanguageToggle />` button (added to the sidebar + mobile drawer) lets users flip languages; a `<LanguagePickerSheet />` in settings offers more locales for the future (Urdu, Hindi stubbed).

**Data requirements.**
- Reuses `users` (adds column: `preferred_locale` enum `('en' | 'bn')` defaulting to `'en'`).
- No new tables. The translation files are static JSON.

**State flow.**
1. User toggles language → `LanguageContext.setLocale()` updates state + localStorage.
2. Every `t('key')` re-renders with the new dictionary; the language swap is synchronous (no async load — the JSON is bundled).
3. The CI script `npm run i18n:check` parses the source for `t('...')` calls and asserts 100% coverage in both files.

**Mobile design behavior.**
- The language toggle is a 44 × 44 px icon button in the mobile drawer header.
- Bengali typography uses Noto Sans Bengali as a fallback (Google Font auto-loaded by `next/font`).
- Charts swap their axis labels in real-time (Recharts respects React component re-render).

#### Feature 17.2 — Locale-Aware Formatting for All Numeric, Currency, and Date Outputs

**UX logic.** Every place a number, currency, or date is rendered goes through a centralized formatting layer:
- **Currency**: `formatLocaleCurrency(amount, locale, currencyCode)` — already built; surfaces ৳1,23,456.00 in `bn` and ৳123,456.00 in `en`. The `Intl.NumberFormat('bn-BD')` does the heavy lifting.
- **Dates**: `formatLocaleDate(date, locale, style)` — wraps `Intl.DateTimeFormat('bn-BD')`. Bengali months are full Bengali names (জানুয়ারি, ফেব্রুয়ারি, …).
- **Numbers (no currency)**: `toBengaliNumerals` converts any Western digit string to Bengali. Used in all stat cards, the heatmap, the budget progress labels.
- **Charts**: Recharts' `<XAxis tickFormatter={fmt} />` and `<YAxis tickFormatter={fmt} />` props use the locale formatter. The chart legend and tooltip use `t()`.
- **Privacy masking**: the `••••` mask characters are locale-neutral but the surrounding text is translated.

**Data requirements.**
- No new tables. Pure util work.
- New util module: `lib/formatters/locale.ts` that re-exports `formatLocaleCurrency`, `formatLocaleDate`, `toBengaliNumerals`, and a new `formatLocalePercent` + `formatLocaleCompact` (for "৳1.2K" / "৳1.2 হাজার").

**State flow.**
1. All formatters read `useLanguage()` internally — no prop-drilling required.
2. On language change, every component that consumes a formatter re-renders (React 19's automatic dependency tracking handles this).

**Mobile design behavior.**
- The Bengali digit conversion is visible immediately in the mobile bottom-bar amounts (e.g. "আজ: ৳১,২৩৪").
- Date pickers swap month names and the first-day-of-week (Saturday in Bangladesh).
- Number input fields (the `<input type="number" />` issue on Bengali Android keyboards) are replaced with `<input inputMode="decimal" />` + custom numeric formatting.

**Definition of Done.**
- ✅ Complete `bn.json` (600+ keys) with 100% coverage of all `t()` calls.
- ✅ New util module `lib/formatters/locale.ts`.
- ✅ New column on `users`: `preferred_locale`.
- ✅ New API route: `/api/settings/locale` (PUT).
- ✅ New CI script: `npm run i18n:check` (fails build on missing keys).
- ✅ UI: `<LanguageToggle />` in sidebar + drawer; `<LanguagePickerSheet />` in settings.
- ✅ Tests: `__tests__/unit/bengali-formatter.test.ts` (already exists) extended; new `__tests__/unit/locale.test.ts` for date/percent/compact formats.
- ✅ No regressions: every existing test must still pass in both locales.

---

### Module 18 — Google Calendar Sync for Recurring Bills, Debt Payoff Dates, and Smart Push Alerts

**Pitch.** The OAuth callback and sync routes already exist; the `googleapis` SDK is installed. This module makes the calendar sync **fully user-facing** (connect button, per-source-type toggles, real-time event push) and adds the **smart push alerts** layer that fires a Web-Push notification the morning of a due bill and 2 days before a debt payoff milestone.

**Audit Reference.**
- ✅ Already built: `calendar_sync_tokens`, `calendar_sync_events` (in `index.ts`).
- ✅ Already built: `calendar_sync_settings`, `calendar_event_logs` (`app/src/db/schema/calendar-sync.ts`).
- ✅ Already built: `/api/calendar/auth/callback`, `/api/calendar/sync` routes.
- ✅ Already built: `<CalendarSyncCard />` component.
- ⚠️ Missing: the OAuth connect button + disconnect flow in settings; the per-source-type toggles (`syncBills`, `syncSubscriptions`, `syncDebts` are in the schema but not in the UI); the bill-event creation hook; the push-notification scheduler; the in-app "Connected" state.

#### Feature 18.1 — OAuth Connect Flow + Per-Source Sync Toggles

**UX logic.** A new `/settings/calendar` page renders:
1. **Status card** at the top — either "Not connected" with a primary "Connect Google Calendar" button, or "Connected as [email]" with a "Disconnect" link.
2. When connected, a **per-source toggle list** with three rows: "Recurring bills" (on by default), "Subscriptions" (on), "Debt payoff dates" (on). Each row also has a "Reminder days before" inline number stepper (1–7 days, default 2).
3. A **"Sync now"** secondary button that triggers an immediate re-sync of all enabled sources.
4. A **"Last synced"** timestamp + a chevron log showing the last 5 sync events (read from `calendar_event_logs`).

**Data requirements.**
- Reuses `calendar_sync_settings` (columns `syncBills`, `syncSubscriptions`, `syncDebts`, `reminderDaysBefore` all already exist).
- No new tables.

**State flow.**
1. User taps "Connect" → window.location to `/api/calendar/auth/callback?start=1` (existing route initiates the OAuth dance).
2. On callback, server stores the refresh token in `calendar_sync_settings.google_refresh_token` and the user's email in a new column.
3. User toggles a source → PUT `/api/settings/calendar` updates the boolean + immediate re-sync for that source.
4. "Sync now" → POST `/api/calendar/sync` (existing route) iterates all `recurring_transactions`, `subscriptions`, and `debts` with future dates and creates/updates Google Calendar events. Each event gets a row in `calendar_event_logs` for audit.

**Mobile design behavior.**
- The settings page renders as a single-column list of 44 × 44 px rows.
- The OAuth redirect uses the same browser session; on iOS Safari, the auth opens in an in-app browser and returns cleanly.

#### Feature 18.2 — Smart Push Alerts + Two-Way Event Updates

**UX logic.** When the calendar sync creates an event for a bill due in N days (per `reminderDaysBefore`), the server also schedules a **Web-Push notification** (using the existing `web-push` + `push_subscriptions` infrastructure) for **8 AM on the morning of `due_date - reminderDaysBefore`**. The push payload is rich: it includes the bill name, amount, category, and a "Mark as paid" deep-link that opens the transaction-creation form pre-filled. When a Google Calendar event is deleted or updated by the user in Google Calendar, the next sync run detects the change via `calendarEventLogs.lastKnownHash` and removes the local event. The opposite direction is also covered: when a bill is marked paid in WealthAI, the corresponding Google Calendar event is updated to "✅ Paid".

**Data requirements.**
- Reuses `push_subscriptions`, `calendar_event_logs`, `calendar_sync_events`.
- New column on `calendar_event_logs`: `next_push_at` timestamp — when the next reminder should fire.
- New table `module_28_push_scheduled_jobs` (id, user_id, source_type, source_id, run_at, payload_json, status enum `pending|sent|failed|cancelled`, sent_at) — the scheduler queue. This decouples push scheduling from calendar event creation (the calendar event might be deleted, but a one-time push can still be useful for the same day).

**State flow.**
1. On event create/update, server computes `next_push_at = due_date - reminderDaysBefore (at 8am user-local)` and inserts a row into `module_28_push_scheduled_jobs`.
2. Cron at `/api/cron/push-check` (already exists, runs every 15 min) picks up `pending` jobs whose `run_at <= now()`, sends the Web-Push, updates status to `sent`.
3. When the user marks a bill paid (or deletes the event in Google Calendar), the corresponding `module_28_push_scheduled_jobs` row is set to `cancelled`.
4. Two-way hash check on every sync: if `calendarEventLogs.lastKnownHash` differs from the current Google event's etag, the local row is updated and a fresh `module_28_push_scheduled_jobs` is rescheduled (or cancelled if the event is gone).

**Mobile design behavior.**
- Push notifications on mobile use the native OS notification system via the existing service worker `app/public/sw.js` — no special handling needed.
- Tapping a push deep-links into the app via the existing URL scheme pattern (`/transactions/new?prefill=...`).

**Definition of Done.**
- ✅ Migrations: 1 new table (`module_28_push_scheduled_jobs`) + 1 new column.
- ✅ UI: `/settings/calendar` page; "Connected as [email]" status card; per-source toggles; "Sync now" button; sync log.
- ✅ Extended: existing cron `/api/cron/push-check` to drain `module_28_push_scheduled_jobs`.
- ✅ Tests: `__tests__/unit/calendar-sync.test.ts` — OAuth refresh, two-way hash diff, push scheduling math.
- ✅ Security: OAuth tokens are encrypted at rest (extend the existing AES-256-GCM util to cover `google_refresh_token`); the disconnect endpoint revokes the token server-side via Google's revocation endpoint.

---

### Module 19 — Agentic AI Coach Action Expansion + Unified Insights Hub

**Pitch.** The chat route, the `chat_tool_executions` table, and the `agentTools.ts` file all exist. This module **turns the chat into an action surface** — the AI can propose a transaction, a budget change, a goal contribution, or a subscription cancellation, and the user **confirms with one tap**. Combined with a **Unified Insights Hub** that surfaces every proactive AI insight (spending spikes, subscription leaks, savings opportunities) in one place.

**Audit Reference.**
- ✅ Already built: `chat_messages`, `chat_tool_executions`, `ai_insights_cache` (in `index.ts`).
- ✅ Already built: `agent_action_logs`, `proactive_insights` (`app/src/db/schema/agentic-ai.ts`).
- ✅ Already built: `lib/ai/agentTools.ts` (tool definitions).
- ✅ Already built: `<UnifiedInsightsHub />` component.
- ⚠️ Missing: the chat-side "Confirm" UI for tool execution; the daily proactive-insight cron; the action-from-insight deep-links; the action undo (rollback); the tool-permission grants (so the user can revoke "create transaction" while keeping "read budget").

#### Feature 19.1 — Chat-Driven Action Confirmation + Undo

**UX logic.** When the AI Coach's streamed response includes a **tool call** (e.g. `CREATE_TRANSACTION`), the chat UI renders a special **"Action Card"** inline in the message bubble. The card shows: a summary of the proposed action (e.g. "Log ৳850 expense at Groceries for yesterday"), an **"Apply"** primary button, a **"Reject"** secondary, and an **"Edit"** tertiary that opens the full form pre-filled. Tapping "Apply" POSTs to `/api/chat/confirm` (existing route) → server executes the tool via the existing `agentTools.ts` dispatch → updates `chat_tool_executions.status` to `EXECUTED` → emits a follow-up AI message ("✅ Logged. Your Groceries budget is now 68% used."). A **5-second undo toast** appears with "Undo" — clicking it POSTs to `/api/chat/undo/[id]` which reverts the action using the inverse operation (e.g. deletes the just-created transaction, restores the previous budget value, etc.).

**Data requirements.**
- Reuses `chat_tool_executions`, `agent_action_logs`.
- New table `module_29_action_permissions` (id, user_id, tool_name, granted_at, revoked_at) — per-tool permission grants.
- New column on `chat_tool_executions`: `inverse_operation_payload_json` — what to do on undo.

**State flow.**
1. AI streams a tool call → `POST /api/chat/save` records the `chat_tool_executions` row with `status = 'pending'`.
2. UI renders the Action Card. On "Apply" → `POST /api/chat/confirm` → server runs the tool, captures the inverse payload, updates `status = 'executed'`.
3. On "Undo" within 5 s → `POST /api/chat/undo/[id]` → server runs the inverse tool, updates `status = 'cancelled'`.
4. After 5 s, the undo window closes (the row is marked `undo_expired`).

**Mobile design behavior.**
- The Action Card is a 100%-width inline card with three buttons stacked vertically (Apply, Reject, Edit) on mobile; horizontally on desktop.
- The 5-second undo toast is a Sonner toast (already integrated) styled with the existing `<AchievementDetailModal />` color tokens.

#### Feature 19.2 — Unified Insights Hub + Daily Proactive Insight Cron

**UX logic.** A new `/insights` page (route already exists; we expand it) renders all active `proactive_insights` grouped by severity (`INFO`, `WARNING`, `CRITICAL`) and by type (`SPENDING_SPIKE`, `SUBSCRIPTION_LEAK`, `SAVINGS_OPPORTUNITY`, `BUDGET_OVERRUN`). Each insight card has: the title, the description, a **"Take action"** deep-link button (e.g. a SPENDING_SPIKE on Dining opens the dining category budget editor), a **"Dismiss"** icon button, and a **"Explain"** link that opens a chat with the AI Coach prefilled with the insight's context. A nightly cron (`/api/cron/insights-generate`) scans the user's last 30 days of transactions and uses Gemini to produce up to 3 new insights per day (rate-limited to avoid spam).

**Data requirements.**
- Reuses `proactive_insights`, `ai_insights_cache`.
- New table `module_29_insight_feedback` (id, user_id, insight_id, feedback enum `helpful|not_helpful|dismissed`, created_at) — for the nightly cron to learn what to stop surfacing.
- New column on `proactive_insights`: `generated_at` (nullable, to distinguish cron-generated from event-driven).

**State flow.**
1. Cron at 11 PM user-local runs `/api/cron/insights-generate` → server pulls last 30 days of transactions + budgets + subscriptions → sends to Gemini with the existing insight-type templates → writes top 3 to `proactive_insights` with `generated_at = now`.
2. User opens `/insights` → SWR fetches all non-dismissed insights → renders grouped by severity.
3. User taps "Take action" → navigates to the relevant page with a query param like `?fromInsight=42` (the relevant component reads this and highlights the relevant row on mount).
4. User taps "Dismiss" or "Not helpful" → POST `/api/insights/[id]/dismiss` → row updated; feedback is stored in `module_29_insight_feedback` to inform future cron runs.

**Mobile design behavior.**
- The page is a single-column feed; severity color-codes the left border of each card (info = blue, warning = amber, critical = rose).
- "Take action" is a 44 × 44 px primary button at the card's bottom.

**Definition of Done.**
- ✅ Migrations: 2 new tables (`module_29_action_permissions`, `module_29_insight_feedback`) + 1 new column.
- ✅ New API routes: `/api/chat/undo/[id]` (POST), `/api/insights/[id]/dismiss` (POST), `/api/cron/insights-generate` (POST, nightly).
- ✅ UI: Action Card component in chat; expanded `/insights` page; "Explain" deep-link.
- ✅ Tests: `__tests__/unit/agent-tools.test.ts` — tool dispatch, inverse-payload capture, permission enforcement.
- ✅ Security: every tool execution is rate-limited (5/min/user) and audited in `agent_action_logs`; per-tool permission grants default to "ask every time" and can be revoked from settings.

---

## Section 4 — Implementation & Deployment Strategy

### 4.1 Suggested Build Sequence (Priority Matrix)

| # | Module | Backend readiness | Effort (person-days) | Architectural dependency | Recommended sprint |
|---|---|---|---|---|---|
| **1** | **M17 Bilingual** | High (util already built) | 2 | None — pure frontend + util | Sprint 1 |
| **2** | **M14 Privacy** | High (context + lock screen built, just disabled) | 1 | None — just fix the layout binding | Sprint 1 |
| **3** | **M15 Round-ups** | High (engine + tables + cron scaffold built) | 3 | Reuses transactions API | Sprint 2 |
| **4** | **M19 Agentic AI** | High (`agentTools.ts` + `chat_tool_executions` + `UnifiedInsightsHub` built) | 4 | Reuses chat + AI Coach | Sprint 2 |
| **5** | **M12 Tax** | High (schema + exporter built) | 3 | Reuses transactions + documents | Sprint 3 |
| **6** | **M10 Household** | High (schema + algorithm + cron built) | 5 | Reuses household + push | Sprint 3 |
| **7** | **M11 Benchmarks** | Medium (schema + cohort chart built; opt-in missing) | 4 | New cron | Sprint 4 |
| **8** | **M18 Calendar Sync** | Medium (OAuth + SDK built; UI + push missing) | 3 | Reuses push + cron | Sprint 4 |
| **9** | **M16 Bank Import** | Medium (schema + UI built; confidence + multi-page missing) | 5 | Reuses transactions + AI | Sprint 5 |
| **10** | **M13 Documents** | Low (schema + OCR built; embeddings not generated) | 6 | Reuses OpenAI key + AI Coach | Sprint 5 |

**Critical-path notes:**
- Sprint 1 (M17 + M14) is intentionally a "finish what was started" sprint — it ships visible value with very low risk.
- M15 and M19 are paired because both depend on the AI Coach's streaming pipeline being stable.
- M13 is last because it requires an OpenAI API key (the current `OPENROUTER_API_KEY` can route to OpenAI models, but the budget should be confirmed) and the embedding model adds a per-document cost.

### 4.2 Key Engineering Principles (MUST follow for every module)

1. **Code reuse over reinvention.** Every new component must:
   - Read navigation from `NAVIGATION_REGISTRY` — never hard-code route paths.
   - Use `<BottomSheetModal />` for any modal that has a mobile view.
   - Use the existing `apiHandler()` wrapper for every new API route.
   - Use the existing Zod validators (`lib/validators/`) — add a new file there if needed.
   - Use the existing `useCurrency()`, `usePrivacy()`, `useLanguage()` hooks — never re-implement.
   - Use the existing motion variants from `lib/motion.ts` (which is currently missing — this is a Sprint 0 task to extract them).
2. **Security parity.** Every new API route must:
   - Be wrapped in `apiHandler({ rateLimit: 'api' })` (or a tighter profile like `'twoFactor'` for sensitive ops).
   - Call `requireAuth()` from `lib/middleware/with-auth.ts` (or be explicitly marked `public: true` in the handler options).
   - Validate every input via Zod — no `any`, no `unknown` leaks.
   - Use parameterized queries only — Drizzle's query builder enforces this; raw SQL is forbidden outside `repositories/`.
3. **Type safety.** `tsc --noEmit` must pass with **zero errors**. No `// @ts-ignore` in shipped code (use `// @ts-expect-error` with an inline reason if absolutely necessary).
4. **Zero-stub policy.** No `TODO`, no `// implement later`, no `Coming Soon` UI, no `mock` data in production code. If a feature isn't ready, the route simply doesn't exist yet (no entry in `NAVIGATION_REGISTRY`).
5. **Schema traceability.** Every new table is named `module_NN_*` (this batch starts at `module_20_*`). Migrations are generated via `drizzle-kit generate` and committed to `app/drizzle/migrations/`.
6. **Encryption by default.** Any new column that holds a number representing money must be added with an `encrypted_*` companion column populated via `lib/crypto/encryption.ts`.
7. **Observability.** Every new API route logs to the existing `lib/telemetry/logger.ts` with the route name, user_id, and request duration. Push notification jobs log to the same logger with `jobId`.
8. **Accessibility.** Every interactive element ≥ 44 × 44 px; every form input has a visible label; every modal traps focus; every chart has a text-based data table alternative for screen readers.

### 4.3 Final Acceptance Checklist (per module, must pass before merge)

For every module shipped, the following matrix is verified by a Playwright spec:

| Check | Tool / Method | Pass criteria |
|---|---|---|
| Type check | `npm run typecheck` | 0 errors, 0 warnings |
| Lint | `npm run lint` | 0 errors, 0 warnings (ESLint config in `eslint.config.mjs`) |
| Unit tests | `npm run test` | All existing tests pass + new tests added for the module's pure logic |
| Build | `npm run build` | Compiles successfully; no dynamic-import warnings; no missing-env warnings |
| E2E — Desktop (1280px) | Playwright spec | Every page loads; every interactive element reachable; every form submits |
| E2E — Tablet (768px) | Playwright spec | Layout transitions cleanly; multi-column grids collapse correctly |
| E2E — Mobile (375px) | Playwright spec | Bottom-sheet pattern used; touch targets ≥ 44 px; safe-area insets respected; no horizontal scroll |
| Theme toggle | Playwright | Both `dark` and `light` themes render without missing tokens; chart axis labels readable in both |
| Reduced motion | Playwright (`emulateMedia({ reducedMotion: 'reduce' })`) | All Framer Motion variants collapse to opacity-only; no layout shift |
| API rate limit | Vitest + manual `curl` | 100/min default; 5/min on auth; 30/min on public share; violations return 429 with `Retry-After` |
| Privacy mode | Playwright | `⌘⇧P` toggles; masking applied to all amounts; account numbers masked in exports |
| Push notifications | Manual test on Chrome + Firefox + Safari | Subscribe → receive test push → mark as delivered |
| Database migration | `drizzle-kit migrate` on a fresh Turso DB | Applies cleanly; rollback script generated |
| Security headers | `curl -I` | CSP, HSTS, X-Frame-Options, Permissions-Policy all present |
| Lighthouse | Chrome DevTools | Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90 |
| Bundle size | `next build` output | No route bundle > 250 KB (gzipped); dynamic imports used for charts + PDF libs |

### 4.4 Pre-Flight "Finish What Was Started" Sprint (Recommended Before Module 10–19)

Because the audit found that several already-built pieces are **not actually wired up**, the following Sprint 0 tasks should land first (1 day total):

1. **Fix `app/src/app/(app)/layout.tsx`:** Replace the hard-coded `<LockScreen timeoutMinutes={0} lockOnBackground={false} />` with a SWR-driven read of the user's `user_privacy_settings` and pass the real values. This single line unlocks the entire Module 14.
2. **Extract `lib/motion.ts`:** Audit the codebase, find every inline `motion.div initial={…} animate={…}` object, and replace with named variants from a central file. This is required for the global `prefers-reduced-motion` fallback in Section 2.
3. **Update README:** The current README is wrong about (a) the framework version, (b) the data access layer, (c) the project structure, and (d) the feature list. A corrected README is a 2-hour job and prevents future contributors from going down wrong paths.
4. **Fix landing page `/coach` 404:** Add a redirect from `/coach` → `/chat` (or vice versa) so the marketing CTAs don't dead-end.
5. **Activate the `bn.json` stub:** Even before Module 17 ships in full, populate `bn.json` with the 30 existing keys and ship the language toggle to verify the plumbing works.
6. **Add `app/src/lib/motion.ts`:** The file doesn't exist yet — many components define motion variants inline. Centralize them.

---

## Appendix A — File / Route Inventory (Audit Output)

This appendix is the raw list of files referenced in this document, so a future contributor can grep for them.

### Schema files
- `app/src/db/schema/index.ts` (re-exports + 11 inline tables: `chat_messages`, `budgets`, `netWorth`, `notifications`, `savings_goals`, `recurring_transactions`, `custom_categories`, `debts`, `automation_rules`, `push_subscriptions`, `investment_holdings`, `automation_audit_log`, `dashboard_layouts`, `households`, `household_members`, `household_expenses`, `household_settlements`, `household_category_caps`, `household_split_rules`, `benchmark_demographics`, `category_percentile_snapshots`, `tax_deduction_items`, `documents`, `document_embeddings`, `round_up_settings`, `goal_milestones`, `statement_import_batches`, `calendar_sync_tokens`, `calendar_sync_events`, `chat_tool_executions`, `ai_insights_cache`, `user_demographics`, `percentile_snapshots`, `bank_import_review_queue`)
- `app/src/db/schema/users.ts`, `transactions.ts`, `accounts.ts`, `audit-logs.ts`, `sessions.ts`, `bill-splits.ts`, `household-splits.ts`, `benchmarks.ts`, `tax-vault.ts`, `document-vault.ts`, `privacy-settings.ts`, `round-ups.ts`, `statement-imports.ts`, `calendar-sync.ts`, `agentic-ai.ts`

### Layout / Navigation
- `app/src/app/(app)/layout.tsx` — root authenticated layout (Sidebar + MobileTabBar + Providers)
- `app/src/components/Sidebar.tsx` — desktop left nav (reads `NAVIGATION_REGISTRY`)
- `app/src/components/MobileMenu.tsx` — mobile bottom drawer (same registry)
- `app/src/components/MobileTabBar.tsx` — mobile bottom tab bar (filter `mobileTab: true`)
- `app/src/lib/navigation/registry.ts` — single source of truth for all routes

### Cross-cutting infrastructure
- `app/src/middleware.ts` — edge JWT auto-refresh
- `app/src/lib/middleware/api-handler.ts` — `apiHandler()` HOF + server-side privacy redaction
- `app/src/lib/middleware/with-auth.ts` — `requireAuth()` helper
- `app/src/lib/security/rate-limiter.ts` — Upstash Redis sliding-window
- `app/src/lib/security/session-manager.ts` — refresh-token rotation
- `app/src/lib/security/account-lockout.ts` — 5-strike lockout
- `app/src/lib/crypto/encryption.ts` — AES-256-GCM
- `app/src/lib/crypto/totp.ts` — TOTP 2FA
- `app/src/lib/ai/agentTools.ts` — Agentic AI tool dispatch
- `app/src/lib/ai/ocrPipeline.ts` — Gemini OCR
- `app/src/lib/ai/statementParser.ts` — Gemini statement parsing
- `app/src/lib/algorithms/minSettlement.ts` — debt minimization
- `app/src/lib/finance/roundUpEngine.ts` — round-up math
- `app/src/lib/export/taxExporter.ts` — PDF fiscal report
- `app/src/lib/formatters/bengaliNumerals.ts` — `toBengaliNumerals` + `formatLocaleCurrency`
- `app/src/lib/telemetry/logger.ts` — structured logging
- `app/src/lib/types/api.ts` — `apiSuccess` / `apiError` envelopes
- `app/src/lib/types/errors.ts` — `AppError`, `ValidationError`, `RateLimitError`, etc.
- `app/src/lib/types/dto.ts` — strict DTO types

### UI / components
- `app/src/components/BottomSheetModal.tsx` — the canonical mobile sheet
- `app/src/components/CommandPalette.tsx` — ⌘K global search
- `app/src/components/PrivacyToggle.tsx` — header toggle
- `app/src/components/LockScreen.tsx` — auto-lock overlay
- `app/src/components/QuickAddModal.tsx` — quick transaction entry
- `app/src/components/ReceiptDropZone.tsx` + `ReceiptScannerModal.tsx` — receipt OCR
- `app/src/components/dashboard/DashboardIntelHub.tsx` + `UnifiedInsightsHub.tsx` — Module 19 surface
- `app/src/components/bank-import/DuplicateReconciliationModal.tsx` — Module 16 surface
- `app/src/components/calendar/CalendarSyncCard.tsx` — Module 18 surface
- `app/src/components/benchmarks/CohortRadarChart.tsx` — Module 11 surface
- `app/src/components/goals/RoundUpCard.tsx` — Module 15 surface
- `app/src/components/security/LockScreen.tsx` — alias (same as above)
- `app/src/components/transactions/TransactionRowActions.tsx` — Module 12 hook point
- `app/src/components/ui/{AuroraBackground, FluidButton, PageTransition, Skeleton, SmoothScroll, TiltCard}.tsx` — primitive set

### Context providers
- `app/src/contexts/CurrencyContext.tsx`
- `app/src/contexts/PrivacyContext.tsx`
- `app/src/contexts/LanguageContext.tsx`

### Test seeds
- `app/src/__tests__/unit/{bengali-formatter,debts-simulator,generative-art,household-settlement,round-up-engine}.test.ts`
- `app/src/__tests__/unit/lib/crypto/encryption.test.ts`
- `app/src/__tests__/unit/lib/telemetry/logger.test.ts`
- `app/src/__tests__/unit/lib/types/{dto,errors}.test.ts`

---

## Appendix B — Schema-to-Feature Cross-Reference

| Schema table | Feature module | Status |
|---|---|---|
| `households`, `household_members`, `household_expenses` | M10 (pre-existing) | Built |
| `household_ledgers`, `household_splits` | M10 (pre-existing) | Built |
| `household_settlements`, `household_category_caps`, `household_split_rules` | M10 Feature 10.1 + 10.2 | Schema built, UI partial |
| `user_demographics`, `benchmark_aggregates` | M11 | Schema built, UI partial |
| `category_percentile_snapshots`, `percentile_snapshots` | M11 Feature 11.2 | Schema built, UI missing |
| `tax_categories`, `tax_deductions`, `tax_deduction_items` | M12 | Schema built, UI partial |
| `document_metadata`, `document_line_items` | M13 | Schema built, embeddings not generated |
| `documents`, `document_embeddings` | M13 | Schema built, semantic search not implemented |
| `user_privacy_settings` | M14 | Schema built, settings UI missing, LockScreen disabled |
| `round_up_settings`, `goal_milestones`, `round_up_rules`, `round_up_transfers` | M15 | Schema built, engine built, auto-trigger UI missing |
| `statement_import_batches`, `imported_statements`, `reconciliation_queue`, `bank_import_review_queue` | M16 | Schema built, multi-page + atomic-commit missing |
| (locale: `bn.json`, `en.json`) | M17 | Built (stub) |
| `calendar_sync_tokens`, `calendar_sync_events`, `calendar_sync_settings`, `calendar_event_logs` | M18 | Schema built, UI missing, push alerts missing |
| `agent_action_logs`, `proactive_insights`, `chat_tool_executions`, `ai_insights_cache` | M19 | Schema built, Action Card UI missing, cron missing |

---

*End of document. Built on a verified audit of `me-nazat/budgetai@main` (commit retrieved during this audit). Every claim in this document is anchored to a file path, route, table, or hook that was read from the source tree.*


<ADDITIONAL_METADATA>
The current local time is: 2026-09-07T19:36:32+06:00.

The user's current state is as follows:
Other open documents:
- /Users/nazat/Desktop/Desktop/antigravity/budget & savings AI  /app/src/components/PageTransition.tsx (LANGUAGE_TSX)
- /Users/nazat/Desktop/Desktop/antigravity/budget & savings AI  /app/src/components/ExportButton.tsx (LANGUAGE_TSX)
- /Users/nazat/Desktop/Desktop/antigravity/budget & savings AI  /app/src/hooks/useSyncOnReconnect.ts (LANGUAGE_TYPESCRIPT)
- /Users/nazat/Desktop/Desktop/antigravity/budget & savings AI  /app/src/app/(app)/transactions/page.tsx (LANGUAGE_TSX)
- /Users/nazat/Desktop/Desktop/antigravity/budget & savings AI  /app/src/components/MobileMenu.tsx (LANGUAGE_TSX)
</ADDITIONAL_METADATA>
<USER_SETTINGS_CHANGE>
The user changed setting `Model Selection` from None to Claude Opus 4.6 (Thinking). No need to comment on this change if the user doesn't ask about it. If reporting what model you are, please use a human readable name instead of the exact string.
</USER_SETTINGS_CHANGE>