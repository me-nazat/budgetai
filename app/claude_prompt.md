# WealthAI — Complete Professional Overhaul Prompt for Claude Code

> **IMPORTANT**: This is a comprehensive, single-session instruction set. Read every section carefully before touching any file. Execute all tasks in the order specified. Do not skip sections.

---

## 🧠 PROJECT OVERVIEW & CONTEXT

You are working on **WealthAI** (repo: `me-nazat/budgetai`, live at `wealthai-red.vercel.app`) — an AI-powered personal finance management web application built with:

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel
- **Purpose**: Track expenses, earnings, budgets, net worth, and savings with intelligent AI insights

This project is being submitted as an academic/professional portfolio piece at an international level. Every single line of code must reflect the craftsmanship, intentionality, and architectural maturity of a senior full-stack engineer. The codebase should look like it was built by a small elite team over months, not generated quickly.

The current codebase has ~21,000 lines. After this overhaul, it should reach **25,000–27,000+ lines** through the addition of genuinely useful, professional features — not padding.

---

## 🔍 PHASE 0 — FULL CODEBASE AUDIT (READ BEFORE TOUCHING ANYTHING)

Before writing a single line, perform this full audit and document your findings in a temporary `AUDIT.md` in the project root:

1. **Read every file** in the `app/` directory, `components/`, `lib/`, `hooks/`, `types/`, `utils/`, and any config files.
2. **Map the entire routing structure** — every page, layout, loading, and error file.
3. **Identify all API routes** (`app/api/`) and document what each one does, its input validation, and authentication guards.
4. **List all third-party libraries** from `package.json` and flag any that are outdated, unused, or potentially insecure.
5. **Find all `console.log` statements** — every single one must be removed or replaced with a structured logger before final commit.
6. **Find all `any` TypeScript types** — every `any` must be replaced with a precise interface or generic.
7. **Find all hardcoded secrets, API keys, or sensitive strings** in source files — these must be moved to environment variables.
8. **Find all `TODO`, `FIXME`, `HACK` comments** — address every one.
9. **Find all missing loading states, error boundaries, and empty states** on every page.
10. **Identify performance bottlenecks** — large client bundles, missing `Suspense` boundaries, missing `dynamic()` imports, missing image optimization, missing `useMemo`/`useCallback` where data is recomputed on every render.

Keep `AUDIT.md` for your own reference but **delete it before the final commit**.

---

## 🚨 PHASE 1 — CRITICAL SECURITY FIXES (HIGHEST PRIORITY)

These must be completed first. Do not proceed to Phase 2 until every item in this phase is done.

### 1.1 — Environment Variables & Secrets Management

- [ ] Audit every file for hardcoded API keys, database URLs, Clerk/Supabase/Prisma credentials, or AI model keys. Move ALL of them to `.env.local` (never committed) with proper `.env.example` containing only placeholder values.
- [ ] Create `lib/env.ts` — a **validated environment configuration** module using `zod` that validates all required env vars at build time with descriptive error messages. Example:
  ```typescript
  import { z } from 'zod';
  
  const envSchema = z.object({
    DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
    CLERK_SECRET_KEY: z.string().min(1),
    OPENAI_API_KEY: z.string().startsWith('sk-'),
    ENCRYPTION_SECRET: z.string().min(32, 'ENCRYPTION_SECRET must be at least 32 characters'),
    NODE_ENV: z.enum(['development', 'test', 'production']),
  });
  
  export const env = envSchema.parse(process.env);
  ```
- [ ] Update `.gitignore` to include `.env*` (except `.env.example`) and ensure no sensitive file has ever been committed. If it has, add a note that the user must rotate those credentials.
- [ ] The `.agent` file currently exposes an internal filesystem path (`/Users/nazat/.antigravity-global-kit/.agent`). This is a **privacy leak**. Remove this file from the repository immediately and add it to `.gitignore`.

### 1.2 — API Route Security

For **every single API route** in `app/api/`:

- [ ] Add **authentication checks** at the very top of every route handler. No route that accesses user data should be callable without a valid session. Use your auth provider (Clerk, NextAuth, etc.) to verify the session before any database operation.
  ```typescript
  // Pattern for every protected API route
  import { auth } from '@clerk/nextjs/server';
  
  export async function GET(request: Request) {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // ... rest of handler
  }
  ```
- [ ] Add **input validation** using `zod` for every route that accepts a request body or query parameters. Never trust raw input.
- [ ] Add **rate limiting** to all AI-related endpoints (expense analysis, chat, insights) using Vercel's `@vercel/kv` or an in-memory rate limiter. Pattern:
  ```typescript
  import { Ratelimit } from '@upstash/ratelimit';
  import { kv } from '@vercel/kv';
  
  const ratelimit = new Ratelimit({
    redis: kv,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
  });
  ```
- [ ] All API routes must return **consistent JSON error shapes**:
  ```typescript
  type ApiError = {
    error: string;
    code: string;
    details?: Record<string, string[]>;
  };
  ```
- [ ] Add `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and `Permissions-Policy` headers in `next.config.ts`:
  ```typescript
  const securityHeaders = [
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    {
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline' *.vercel.app",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' blob: data: https:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join('; '),
    },
  ];
  ```

### 1.3 — Data Privacy Architecture

- [ ] Create `lib/encryption.ts` — a module that provides AES-256-GCM encryption/decryption for sensitive financial data stored in the database:
  ```typescript
  import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
  
  const ALGORITHM = 'aes-256-gcm';
  const KEY_LENGTH = 32;
  const IV_LENGTH = 16;
  const AUTH_TAG_LENGTH = 16;
  const SALT = 'wealthai-financial-data-v1'; // static salt for key derivation
  
  function deriveKey(secret: string): Buffer {
    return scryptSync(secret, SALT, KEY_LENGTH);
  }
  
  export function encryptSensitiveData(plaintext: string, secret: string): string {
    const key = deriveKey(secret);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64url');
  }
  
  export function decryptSensitiveData(ciphertext: string, secret: string): string {
    const key = deriveKey(secret);
    const data = Buffer.from(ciphertext, 'base64url');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
  ```
- [ ] Apply this encryption to all sensitive financial fields (amounts, account numbers, notes) stored in the database. Store the encrypted string; decrypt only when serving to the authenticated owner.
- [ ] Add a `Privacy Policy` page at `/privacy` and `Terms of Service` page at `/terms` with professional, detailed content appropriate for a financial application.
- [ ] Add a `Data Export` feature that allows users to download all their data as a CSV or JSON file (GDPR compliance).
- [ ] Add a `Delete Account` feature with a confirmation dialog that deletes all user data from the database and revokes the session.

### 1.4 — CSRF & XSS Protection

- [ ] Ensure all state-mutating operations (POST, PUT, DELETE) go through authenticated API routes, never direct database calls from client components.
- [ ] Sanitize all user-generated text that is displayed in the UI using a library like `DOMPurify` or `sanitize-html` before rendering, especially in any markdown or rich-text fields.
- [ ] Ensure no `dangerouslySetInnerHTML` is used with unsanitized user input anywhere.

---

## ⚡ PHASE 2 — PERFORMANCE OVERHAUL

### 2.1 — Bundle Size & Code Splitting

- [ ] Audit `next.config.ts` and add bundle analysis:
  ```bash
  npm install @next/bundle-analyzer
  ```
  ```typescript
  // next.config.ts
  import withBundleAnalyzer from '@next/bundle-analyzer';
  const analyze = withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
  export default analyze({ /* existing config */ });
  ```
- [ ] Convert all heavy client components (charts, rich editors, complex modals, AI chat panel) to use `next/dynamic` with loading skeletons:
  ```typescript
  import dynamic from 'next/dynamic';
  
  const ExpenseChart = dynamic(() => import('@/components/charts/ExpenseChart'), {
    loading: () => <ChartSkeleton />,
    ssr: false,
  });
  ```
- [ ] Audit all imports and switch to **named imports** from libraries (never import the entire library): `import { format } from 'date-fns'` not `import * as dateFns from 'date-fns'`.
- [ ] Replace any large libraries with lighter alternatives where possible:
  - Heavy date library → `date-fns` (already tree-shakeable)
  - Heavy animation library → Framer Motion used selectively with `LazyMotion` and `domAnimation` features only
  - Any `lodash` full import → individual function imports or native equivalents

### 2.2 — Data Fetching & Caching Strategy

- [ ] Implement a **comprehensive caching strategy** using Next.js's built-in caching:
  - Dashboard summary data: cache with `revalidate: 300` (5 minutes)
  - AI insights: cache per-user with `revalidate: 3600` (1 hour)
  - Static content (categories, currencies): cache indefinitely with `revalidate: false`
- [ ] Add `loading.tsx` files for **every page segment** in the App Router with meaningful, styled skeleton UIs (not just a spinner).
- [ ] Add `error.tsx` files for every page segment with user-friendly error messages and a "Try again" button.
- [ ] Implement **optimistic updates** for all user actions (adding a transaction, creating a budget, etc.) using React's `useOptimistic` hook so the UI feels instant.
- [ ] Use **React Query** or **SWR** for all client-side data fetching with proper stale time, cache time, and background refetch configuration. Remove any `useEffect` + `fetch` patterns and replace with proper data-fetching hooks.

### 2.3 — Rendering Strategy

- [ ] Audit every component. Components that don't need interactivity must be **Server Components** (no `'use client'` directive).
- [ ] Wrap all data-loading sections in `<Suspense>` boundaries with proper fallback skeletons.
- [ ] Add `<Suspense>` streaming for the main dashboard so users see the layout immediately while data loads.
- [ ] Implement **Partial Prerendering** (PPR) where applicable (Next.js 14+).

### 2.4 — Image & Font Optimization

- [ ] Replace all `<img>` tags with Next.js `<Image>` component with proper `width`, `height`, and `priority` props.
- [ ] Replace all custom font loading with `next/font/google` or `next/font/local`:
  ```typescript
  import { Inter, Geist_Mono } from 'next/font/google';
  
  export const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
  });
  ```
- [ ] Add `<link rel="preconnect">` for any third-party domains in `app/layout.tsx`.

### 2.5 — Animation & Smooth UI

- [ ] Install and configure **Framer Motion** using the `LazyMotion` API for all page transitions, modal animations, and micro-interactions. Do NOT use heavy full imports:
  ```typescript
  import { LazyMotion, domAnimation, m } from 'framer-motion';
  
  // Wrap root layout
  <LazyMotion features={domAnimation} strict>
    {children}
  </LazyMotion>
  
  // Use m.div instead of motion.div everywhere
  ```
- [ ] Add a **page transition system** — each page fades and slides in smoothly (40px translateY, opacity 0 → 1, 300ms ease-out).
- [ ] Add **number animation** for all financial figures using a custom `useCountUp` hook that animates numbers from 0 to their final value on mount.
- [ ] Add **staggered list animations** for transaction lists, budget cards, and insight cards using Framer Motion's `staggerChildren`.
- [ ] Add a **global loading bar** (thin progress bar at top of page, like NProgress) for all navigation events.
- [ ] Add smooth **hover micro-interactions** on all cards (subtle scale: 1.01, shadow increase, 150ms transition).
- [ ] Implement **skeleton screens** for every data-loading state — these must match the exact shape of the loaded content (not generic grey bars).

---

## 🏗️ PHASE 3 — CODE QUALITY & ARCHITECTURE

### 3.1 — TypeScript Strict Mode

- [ ] Enable **strict TypeScript** in `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true,
      "exactOptionalPropertyTypes": true,
      "forceConsistentCasingInFileNames": true
    }
  }
  ```
- [ ] Fix every TypeScript error that appears after enabling strict mode. Zero `any` types allowed. Zero `@ts-ignore` comments allowed. Zero `@ts-expect-error` without a descriptive comment.

### 3.2 — Shared Type System

Create a comprehensive `types/` directory with:

- `types/database.ts` — All database entity types (mapped from your ORM/Prisma schema)
- `types/api.ts` — All API request/response types
- `types/finance.ts` — Domain types: `Transaction`, `Budget`, `Category`, `NetWorth`, `Savings`, `RecurringPayment`, `FinancialGoal`, `AIInsight`
- `types/ui.ts` — Component prop types, state types
- `types/auth.ts` — User profile, session types
- `types/forms.ts` — Form field types with zod schemas
- `index.ts` — Re-exports all types for clean imports: `import type { Transaction } from '@/types'`

### 3.3 — Error Handling

- [ ] Create a global `lib/errors.ts` with a custom error hierarchy:
  ```typescript
  export class WealthAIError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode: number = 500,
      public readonly context?: Record<string, unknown>,
    ) {
      super(message);
      this.name = 'WealthAIError';
    }
  }
  
  export class AuthorizationError extends WealthAIError {
    constructor(message = 'You are not authorized to perform this action') {
      super(message, 'AUTHORIZATION_ERROR', 403);
    }
  }
  
  export class ValidationError extends WealthAIError {
    constructor(message: string, public readonly fields?: Record<string, string[]>) {
      super(message, 'VALIDATION_ERROR', 400, { fields });
    }
  }
  
  export class NotFoundError extends WealthAIError {
    constructor(resource: string) {
      super(`${resource} not found`, 'NOT_FOUND', 404);
    }
  }
  
  export class RateLimitError extends WealthAIError {
    constructor() {
      super('Too many requests. Please try again later.', 'RATE_LIMIT_EXCEEDED', 429);
    }
  }
  ```
- [ ] Create a centralized `handleApiError(error: unknown)` utility that converts any error to the standard API error shape.
- [ ] Wrap the entire application in a top-level `error.tsx` that sends errors to a monitoring service and shows a user-friendly recovery UI.

### 3.4 — Logging

- [ ] Install and configure `pino` for structured server-side logging:
  ```typescript
  // lib/logger.ts
  import pino from 'pino';
  
  export const logger = pino({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
    redact: ['password', 'token', 'apiKey', 'secret', 'authorization'],
  });
  ```
- [ ] Replace all `console.log`, `console.error`, `console.warn` with `logger.info`, `logger.error`, `logger.warn`.
- [ ] Never log financial data (amounts, account details) — only log metadata like `userId`, `action`, `timestamp`, `durationMs`.

### 3.5 — Code Organization

- [ ] Ensure the directory structure follows this professional layout:
  ```
  app/
    (auth)/           # Auth route group
    (dashboard)/      # Protected dashboard routes
      layout.tsx      # Dashboard shell with sidebar/nav
      page.tsx        # Main overview
      transactions/
      budgets/
      goals/
      insights/
      net-worth/
      settings/
      reports/        # NEW
      recurring/      # NEW
    (marketing)/      # Public pages route group
      page.tsx        # Landing page
      about/          # NEW
      pricing/        # NEW (even if free, shows tiers)
      privacy/
      terms/
      changelog/      # NEW
    api/
      auth/
      transactions/
      budgets/
      ai/
        insights/
        chat/
        categorize/   # NEW - AI auto-categorization
  components/
    ui/               # Primitive UI components (shadcn or custom)
    finance/          # Finance-specific components
    charts/           # Chart components
    forms/            # Form components
    layout/           # Layout components (Sidebar, Header, Footer)
    shared/           # Shared across features
  hooks/              # Custom React hooks
  lib/                # Utilities, configs, clients
  types/              # TypeScript types
  services/           # Business logic layer
  ```

---

## ✨ PHASE 4 — NEW FEATURES (Increase Codebase & Professional Depth)

Each feature below must be **fully functional**, not placeholder or stub. Implement proper UI, API, database schema, and business logic.

### 4.1 — Advanced Dashboard Overhaul

Replace the current dashboard with a **comprehensive financial command center**:

- **Net Worth Timeline Chart**: Interactive line chart showing net worth progression over 12 months with tooltip showing assets vs. liabilities breakdown.
- **Cash Flow Sankey Diagram**: Visual flow from income sources → spending categories → savings. Use `recharts` or `d3`.
- **Financial Health Score**: A 0–100 score card computed from: savings rate, budget adherence, debt-to-income ratio, emergency fund coverage, and investment diversification. Show score with animated gauge, breakdown by category, and personalized improvement tips.
- **Quick Action Bar**: Floating action buttons for: Add Transaction, Transfer Money, Set Goal, Scan Receipt.
- **Recent Activity Feed**: Real-time-style feed of the last 10 transactions with category icons, merchant names, and amounts — with smooth stagger animation on load.
- **Budget Burn Rate Widget**: For each active budget, show a progress bar with days remaining and projected end-of-period status.
- **Upcoming Bills Widget**: List of recurring payments due in the next 7 days, sorted by urgency, with days-remaining countdown.
- **AI Insight Callout**: A prominent card with today's most important AI insight, refreshed daily.

### 4.2 — Smart Transaction System

- [ ] **Receipt Scanner**: Integrate an AI endpoint that accepts an image upload, sends it to OpenAI Vision API, and extracts merchant name, amount, date, and category. Auto-fills the transaction form.
- [ ] **AI Auto-Categorization**: Every new transaction with a description gets automatically categorized by the AI. Implement `POST /api/ai/categorize` that takes `{ description: string, amount: number }` and returns `{ category: string, confidence: number, alternativeCategories: string[] }`.
- [ ] **Bulk Import**: CSV import for bank statements with intelligent column mapping and duplicate detection.
- [ ] **Transaction Search & Filter**: Full-text search across description, merchant, and notes. Filter by date range, category, amount range, account, and tags. URL-based filter state so users can share/bookmark filtered views.
- [ ] **Transaction Tags**: Allow users to add multiple custom tags to transactions for cross-category analysis.
- [ ] **Split Transactions**: Allow a single transaction to be split across multiple categories with different amounts.
- [ ] **Recurring Transaction Detection**: AI endpoint that analyzes transaction history and identifies recurring patterns, suggesting them as scheduled transactions.

### 4.3 — Advanced Budget System

- [ ] **Budget Templates**: Pre-built budget templates for: Student, Young Professional, Family, Early Retirement. One-click apply with customizable percentages.
- [ ] **Envelope Budgeting**: Virtual "envelopes" (pools) where users allocate money at the start of the month. Show real-time deductions from each envelope as transactions are added.
- [ ] **50/30/20 Rule Analyzer**: Automatic analysis of whether the user's spending aligns with the 50/30/20 rule (needs/wants/savings), with a visual breakdown and actionable recommendations.
- [ ] **Budget Rollover**: Option to roll unused budget amounts forward to the next month.
- [ ] **Budget Alerts**: Email/notification when a budget category reaches 75%, 90%, and 100% of its limit.

### 4.4 — Financial Goals

- [ ] A complete **Goals** system at `/dashboard/goals`:
  - Create goals with: name, target amount, target date, category (emergency fund, vacation, home, retirement, education, custom), and linked savings account.
  - Visual goal card with animated circular progress ring.
  - "Milestone" system — goals break into 4 milestones (25%, 50%, 75%, 100%) with celebratory animations on completion.
  - Projected completion date based on current savings rate, updated in real time.
  - "Boost Goal" feature — AI suggests specific budget cuts that would accelerate the goal by X months.
  - Multiple goals with priority ordering.

### 4.5 — Net Worth Tracker

- [ ] Full `/dashboard/net-worth` page:
  - **Assets**: Add categories: Cash & Bank Accounts, Investments, Real Estate, Vehicles, Other.
  - **Liabilities**: Add categories: Mortgage, Student Loans, Credit Cards, Auto Loans, Other.
  - **Net Worth Timeline**: Monthly snapshot history stored in database, rendered as an area chart.
  - **Asset Allocation Pie Chart**: Breakdown of assets by category.
  - **Debt Payoff Calculator**: Input extra monthly payment → shows months saved and interest avoided.
  - **Net Worth Statement Export**: PDF generation of a formal net worth statement.

### 4.6 — Reports & Analytics

- [ ] A new `/dashboard/reports` page with:
  - **Monthly Spending Report**: Detailed breakdown by category, merchant, day-of-week patterns, and comparison to previous month.
  - **Year-in-Review Report**: Annual summary with highest spending month, biggest expense, savings achieved, and goals completed.
  - **Custom Date Range Report**: Any start/end date.
  - **Spending Trends Chart**: 12-month trend line per category.
  - **Income vs. Expense Chart**: Monthly bar chart with surplus/deficit highlighted.
  - **Top Merchants Report**: Ranked list of where the most money is spent.
  - **Export to PDF**: Professional formatted PDF report using `@react-pdf/renderer`.

### 4.7 — Recurring Payments Manager

- [ ] New `/dashboard/recurring` page:
  - List of all detected/manually added recurring payments.
  - Each entry: merchant, amount, frequency (weekly/monthly/annual), next due date, category, and payment method.
  - **Annual Cost Calculator**: Total yearly cost of all subscriptions/recurring payments.
  - **Subscription Audit**: AI analyzes recurring payments and flags potential duplicates or unused subscriptions with a "Cancel this?" nudge.
  - Calendar view showing all upcoming bills for the next 30 days.

### 4.8 — AI Financial Assistant (Chat)

If a chat/assistant feature exists, enhance it significantly. If it doesn't, create it:

- [ ] Floating chat button on all dashboard pages.
- [ ] Side panel chat interface (not full page) that slides in from the right.
- [ ] The assistant has **full context** of the user's financial data (sent as a system prompt summary — never raw data, only aggregates for privacy).
- [ ] The assistant can answer: "How much did I spend on food last month?", "Am I on track for my vacation goal?", "What's my biggest financial risk right now?", "How can I save $500 more per month?"
- [ ] **Streaming responses** using the Vercel AI SDK (`useChat` hook with `streamText`).
- [ ] Conversation history persisted in the database (limited to last 50 messages for context).
- [ ] **Suggested questions** shown as chips below the input field, refreshed after each response.
- [ ] The assistant must **never fabricate specific numbers** — it must only reference the actual user data passed in its context.

### 4.9 — Notification & Alert System

- [ ] Create a `notifications` database table.
- [ ] Create a `NotificationBell` component in the header with unread count badge.
- [ ] Notification types to implement:
  - Budget limit warnings (75%, 90%, 100%)
  - Large unusual transaction detected (AI-flagged)
  - Goal milestone reached
  - Weekly spending summary
  - Bill due reminder (3 days before)
  - Monthly financial health score update
- [ ] Notification preferences page in `/dashboard/settings/notifications`.

### 4.10 — Settings & Account Management

Completely rebuild the settings page into a professional tabbed interface:

- **Profile**: Display name, email, profile picture upload (stored in Vercel Blob or Cloudinary).
- **Security**: Change password, active sessions list with "Sign out all devices" option, 2FA setup UI (integration depends on auth provider).
- **Privacy**: Data export button, delete account button, data retention preferences.
- **Notifications**: Toggle each notification type on/off, notification frequency.
- **Preferences**: Currency (support USD, EUR, GBP, BDT, and 20 more), date format, first day of week, theme (light/dark/system), language (even if only English for now — structure for i18n).
- **Integrations**: Placeholder cards for future bank integrations (Plaid API ready) with "Coming Soon" badges.
- **Subscription/Plan**: Current plan details, usage stats, upgrade CTA.
- **Danger Zone**: Account deletion with "Type your email to confirm" pattern.

---

## 🎨 PHASE 5 — LANDING PAGE COMPLETE REDESIGN

The current landing page must be completely rebuilt from scratch as a high-conversion, visually stunning marketing page.

### Structure:
1. **Hero Section**
   - Full-viewport height
   - Animated gradient background (dark, subtle, professional — not garish)
   - Large headline with animated word highlight (Framer Motion `useAnimate`)
   - Sub-headline: concise value proposition
   - Two CTAs: "Start for Free" (primary) and "Watch Demo" (secondary, opens a modal with a product walkthrough video/GIF)
   - Floating mock dashboard screenshot with subtle parallax scroll effect
   - Trust badges row: "256-bit Encryption", "Bank-Grade Security", "No Credit Card Required", "GDPR Compliant"

2. **Features Section** (alternating left/right layout)
   - Feature 1: AI-Powered Insights — with animated chart demo
   - Feature 2: Budget Tracking — with animated budget gauge
   - Feature 3: Goal Setting — with animated progress ring
   - Feature 4: Net Worth Tracking — with animated area chart
   - Each feature has: icon, headline, 2-sentence description, and a "learn more" link
   - Animate into view using Framer Motion's `whileInView` with `once: true`

3. **How It Works** (numbered steps with connecting line)
   - Step 1: Sign Up in 30 Seconds
   - Step 2: Connect Your Finances
   - Step 3: Get AI-Powered Insights
   - Step 4: Achieve Your Goals
   - Animate each step in with stagger delay as user scrolls

4. **Financial Health Score Explainer** — visual breakdown of how the score is calculated, showing a live-animated example score going from 42 to 78

5. **Social Proof / Testimonials** — 3 professional testimonial cards with avatar, name, title, and quote. Carousel on mobile.

6. **Security & Privacy Section** — addresses the #1 concern of finance app users:
   - "Your Data, Your Privacy" heading
   - AES-256-GCM encryption badge
   - Zero data selling commitment
   - SOC 2 compliance roadmap note
   - Open source transparency note (if applicable)

7. **Pricing Section** — Even if the app is free, show:
   - Free tier: Core features
   - Pro tier (coming soon / beta): AI insights, reports, unlimited goals — with email waitlist signup
   - This adds credibility and professional depth

8. **FAQ Section** — 8–10 questions with accordion animation:
   - "Is my financial data safe?"
   - "Can I import from my bank?"
   - "Does this work outside the US?"
   - "What AI model powers the insights?"
   - "Is there a mobile app?"
   - "Can I export my data?"
   - "How is my encryption key managed?"
   - "What happens if I delete my account?"

9. **Footer**
   - Logo + tagline
   - Links: Product, Company, Legal, Social
   - Newsletter signup (even if just stores email)
   - Copyright with current year (dynamic)
   - "Made with ♥ by [Your Name]" if appropriate

### Design Requirements:
- Color palette: Deep navy (`#0A0A1A`) background, electric indigo (`#6366F1`) primary, emerald (`#10B981`) for positive indicators, rose (`#F43F5E`) for negative. White text.
- Typography: `Geist` or `Inter` for body, a premium geometric sans for headings.
- Every section must have visible scroll-triggered animations (not instant load).
- Responsive: perfect on mobile (375px), tablet (768px), and desktop (1440px).
- `<meta>` tags: proper Open Graph image, Twitter card, canonical URL, and structured JSON-LD data for the organization.
- Lighthouse score target: 95+ on Performance, 100 on Accessibility, 100 on Best Practices, 100 on SEO.

---

## 🧩 PHASE 6 — UI COMPONENT SYSTEM

### 6.1 — Design Token System

Create `styles/tokens.css` (or extend Tailwind config) with a comprehensive design token set:

```typescript
// tailwind.config.ts additions
export default {
  theme: {
    extend: {
      colors: {
        background: { DEFAULT: '#0A0A1A', subtle: '#12121F', muted: '#1A1A2E' },
        surface: { DEFAULT: '#1E1E35', elevated: '#252540', overlay: '#2A2A4A' },
        border: { DEFAULT: '#2D2D50', muted: '#232340', strong: '#3D3D6B' },
        primary: { DEFAULT: '#6366F1', hover: '#4F52E0', light: '#818CF8' },
        success: { DEFAULT: '#10B981', light: '#34D399' },
        warning: { DEFAULT: '#F59E0B', light: '#FCD34D' },
        danger: { DEFAULT: '#F43F5E', light: '#FB7185' },
        text: { primary: '#F1F5F9', secondary: '#94A3B8', muted: '#64748B' },
      },
      boxShadow: {
        card: '0 0 0 1px rgba(255,255,255,0.05), 0 4px 24px rgba(0,0,0,0.4)',
        glow: '0 0 20px rgba(99,102,241,0.3)',
        'glow-success': '0 0 20px rgba(16,185,129,0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'count-up': 'countUp 0.8s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
};
```

### 6.2 — Component Library

Build or significantly extend these primitive components in `components/ui/`:

- `Button` — variants: primary, secondary, ghost, danger; sizes: sm, md, lg; loading state with spinner.
- `Card` — with optional header, footer, padding variants, and hover effect toggle.
- `Badge` — variants: default, success, warning, danger, info; with optional dot indicator.
- `Input` — with label, error message, helper text, left/right icon slot, and character count.
- `Select` — custom styled dropdown with search for long lists.
- `DatePicker` — custom calendar component with range selection.
- `Modal` — with Framer Motion entrance animation, focus trap, and escape key handling.
- `Drawer` — slides in from right, used for transaction detail view and AI chat.
- `Toast` / `Notification` — sonner or a custom implementation with success/error/info/warning variants.
- `Skeleton` — parametric skeleton with shimmer animation.
- `ProgressBar` — animated, with gradient fill and label.
- `StatCard` — for financial KPIs: icon, label, value (animated number), trend (% change with arrow).
- `EmptyState` — for every empty list: icon, title, description, and optional CTA button.
- `ConfirmDialog` — reusable confirmation modal with dangerous-action pattern.

---

## 📊 PHASE 7 — DATA LAYER & DATABASE

### 7.1 — Schema Improvements

Review the current database schema and ensure:

- [ ] Every table has `createdAt`, `updatedAt`, and `deletedAt` (soft delete pattern — never hard-delete financial records).
- [ ] Every user-owned record has `userId` as a non-nullable foreign key with proper database-level constraints.
- [ ] Financial amounts are stored as **integers in the smallest currency unit** (cents, not dollars) to avoid floating-point precision issues. Display layer handles formatting.
- [ ] Add a `currencies` table or enum supporting at least: USD, EUR, GBP, BDT, JPY, CAD, AUD, SGD, AED.
- [ ] Add database-level indexes on: `userId`, `categoryId`, `date`, `createdAt` for all frequently queried tables.
- [ ] Add a `audit_log` table that records every create/update/delete action with `userId`, `action`, `tableName`, `recordId`, `oldValues` (encrypted), `newValues` (encrypted), and `timestamp`. This is essential for financial applications.

### 7.2 — Service Layer

Create a `services/` directory that separates business logic from API route handlers:

```typescript
// services/transaction.service.ts
export class TransactionService {
  async getUserTransactions(userId: string, filters: TransactionFilters): Promise<Transaction[]> { ... }
  async createTransaction(userId: string, data: CreateTransactionDto): Promise<Transaction> { ... }
  async updateTransaction(userId: string, id: string, data: UpdateTransactionDto): Promise<Transaction> { ... }
  async deleteTransaction(userId: string, id: string): Promise<void> { ... }
  async getTransactionStats(userId: string, period: Period): Promise<TransactionStats> { ... }
}
```

---

## ♿ PHASE 8 — ACCESSIBILITY (a11y)

- [ ] Every interactive element must have proper `aria-label`, `role`, and keyboard navigation support.
- [ ] Color contrast must meet WCAG AA (4.5:1 for text, 3:1 for UI components) — run Lighthouse to verify.
- [ ] All charts must have a text alternative (`aria-label` describing the data, or a data table that becomes visible on keyboard focus).
- [ ] Modal dialogs must trap focus and return focus to the trigger on close.
- [ ] Form validation errors must be announced by screen readers using `aria-live="polite"`.
- [ ] Skip-to-content link as the first focusable element in the layout.
- [ ] All images must have meaningful `alt` text (not empty alt on non-decorative images).

---

## 🧪 PHASE 9 — DEVELOPER TOOLING & CODE STANDARDS

### 9.1 — Linting & Formatting

- [ ] Configure ESLint with: `eslint-config-next`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-jsx-a11y`, `eslint-plugin-tailwindcss`:
  ```json
  // .eslintrc.json
  {
    "extends": [
      "next/core-web-vitals",
      "plugin:@typescript-eslint/recommended-type-checked",
      "plugin:jsx-a11y/strict",
      "plugin:tailwindcss/recommended"
    ],
    "rules": {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/consistent-type-imports": "warn",
      "no-console": "error"
    }
  }
  ```
- [ ] Configure Prettier with:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2,
    "plugins": ["prettier-plugin-tailwindcss"]
  }
  ```
- [ ] Add `lint-staged` and `husky` pre-commit hook to run ESLint + Prettier on staged files.

### 9.2 — Comments & Documentation

Every file should have a **module-level JSDoc comment** explaining its purpose:

```typescript
/**
 * @module TransactionService
 * @description Business logic layer for transaction CRUD operations.
 * All methods enforce user-level authorization before database access.
 * Amounts are handled as integers (cents) throughout this service.
 */
```

Every non-obvious function should have a JSDoc comment explaining parameters, return value, and any side effects. This is what makes code look professional to reviewers — not volume, but clarity.

### 9.3 — Git & Commit History

- [ ] Clean up any accidental commits of `.env` files or secrets.
- [ ] Ensure `.gitignore` is comprehensive (includes: `.env*`, `node_modules`, `.next`, `dist`, `*.local`, `AUDIT.md`).
- [ ] The final state of the repo should have a clean, professional README.md with:
  - Project description and screenshots
  - Tech stack badges
  - Local setup instructions
  - Environment variable documentation
  - Architecture overview
  - Contributing guidelines

---

## 📋 PHASE 10 — FINAL POLISH & VERIFICATION

Before marking the project complete, run through this checklist:

### Performance
- [ ] Run `npm run build` — zero warnings, zero errors.
- [ ] Lighthouse audit on the landing page: 95+ performance, 100 accessibility, 100 best practices, 100 SEO.
- [ ] Lighthouse audit on the dashboard: 85+ performance (auth pages are harder to optimize).
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1.

### Security
- [ ] Run `npm audit` — zero critical or high vulnerabilities.
- [ ] Verify no API route is accessible without authentication (test manually with curl/Postman).
- [ ] Verify all environment variables are validated at startup.
- [ ] The `.agent` file and any other accidentally committed sensitive files are removed.
- [ ] Security headers are present (verify with securityheaders.com).

### Quality
- [ ] Zero TypeScript errors (`npx tsc --noEmit`).
- [ ] Zero ESLint errors (`npx eslint . --ext .ts,.tsx`).
- [ ] Zero `console.log` statements in production code.
- [ ] Zero `any` TypeScript types.
- [ ] Every page has a loading state, error state, and empty state.
- [ ] Every form has proper validation, error messages, and loading feedback.
- [ ] The app works correctly with JavaScript disabled (Server Components render properly).

### UX
- [ ] Test on mobile (375px width) — every page must be fully functional.
- [ ] Test on tablet (768px width).
- [ ] Test in both light and dark mode (if theme toggle exists).
- [ ] Test keyboard navigation through all pages.
- [ ] All animations respect `prefers-reduced-motion` media query:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
  ```

---

## 🔑 KEY PRINCIPLES TO MAINTAIN THROUGHOUT

1. **Every line has intent.** No dead code, no unused imports, no commented-out blocks left in.
2. **Consistency over cleverness.** Follow the same patterns throughout the codebase. A senior engineer reading any file should recognize the same conventions they saw in the previous file.
3. **Data integrity above all.** Financial applications must never lose, corrupt, or expose user data. Prefer explicit over implicit. Prefer verbose-but-clear over clever-but-obscure.
4. **User experience is a feature.** Slow pages, broken states, missing error messages, and jarring transitions are bugs — treat them as such.
5. **Privacy by design.** Encrypt sensitive data, minimize data collection, give users control over their data.
6. **The code tells a story.** Variable names, function names, and file names should communicate intent so clearly that comments are rarely needed.
7. **Professional finish.** Every public-facing string should be grammatically correct, every icon should be pixel-perfect, every color should be from the design token system.

---

## 📁 DELIVERABLES SUMMARY

When done, the project should have:
- `25,000–27,000+` lines of meaningful, well-structured TypeScript
- A landing page that would not look out of place on Product Hunt's front page
- A dashboard that rivals commercial products like YNAB or Copilot Money in polish
- Zero security vulnerabilities in the codebase itself
- A README that clearly explains the architecture, setup, and design decisions
- Code that reads like it was written by a thoughtful, experienced engineer

---

*Generated for the WealthAI project (github.com/me-nazat/budgetai). Execute each phase in sequence. Do not shortcut or stub any item — full implementation is required.*
