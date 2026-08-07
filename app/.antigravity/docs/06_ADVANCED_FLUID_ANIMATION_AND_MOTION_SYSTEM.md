# 06 · Advanced Fluid Animation & Motion System — Wealth AI

## Goal

Turn isolated animations into a restrained, consistent motion language. Motion
should explain a state change, preserve spatial continuity, or provide tactile
feedback—not decorate every financial value.

## Repository alignment

The current source of truth is `src/lib/motion.ts`. Extend that module rather
than creating a competing `src/lib/motion/springs.ts` directory. Existing names
include `springSnap`, `springSmooth`, `springGentle`, `springBouncy`,
`springTrack`, and `springTap`; add only clearly differentiated presets and
typed variants.

## Deliverables

- Configure shared reduced-motion behaviour once at the app root. If adopting
  `LazyMotion`, first audit all motion imports and migrate deliberately; do not
  enable strict mode while direct `motion.*` imports remain.
- Provide composable wave/expand/reveal variants and `Stagger` / `StaggerItem`
  wrappers. Never nest staggers around large trees.
- Maintain a small `layoutId` registry for recurring morphs such as the
  sidebar pill and period switches. IDs must be unique per feature instance.
- Provide `RevealOnScroll`, `AnimatedNumber` (with tabular figures), and a
  magnetic CTA primitive only where it serves the existing landing or app UI.
- Prefer CSS `animation-timeline` for visual-only scroll reveals, with a
  Framer Motion fallback for browsers without support.

## Constraints

- Use existing named transitions—no ad-hoc stiffness/damping values in feature
  code. Keep at most three concurrent spring interactions in a viewport.
- Cap full-page blur at 6px and use `layout` only on changing layout.
- For `prefers-reduced-motion`, preserve final content and interaction with no
  transform-driven transition. Smooth scrolling must fall back to native scroll.

## Acceptance gates

- Page transitions distinguish forward and backward navigation only if the
  navigation source reliably provides a direction.
- Counters use tabular numerals and do not animate money past its valid value.
- All motion is keyboard, pointer, and reduced-motion safe; typecheck and
  inspect the affected route for dropped frames before merging.
