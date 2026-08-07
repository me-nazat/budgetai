# 05 · SVG Enhancement & Micro-Interaction Layer — Wealth AI

## Goal

Use a small, inline SVG system to make financial surfaces crisp and tactile
without adding image requests or an icon-heavy client bundle. Prefer a hidden
`<symbol>` sprite rendered once in the root layout and a lightweight `Icon`
wrapper. Prune the sprite to icons actually in use and keep it below roughly
6 KB gzipped.

## Deliverables

- Add `IconSprite`, `Icon`, and an animated checkmark under `src/components/ui/`.
  Give SVGs explicit dimensions, `viewBox` values, `currentColor` strokes, and
  non-focusable semantics unless they convey information.
- Add a fixed-height `SvgDivider` for appropriate section boundaries. Draw it
  on entry with `pathLength`; render its final state immediately for reduced
  motion.
- Add a tiny, static `public/grain.svg`, then a low-opacity `.grain::after`
  utility in `src/app/globals.css`. Limit grain to hero, modal, and chart-card
  surfaces; never apply it to ledger rows.
- Add an animated brand mark only if it replaces rather than duplicates the
  existing logo. Its first-paint animation must remain under 600 ms.
- Use SVG accents for chart peaks and category badges where they increase
  legibility. Magnetic icon buttons are optional desktop polish; they must be
  ordinary, keyboard-operable buttons and reset on pointer leave.

## Motion and accessibility contract

- Use `useReducedMotion`; path draws render fully drawn, magnetic translation
  is disabled, and scroll CSS runs only in
  `@media (prefers-reduced-motion: no-preference)`.
- Preserve focus states, Enter/Space activation, text alternatives, and target
  size. A hover-only affordance is not a valid action.
- Use theme tokens, not hard-coded light/dark colors. Texture opacity is lower
  in light mode.

## Acceptance gates

- No layout shift from an SVG, icon sprite, divider, or logo.
- No unbounded SVG filters or animated turbulence.
- `rg 'from ["'"']lucide-react' src` is reduced only after equivalent icons are
  represented in the sprite; do not remove needed application icons blindly.
- Verify light, dark, keyboard, touch, and reduced-motion paths.
