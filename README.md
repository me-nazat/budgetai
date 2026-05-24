<div align="center">

<br/>

<!-- LOGO / HERO -->
<img src="https://i.ibb.co.com/1fqx85q3/2.png" alt="Wealth AI Logo" width="90" height="90" style="border-radius:20px"/>

<br/><br/>

# ✦ Wealth AI

### *The Intelligent Personal Finance Platform*

<br/>

[![Live Demo](https://img.shields.io/badge/🌐%20Live%20Demo-wealthai--red.vercel.app-10B981?style=for-the-badge&labelColor=0A0A0A)](https://wealthai-red.vercel.app)
&nbsp;
[![License](https://img.shields.io/badge/License-MIT-6366F1?style=for-the-badge&labelColor=0A0A0A)](LICENSE)
&nbsp;
[![Next.js](https://img.shields.io/badge/Next.js-14-ffffff?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=0A0A0A)](https://nextjs.org)
&nbsp;
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3B82F6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0A0A0A)](https://typescriptlang.org)

<br/>

[![Deploy](https://img.shields.io/badge/Deployed%20on-Vercel-ffffff?style=flat-square&logo=vercel&logoColor=white&labelColor=0A0A0A)](https://vercel.com)
&nbsp;
[![Database](https://img.shields.io/badge/Database-Turso%20%2F%20libSQL-00C1C1?style=flat-square&labelColor=0A0A0A)](https://turso.tech)
&nbsp;
[![AI](https://img.shields.io/badge/AI-Gemini%20%2B%20OpenRouter-8B5CF6?style=flat-square&labelColor=0A0A0A)](https://ai.google.dev)
&nbsp;
[![PWA](https://img.shields.io/badge/PWA-Ready-10B981?style=flat-square&labelColor=0A0A0A)](https://web.dev/progressive-web-apps)

<br/>

> **Wealth AI** is a premium, AI-powered personal finance web application built for people who take their money seriously. Track every transaction, model your financial future, split bills, scan receipts with AI, and get personalized financial coaching — all in one beautifully crafted platform.

<br/>

---

</div>

<br/>

## 📐 Table of Contents

- [✦ Overview](#-overview)
- [🌟 Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [📊 Codebase Statistics](#-codebase-statistics)
- [🔧 Tech Stack](#-tech-stack)
- [🛡️ Security](#️-security)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [🔌 Environment Variables](#-environment-variables)
- [📱 Mobile Experience](#-mobile-experience)
- [🤝 Contributing](#-contributing)

<br/>

---

<br/>

## ✦ Overview

<div align="center">

| Metric | Value |
|:---|:---|
| 📁 Total Project Files | `196` |
| 🔷 TypeScript Modules | `98 files` |
| ⚛️ React Components & Pages | `65 files` |
| 📝 Total Lines of Code | `30,533` |
| 💎 Pure Logic & Code | `23,284 lines` |
| 🖊️ Documentation Comments | `4,183 lines` |

</div>

<br/>

Wealth AI is engineered with **enterprise-grade architecture** on top of **Next.js 14 App Router**, featuring a repository pattern for clean data access, a service layer for business logic, and a multi-layered security framework. The entire UI is built around a near-black `#0A0A0A` design system with glassmorphism card components, smooth Framer Motion animations, and full responsiveness across all screen sizes.

<br/>

---

<br/>

## 🌟 Features

<br/>

### 〔 01 〕 &nbsp; Dashboard & Overview

> Your complete financial picture, at a glance.

- **Animated stat cards** with count-up number transitions and glassmorphism styling
- **Financial Health Score** — a 0–100 composite wellness score, computed from savings rate, budget adherence, net worth trend, emergency fund coverage, and spending consistency, displayed as an animated SVG arc gauge
- **Spending heatmap** — a full-year calendar heatmap of daily spending intensity (inspired by GitHub's contribution graph)
- **Net worth timeline** with AI-projected 6-month forecast (dashed overlay) and 1M / 3M / 6M / 1Y / All-time range toggles
- **Category donut chart** with drill-down: click any segment to expand into its sub-transactions in a slide-in panel
- **Shimmer skeleton loaders** across every data-fetching surface — no raw spinners, ever

<br/>

### 〔 02 〕 &nbsp; "My Month" Command Center

> An interactive monthly calendar as a full financial control room.

- Day cells styled as compact dashboard panels, animated in with **Framer Motion** stagger transitions
- Tap any day to open `DayDetailPopup` — full **CRUD** (Create, Read, Update, Duplicate, Delete) without leaving the view
- Visual indicators per day: income dots, expense dots, net delta badge
- Summary strip above the calendar: month totals, biggest category, days remaining

<br/>

### 〔 03 〕 &nbsp; Transaction Management

> Every dollar tracked with precision.

- Full CRUD for income and expenses with category, date, description, currency, and recurring flag
- **Swipe to delete** (with undo snackbar) and swipe to edit on mobile
- **Natural language input** — type "Spent 850 taka on groceries yesterday" and AI parses it into a pre-filled form
- **Smart Receipt Scanner** powered by **Gemini Vision** — upload or photograph a receipt, the AI extracts merchant, amount, date, and line items automatically
- **Bulk CSV import** with intelligent column-mapping UI and duplicate detection
- **Recurring transaction manager** with auto-generated future entries and a mini-calendar preview

<br/>

### 〔 04 〕 &nbsp; Budget Management

> Stay on track without the stress.

- Per-category monthly budgets with animated progress bars: green → amber at 75% → pulsing red at 90% → "Over Budget" badge at 100%
- **Budget rollover** toggle — unused amounts carry forward to next month
- **Custom budget periods**: weekly, bi-weekly, monthly, or fully custom date ranges
- **Budget Health Score** displayed as a circular arc gauge (0–100)
- Hover tooltip on any bar: spent / total, days remaining, projected end-of-month burn

<br/>

### 〔 05 〕 &nbsp; Net Worth Tracker

> Know exactly where you stand.

- Asset and liability ledger with full CRUD
- Net worth = total assets − total liabilities, computed in real time
- Area chart showing historical net worth with **AI-projected 6-month forecast** overlay
- Month-over-month delta card with directional color-coding

<br/>

### 〔 06 〕 &nbsp; Savings Goals

> Turn intentions into milestones.

- Named goals with target amount, current amount, and deadline
- Circular progress ring per goal with smooth CSS transition fill
- One-tap contribution flow — add to any goal without opening a form
- Overall savings rate card pinned to the top of the section

<br/>

### 〔 07 〕 &nbsp; AI Financial Coach

> Your personal finance advisor, available 24/7.

- Full **persistent chat interface** at `/coach` — a two-way conversational AI that knows your entire financial profile
- **Streaming responses** token-by-token via `ReadableStream`, powered by **OpenRouter** (`google/gemini-flash-1.5`)
- System prompt injected with: current month summary, top 3 spending categories, savings rate, active budget alerts, net worth, FIRE progress, and health score
- **Quick-prompt chips** when chat is empty: pre-built questions to get instant value
- Conversation history persisted in DB (last 50 messages loaded on open)
- Voice input support for hands-free financial queries

<br/>

### 〔 08 〕 &nbsp; What-If Financial Simulator

> Model your future before you live it.

- 6 interactive sliders: income change, dining spend, transport spend, shopping spend, monthly savings contribution, one-time windfall / expense
- Outputs update **in real time** (pure client-side math, zero API calls):
  - Projected net worth in 12 months vs current trajectory
  - Months until each savings goal is reached (delta shown)
  - Monthly surplus / deficit
  - FIRE date shift
- **Split area chart**: current trajectory (muted) vs simulated trajectory (accent), animating smoothly on every slider move
- "Save as Goal" button — locks simulated values as new budget targets

<br/>

### 〔 09 〕 &nbsp; FIRE Calculator

> Plan the day you work because you want to, not because you have to.

- Inputs: current net worth, monthly savings, expected annual return (slider), annual retirement spending, current age, target retirement age
- Outputs: FIRE number, years to FIRE, required monthly savings to hit target date
- **Three FIRE modes**: Lean FIRE (0.75× spending), Regular FIRE, Fat FIRE (1.5×)
- **Safe withdrawal rate sensitivity table** at 3% / 3.5% / 4% / 4.5%
- Projection area chart with a dashed FIRE Number threshold line and an animated "🎯 FIRE Point" marker at the intersection
- All calculations are **100% client-side** — your retirement data never leaves the browser

<br/>

### 〔 10 〕 &nbsp; Subscription Tracker

> Stop paying for things you forgot you had.

- Track every recurring subscription: name, amount, currency, billing cycle, next renewal date, category, logo
- Cards show a renewal countdown badge — red if ≤ 3 days away
- Summary bar: total monthly cost, total yearly cost, active vs paused count
- **AI Analysis** (Gemini): detects unused subscriptions (no related transactions in 60 days), overlapping services, and estimates potential monthly savings
- Renewal alerts auto-appear in the notification bell center 7 days before each renewal

<br/>

### 〔 11 〕 &nbsp; Bill Splitter

> Fair splits, every time.

- Enter bill total, description, participants (up to 10), and split mode: Equal, Percentage, or Custom Amount
- Live results panel updates as you type — see each person's share instantly
- "Add as Transaction" — saves your share as an expense with one tap
- "Copy Summary" — formatted text ready to paste into WhatsApp or any messenger
- Full split history saved in DB, filterable by settled / unsettled

<br/>

### 〔 12 〕 &nbsp; Gamified Achievements & Streaks

> Build better financial habits through play.

- **5 tracked habits**: daily transaction logging, budget adherence, savings contributions, AI coach usage, net worth growth
- **15 unlockable badges** across categories: first actions, milestones (Net Worth 1L / 10L / 25L BDT), streaks, and special achievements
- **4 user levels**: Bronze → Silver → Gold → Platinum — shown as a badge next to your username
- Confetti burst (`canvas-confetti`) + special "Achievement Unlocked" toast on every new badge
- 7-day dot grid per habit streak — flame icon pulses for streaks over 7 days

<br/>

### 〔 13 〕 &nbsp; Shareable Financial Snapshot

> Share your progress without sharing your secrets.

- Generates a **premium-branded PNG card** (800×450px, 2× pixel density) via `html2canvas` with: logo, selected month, 4 stat pills, net worth sparkline, category donut, and app watermark
- **Privacy controls**: toggle which stats to include, and optionally mask absolute numbers with relative metrics (e.g., "↑ 12% net worth growth" instead of raw figures)
- **Shareable link** (`/snapshot/[uuid]`) — a 30-day read-only public URL stored in DB, shareable with a financial advisor or anyone you choose
- Instant PNG download — saved to your device with a timestamped filename

<br/>

### 〔 14 〕 &nbsp; Multi-Currency Support

> Track money in every currency you use.

- Log any transaction in any ISO 4217 currency
- Live exchange rates fetched hourly from open.er-api.com and cached server-side
- All dashboards, charts, and budget comparisons auto-convert to your selected base currency (default: **BDT**)
- Original currency and amount shown in a secondary line beneath each converted figure
- Base currency changeable in Settings — UI updates instantly via React context

<br/>

### 〔 15 〕 &nbsp; Google Drive Auto-Sync

> Your financial data, always backed up and AI-ready.

- When a receipt or file is uploaded in the AI Coach, the app automatically:
  1. Verifies / creates a `Gemini/` root folder in your Drive
  2. Creates a sub-folder matching your username
  3. Creates a session-scoped sub-directory
  4. Uploads and indexes the file — making it instantly queryable by the AI
- Background sync pipeline runs silently without interrupting the UI

<br/>

---

<br/>

## 🏗️ Architecture

```
src/
│
├── app/                          # Next.js 14 App Router
│   ├── (app)/                    # 🔒 Authenticated views (protected routes)
│   │   ├── overview/             #    Dashboard, health score, charts
│   │   ├── my-month/             #    Interactive monthly calendar
│   │   ├── coach/                #    AI Financial Coach chat
│   │   ├── simulator/            #    What-If Simulator
│   │   ├── fire/                 #    FIRE Calculator
│   │   ├── subscriptions/        #    Subscription Tracker
│   │   ├── achievements/         #    Badges & Streaks
│   │   └── settings/             #    Profile, theme, currency, data export
│   │
│   └── api/                      # ⚡ Serverless API Routes
│       ├── auth/                  #    Login, register, refresh, logout, lockout
│       ├── transactions/          #    CRUD + bulk import + recurring
│       ├── budgets/               #    Budget CRUD + health score
│       ├── ai/                    #    Coach, scan-receipt, parse-transaction, anomalies
│       ├── health-score/          #    Financial health computation
│       ├── exchange-rates/        #    Live currency rates (cached)
│       └── snapshot/              #    Public snapshot generation & retrieval
│
├── components/                   # ♻️  Reusable UI System
│   ├── charts/                   #    Recharts + Chart.js wrappers
│   ├── modals/                   #    All modal / bottom-sheet components
│   ├── ui/                       #    Primitive components (Button, Card, Badge, Toast)
│   └── layout/                   #    Sidebar, BottomNav, TopBar, CommandPalette
│
├── db/                           # 🗄️  Database Layer
│   ├── client.ts                 #    Turso libSQL client singleton
│   └── schema.ts                 #    Table definitions & migration helpers
│
├── repositories/                 # 📦 Data Access Objects (raw SQL, parameterized)
│   ├── transaction.repository.ts
│   ├── budget.repository.ts
│   ├── user.repository.ts
│   └── coach.repository.ts
│
├── services/                     # ⚙️  Business Logic Layer
│   ├── auth.service.ts           #    JWT, bcrypt, refresh rotation
│   ├── health-score.service.ts   #    Score formula & sub-metric computation
│   ├── badge.service.ts          #    Achievement evaluation engine
│   └── sync.service.ts           #    Google Drive pipeline
│
├── lib/                          # 🔧 Utilities & Cross-cutting Concerns
│   ├── auth.ts                   #    requireAuth() middleware helper
│   ├── env.ts                    #    Zod-validated environment variable schema
│   ├── motion.ts                 #    Framer Motion variant system (fadeUp, stagger…)
│   ├── validators/               #    Zod schemas for every API input
│   └── security/
│       ├── account-lockout.ts    #    Brute-force protection
│       └── rate-limiter.ts       #    Sliding-window rate limiting
│
└── hooks/                        # 🪝  Custom React Hooks
    ├── useCurrency.ts            #    Base currency context & conversion
    ├── useHealthScore.ts         #    Score polling & cache
    ├── useStreaks.ts             #    Habit streak computation
    └── useCommandPalette.ts      #    Cmd+K state management
```

<br/>

---

<br/>

## 📊 Codebase Statistics

<div align="center">

```
 ┌─────────────────────────────────────────────────────────────┐
 │                   WEALTH AI  ·  CODEBASE                    │
 ├──────────────────────────┬──────────────────────────────────┤
 │  TypeScript Modules      │  ████████████████████  98 files  │
 │  React Components (TSX)  │  █████████████         65 files  │
 │  CSS / Stylesheets       │  ▌                      2 files  │
 │  Config & Other          │  ██████                31 files  │
 ├──────────────────────────┴──────────────────────────────────┤
 │  Total Tracked Lines     │                          30,533  │
 │  Pure Code Lines         │  ██████████████████████  23,284  │
 │  Comment Lines           │  ████                    4,183  │
 │  Blank / Spacing         │  ███                     3,066  │
 └──────────────────────────┴──────────────────────────────────┘
```

</div>

<br/>

---

<br/>

## 🔧 Tech Stack

<br/>

<div align="center">

| Layer | Technology | Purpose |
|:---|:---|:---|
| **Framework** | Next.js 14 (App Router) | Full-stack React with server components & API routes |
| **Language** | TypeScript (strict) | End-to-end type safety, zero `any` tolerance |
| **Styling** | Tailwind CSS | Utility-first responsive design system |
| **Animations** | Framer Motion | Page transitions, stagger reveals, micro-interactions |
| **Charts** | Recharts + Chart.js | Area, donut, bar, sparkline, and arc gauge charts |
| **Database** | Turso (libSQL) | Edge-deployed SQLite — fast global reads |
| **Auth** | JWT + bcrypt | httpOnly cookies, refresh rotation, account lockout |
| **AI — Insights** | Google Gemini API | Receipt scanning, NL transaction parsing, anomaly alerts |
| **AI — Coach** | OpenRouter API | Streaming conversational AI with full financial context |
| **Storage** | Google Drive API | Receipt backup and AI-queryable document sync |
| **Currency** | open.er-api.com | Hourly live exchange rates (server-side cached) |
| **PWA** | next-pwa + Workbox | Offline shell caching, install prompt, service worker |
| **Export** | jsPDF + html2canvas | PDF monthly reports, PNG snapshot cards |
| **Deployment** | Vercel | Edge functions, automatic HTTPS, zero-config CI/CD |

</div>

<br/>

---

<br/>

## 🛡️ Security

Wealth AI is built with a defense-in-depth philosophy. Financial data deserves bank-level protection.

<br/>

```
Security Layers
│
├── 🔐  Authentication
│   ├── JWT access tokens (15-min expiry) in httpOnly + Secure + SameSite=Strict cookies
│   ├── Refresh tokens (7-day expiry) with one-time-use rotation — stored as bcrypt hash
│   └── bcrypt password hashing at cost factor 12
│
├── 🚧  API Protection
│   ├── requireAuth() middleware enforced on every private route
│   ├── Sliding-window rate limiter: 5 req/min on auth, 60 req/min on all others
│   ├── Zod schema validation on every request body — unknown fields stripped
│   └── Parameterized SQL only — zero string-concatenated queries
│
├── 🌐  HTTP Security Headers
│   ├── Content-Security-Policy (strict, no unsafe-eval)
│   ├── Strict-Transport-Security (max-age=63072000, preload)
│   ├── X-Frame-Options: DENY
│   ├── X-Content-Type-Options: nosniff
│   ├── Referrer-Policy: strict-origin-when-cross-origin
│   └── Permissions-Policy: camera=(), microphone=(), geolocation=()
│
├── 🔒  Data Protection
│   ├── All secrets are server-only env vars — zero client bundle exposure
│   ├── Source maps disabled in production (productionBrowserSourceMaps: false)
│   ├── X-Powered-By header removed (poweredByHeader: false)
│   └── DOMPurify sanitization on all user-supplied strings before DB write
│
└── 🛑  Account Security
    ├── Account lockout: 5 failed logins → 15-min IP block with exponential backoff
    ├── Change-password route invalidates ALL existing refresh tokens on success
    └── Logout route clears both cookies and revokes refresh token in DB
```

<br/>

---

<br/>

## 🚀 Getting Started

<br/>

### Prerequisites

- **Node.js** `≥ 18.17.0`
- **npm** `≥ 9.x` or **pnpm** `≥ 8.x`
- A [Turso](https://turso.tech) database (free tier works)
- A [Google AI Studio](https://aistudio.google.com) Gemini API key
- An [OpenRouter](https://openrouter.ai) API key

<br/>

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/me-nazat/budgetai.git
cd budgetai

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env.local
# → Fill in all required values (see Environment Variables section below)

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

<br/>

### Production Build

```bash
npm run build    # Type-check + compile
npm run start    # Start production server
```

<br/>

---

<br/>

## 📁 Project Structure

```
budgetai/
├── src/                  # All application source code
│   ├── app/              # Next.js App Router (pages + API routes)
│   ├── components/       # Reusable UI component library
│   ├── db/               # Database client & schema
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities, AI wrappers, security, motion config
│   ├── repositories/     # Data access layer (raw SQL, parameterized)
│   └── services/         # Business logic & domain services
├── public/               # Static assets (logo, icons, manifest)
├── .env.example          # Environment variable template
├── next.config.ts        # Next.js + security headers config
├── tailwind.config.ts    # Design system tokens
├── tsconfig.json         # TypeScript strict config
├── ARCHITECTURE.md       # Full system architecture documentation
├── SECURITY.md           # Security measures & vulnerability reporting
├── CHANGELOG.md          # Full version history of features
└── package.json
```

<br/>

---

<br/>

## 🔌 Environment Variables

Create a `.env.local` file in the root with the following keys:

```dotenv
# ─── AI ───────────────────────────────────────────────────────
GEMINI_API_KEY=                   # Google Gemini API key
OPENROUTER_API_KEY=               # OpenRouter API key

# ─── Authentication ───────────────────────────────────────────
JWT_SECRET=                       # Strong random secret (min 32 chars)

# ─── Database ─────────────────────────────────────────────────
TURSO_DATABASE_URL=               # libsql://your-db.turso.io
TURSO_AUTH_TOKEN=                 # Turso auth token

# ─── Google Drive ─────────────────────────────────────────────
GOOGLE_DRIVE_OAUTH_CLIENT_ID=     # OAuth 2.0 client ID
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET= # OAuth 2.0 client secret
GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN= # Refresh token from OAuth flow
GOOGLE_DRIVE_ROOT_FOLDER_ID=      # Root Drive folder ID for uploads
```

> ⚠️ **Never commit `.env.local` to version control.** All variables above are server-side only — none are prefixed with `NEXT_PUBLIC_` and none appear in the client bundle.

<br/>

---

<br/>

## 📱 Mobile Experience

Wealth AI is **not** a desktop app with a scaled-down mobile view. The mobile layout is a completely separate, purpose-built experience.

<br/>

| Feature | Desktop | Mobile |
|:---|:---|:---|
| Navigation | Fixed left sidebar | Bottom tab bar (5 tabs) |
| Modals | Centered overlays | Full-screen bottom-sheet drawers with drag handle |
| Charts | 320px height, multi-column | 220px height, full viewport width |
| Grids | 3–4 column card grids | Single-column stacked cards |
| Inputs | Standard browser behaviour | `font-size: 16px` enforced (prevents iOS zoom) |
| Safe Area | N/A | `env(safe-area-inset-bottom)` padding on all screens |
| Scroll | Vertical page scroll | Pull-to-refresh with overscroll gesture |
| Touch Targets | Default | Minimum `44×44px` on all interactive elements |

<br/>

All animations respect `prefers-reduced-motion` — users with vestibular disorders will receive simplified, accessible transitions throughout.

<br/>

---

<br/>

## 🤝 Contributing

Contributions are welcome. Please follow the existing code conventions:

1. **Fork** this repository and create a feature branch (`git checkout -b feat/my-feature`)
2. Follow the **TypeScript strict** rules — no `any` types, no unused imports
3. Validate all API inputs with **Zod** schemas in `src/lib/validators/`
4. Use the existing **motion variants** from `src/lib/motion.ts` — do not write inline animation objects
5. Test your change at **375px** (mobile), **768px** (tablet), and **1280px** (desktop) before submitting
6. Run `npm run build` and confirm zero TypeScript errors
7. Submit a **pull request** with a clear description of what you changed and why

<br/>

To report a security vulnerability, please read [`SECURITY.md`](SECURITY.md) before opening a public issue.

<br/>

---

<br/>

<div align="center">

**Built with precision. Designed for clarity. Powered by intelligence.**

<br/>

[![wealthai-red.vercel.app](https://img.shields.io/badge/🌐%20Visit%20Live%20App-wealthai--red.vercel.app-10B981?style=for-the-badge&labelColor=0A0A0A)](https://wealthai-red.vercel.app)

<br/>

<sub>© 2025 Wealth AI · MIT License · Made by <a href="https://github.com/me-nazat">me-nazat</a></sub>

<br/><br/>

</div>
