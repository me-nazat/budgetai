# 11 · Haptic-Grade Micro-Interactions & Tactile UI — Wealth AI

## Goal

Make frequent interactions feel responsive while preserving the caution needed
for financial actions. Feedback must never hide, accidentally trigger, or make
irreversible actions easier to perform by mistake.

## Deliverables

- `SwipeableRow` under `src/components/transactions/`: drag left to reveal
  labelled edit/delete actions. Keep button actions keyboard accessible and
  require an explicit delete confirmation where current product behaviour does.
  A partial swipe returns smoothly; it must not delete a record.
- `LiquidInput` under `src/components/ui/`: a focus-visible SVG border/glow
  that draws only for users without reduced-motion preference. It must forward
  standard input props, id, value, name, refs, errors, and `aria-*` attributes.
- `ParticleBurst` under `src/components/achievements/`: deterministic,
  short-lived particles (at most 20) around a confirmed achievement unlock.
  Use a stable particle layout rather than calling `Math.random()` in render.
- Tactile toggles: use native semantic inputs or buttons with accurate checked
  state, press feedback, and an immediate non-motion fallback.

## Acceptance gates

- Gestures have `touch-action` rules and do not conflict with vertical scroll.
- Every revealed action can be reached by keyboard and announced by a label.
- Particle nodes are removed after completion; no animation runs in reduced
  motion; the interaction can be repeated without stale state.
- All high-impact actions retain their existing confirmation and undo logic.
