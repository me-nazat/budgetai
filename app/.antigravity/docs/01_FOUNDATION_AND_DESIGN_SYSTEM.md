# 01 · Foundation & Design System — Wealth AI

## Objective

Establish a premium, modern private-banking design language that is professional,
smooth, liquid, fluent, and fast. `src/app/globals.css` is the shared styling
source of truth; preserve the existing Next.js/Tailwind architecture when
evolving it.

## Design principles

- Use deliberate hierarchy: a prestige serif for key financial narrative
  headings, a legible sans face for controls and dense data, and tabular
  numerals for values.
- Build a calm palette around deep slate / soft white surfaces, subtle borders,
  indigo-blue primary actions, a complementary secondary accent, and semantic
  positive/negative financial states. Do not use color as the sole signal.
- Keep spacing on a consistent base grid and use the established large and
  fluent radius scales rather than inventing local radii.
- Add depth with tokenized glass surfaces, restrained shadows, and static or
  very low-cost ambient treatments—not image chrome or expensive filters.

## Global CSS requirements

- Retain `@import "tailwindcss"`, the existing custom dark-mode selector, and
  semantic design tokens. Align fonts with the variables configured in
  `src/app/layout.tsx` (`Geist`, `Outfit`, `Playfair Display`, and `Fraunces`).
- Provide utilities for `glass`, `glass-premium`, balanced text, tabular
  numerals, shimmer skeletons, and the app’s ambient mesh only when they are
  genuinely reused.
- Apply font feature settings and antialiasing in the base layer. Every heading
  should use a compatible prestige face without degrading Bengali or screen
  reader content.
- Style scrollbars lightly and retain native accessibility. Respect
  `prefers-reduced-motion`: aurora, glow, ripple, and similar decorative
  animation must stop or show a static final state.

## Acceptance gates

- Theme tokens work on every app surface in both modes, including focus, error,
  pending, and disabled states.
- Text contrast, tabular value alignment, keyboard focus, and mobile density
  are validated before a global-token change lands.
- No global animation adds layout shift or blocks first paint.
