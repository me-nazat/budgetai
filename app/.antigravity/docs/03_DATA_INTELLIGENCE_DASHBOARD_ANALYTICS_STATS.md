# 03 · Data Intelligence — Dashboard, Analytics & Stats

## Objective

Make the dashboard an institutional-quality financial overview: clear hierarchy,
high-performance loading, meaningful interaction, and smooth but restrained
motion. Work in `src/app/(app)/dashboard/page.tsx` and its focused dashboard /
chart components; retain secure, typed data flows.

## Page composition

- Use a page-level stagger only for direct major regions. A container can fade
  in, then reveal children with a short stagger; card items use shared spring
  presets rather than local stiffness/damping values. Reduced motion renders
  final content immediately.
- Show a `DashboardSkeleton` with matching dimensions while data is unavailable.
  Use the established `shimmer-skeleton` class and avoid skeleton-to-data layout
  shifts.
- Header: personalized greeting, concise financial-status context, and a
  labelled month selector that updates data predictably.

## Quick statistics

- Present four principal metrics in a responsive grid. Use the existing
  `TiltCard` only as optional fine-pointer polish; the stat, trend direction,
  label, and current period remain clear when static.
- Animate value changes with the existing counter primitive and tabular figures.
  Use a semantic visual/textual indicator for increases and decreases; green and
  red backgrounds alone are insufficient.
- Use the existing Material Symbols integration consistently with labelled
  metric context.

## Visualizations

- Cash Flow Dynamics: dynamically load the Chart.js client visualization when
  needed. Plot daily earnings and expenses with rounded bars, an accessible
  legend, meaningful tooltips, and a reserved chart frame. Suggested semantic
  colors are emerald for earnings and blue for expenses, subject to theme token
  contrast.
- Asset Allocation: dynamically load the doughnut chart; use a clearly labelled
  total, category-color mapping from `getCategoryHex`, and a ranked category
  list below it. Provide an adjacent text summary for assistive technology and
  zero/empty data.
- Do not make charts block LCP, fetch data twice, or introduce unbounded canvas
  resizing.

## Bottom row

- Recent Activity shows a short, interactive transaction preview. Rows may have
  a restrained hover translation but must offer keyboard focus and open the
  existing `TransactionDetailModal` reliably.
- The Intelligence Hub displays backed AI insights and alerts in a calm glass
  surface. Actionable advice must identify its relevant data/timeframe and not
  masquerade as a guaranteed prediction.

## Acceptance gates

- Dashboard animations are limited, shared-preset based, and reduced-motion
  safe. Skeleton, empty, error, and loaded states preserve the same layout.
- Charts are dynamically imported with a useful fallback and do not increase
  initial-route JavaScript unnecessarily.
- Validate current-period labels, currency formatting, tooltips, chart summaries,
  keyboard behavior, dark/light parity, and production performance.
