# Changelog

All notable changes to WealthAI are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-09-08

### Added
- **Schema Reconciliation**: Consolidated legacy and new schema generations for Modules 10–19 into canonical files in `src/db/schema/` with zero shadowing.
- **Global Navigation Parity**: Unified `NAVIGATION_REGISTRY` mapping 100% of routes across Desktop Sidebar, Mobile Drawer Menu, and Command Palette.
- **Module 10 (Household Finance)**: Deep-linked `/household/[id]` workspace with allocation wheel, recurring bill auto-splits, and minimal debt settlements.
- **Module 11 (Peer Benchmarking)**: Demographic onboarding wizard, k-anonymity validation ($k \ge 30$), and radar percentile drilldowns.
- **Module 12 (Tax Deduction Vault)**: Inline tax tagging pills, certified PDF/Excel fiscal report generation, and 30-day view-only accountant links.
- **Module 13 (Document Vault)**: Semantic vector embeddings search and natural language conversational document Q&A.
- **Module 14 (Global Privacy Mode)**: Integrated `X-Privacy-Mode` header client/server redaction, inactivity lock screen, and `/settings/privacy` configuration.
- **Module 15 (Micro-Savings Round-Ups)**: Transaction creation hook, dashboard pending round-ups strip, escrow sweep engine, and milestone celebration confetti.
- **Module 16 (Statement Import)**: Multi-page PDF parser, side-by-side reconciliation queue with match confidence scoring, and atomic commit transactions.
- **Module 17 (Bilingual Localization)**: Full English and Bengali (বাংলা) support with native numeral conversions and locale formatters.
- **Module 18 (Calendar Synchronization)**: Google Calendar sync settings, morning-of scheduled push notifications, and sync audit logs.
- **Module 19 (Autonomous AI Actions)**: Action confirmation cards with Apply/Reject controls, 5-second undo toast, and Unified Insights Hub at `/insights`.

### Fixed
- Fixed mobile navigation drawer omitting `/investments`.
- Fixed `/analytics` orphan route by integrating into the centralized navigation registry.
- Fixed dead footer links on landing page.
- Centralized `.safe-bottom` padding in `globals.css` to respect mobile safe area insets.

## [1.0.0] - Initial Release
- Core budgeting, manual transaction tracking, net worth calculator, and initial AI chat assistant.
