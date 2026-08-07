# Wealth AI agent guide

This repository is a Next.js 16 / React 19 personal-finance application. Before
changing product code, read the roadmap and the relevant enhancement brief:

- `LIQUID_REDESIGN_ROADMAP.md` is the source of truth for delivery order.
- `.antigravity/docs/01_FOUNDATION_AND_DESIGN_SYSTEM.md`
- `.antigravity/docs/02_NAVIGATION_AND_EXPERIENCE.md`
- `.antigravity/docs/03_DATA_INTELLIGENCE_DASHBOARD_ANALYTICS_STATS.md`
- `.antigravity/docs/04_FINANCIAL_LEDGER_AND_OPERATIONS.md`
- `.antigravity/docs/05_SVG_ENHANCEMENT_AND_MICRO_INTERACTIONS.md`
- `.antigravity/docs/06_ADVANCED_FLUID_ANIMATION_AND_MOTION_SYSTEM.md`
- `.antigravity/docs/07_PROFESSIONAL_UI_POLISH_AND_VISUAL_HIERARCHY.md`
- `.antigravity/docs/08_PERFORMANCE_OPTIMIZATION_AND_LOADING_ARCHITECTURE.md`
- `.antigravity/docs/09_ADVANCED_DATA_VIZ_AND_FINANCIAL_STORYTELLING.md`
- `.antigravity/docs/10_SPATIAL_UX_AND_CINEMATIC_DEPTH.md`
- `.antigravity/docs/11_HAPTIC_MICRO_INTERACTIONS_AND_TACTILE_UI.md`
- `.antigravity/docs/12_EDGE_COMPUTING_AND_ULTRA_FAST_STATE_ARCHITECTURE.md`

## Operating rules

1. Work through the roadmap in focused, reviewable phases. Do not mix
   unrelated areas in one change set.
2. Reconcile every brief with the real tree first. In this repo motion tokens
   live in `src/lib/motion.ts`, not the illustrative paths used in some briefs.
3. Use existing tokens and `framer-motion` 12. Every non-essential animation
   must have a `prefers-reduced-motion` / `useReducedMotion` fallback.
4. Keep data routes and authenticated data secure. Do not turn an existing
   Server Component into a Client Component merely for decoration.
5. Treat File 08 and File 12 performance limits as merge gates. Verify each
   focused change with `npm run typecheck` and the relevant tests before handoff.

## Recommended execution order

Foundation and navigation (01, 02) → data intelligence and financial workflows
(03, 04) → performance and loading foundations (08, 12) → shared motion and
SVG primitives (06, 05) → surface polish and spatial interaction (07, 10, 11)
→ optional, data-backed visualizations (09). Add visual effects only where they
clarify a financial decision or improve feedback; preserve accessible keyboard
and touch behaviour.
