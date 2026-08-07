# 07 · Professional UI Polish & Visual Hierarchy — Wealth AI

## Goal

Refine Wealth AI toward modern private-banking clarity: a calm typography
rhythm, deliberate density, clear financial hierarchy, and credible trust
signals. This is a visual audit after the components are functional—not a
reason to replace working data flows.

## Audit sequence

1. Inventory existing typography, spacing, surface, border, shadow, and color
   tokens in `globals.css` and the shared components.
2. Resolve conflicts by consolidating on semantic tokens. Preserve contrast,
   including error, pending, and success states.
3. Check each density tier: app header, stat cards, ledger summary, ledger row,
   empty state, modal, and mobile breakpoint.
4. Verify equivalent visual hierarchy in light and dark themes.

## Target patterns

- Use a display serif only for major financial narrative headings; interface
  controls and ledger details retain the existing readable sans face.
- Use tabular numerals and right-aligned amounts in the ledger. Negative,
  pending, and incoming states must be distinguishable without color alone.
- Create depth with existing surface, border, and shadow tokens rather than
  image chrome or excessive gradients. Keep corner radii and 4px spacing steps
  consistent.
- Add concise trust badges only when substantiated by actual product behaviour
  (for example local encryption or bank-grade security claims must be true).
- Apply compact chart/summary layouts through container queries where that
  avoids duplicate components.

## Acceptance gates

- Primary next action and primary financial value are visually obvious on every
  audited screen.
- Dense tables remain scannable at desktop and touch-friendly on mobile.
- WCAG contrast, focus visibility, theme parity, and empty/error/loading
  states are verified before calling a surface polished.
