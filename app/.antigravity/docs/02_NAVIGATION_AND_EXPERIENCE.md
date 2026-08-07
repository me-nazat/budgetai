# 02 · Navigation & Experience — Wealth AI

## Objective

Deliver consistent, fluent navigation with a professional visual hierarchy.
The focus is the Sidebar, global page transitions, and landing-page hero while
keeping routing, accessibility, and rendering performance reliable.

## Sidebar

- Treat `src/components/Sidebar.tsx` as the shared app-navigation surface.
  Active navigation can use a shared-layout pill and restrained spring feedback,
  but every item must maintain an obvious selected state without animation.
- Preserve labels or provide accessible tooltips in any future icon-only
  collapsed mode. Use real links, keyboard focus, and sufficiently large touch
  targets.
- Theme switching may use a View Transition where supported, but must retain a
  non-animated fallback and run before the user sees a flash of the wrong theme.

## Page transitions

- `src/components/ui/PageTransition.tsx` should provide subtle route continuity
  using `AnimatePresence` and the shared transition presets in `src/lib/motion.ts`.
- Do not delay navigation, trap focus, animate an entire page excessively, or
  hide error/loading content. Reduced-motion users receive an immediate route
  change with content intact.

## Landing experience

- The hero can use a refined ambient mesh, responsive copy hierarchy, small
  parallax/tilt cues, and a clear primary CTA. Use `text-wrap: balance` where it
  improves headings, not on dense app data.
- Treat pointer effects as progressive enhancement. Coarse pointers,
  keyboard-only users, and reduced-motion users receive the static layout.
- Reserve visual dimensions and do not make hero animations part of LCP.

## Acceptance gates

- Sidebar, mobile menu, page transitions, and theme control remain fully usable
  with keyboard, touch, screen reader, and reduced motion.
- Navigation stays responsive on low-end mobile; motion clarifies direction
  rather than becoming a loading screen.
