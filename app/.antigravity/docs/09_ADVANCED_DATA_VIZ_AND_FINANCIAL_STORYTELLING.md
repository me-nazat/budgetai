# 09 · Advanced Data Visualization & Financial Storytelling — Wealth AI

## Goal

Add optional, data-backed visuals that help people understand cashflow,
spending patterns, net-worth volatility, and forecast uncertainty. A chart is
useful only when its values, labels, and source data can be explained.

## Candidate visualizations

1. Cashflow Sankey: income sources flowing into categories.
2. Net-worth topography: layered historic value and volatility context.
3. Spending heatmap: daily intensity with an accessible selected-day summary.
4. Forecast confidence cone: historical line plus explicitly labelled estimate
   and uncertainty range.
5. Category treemap: spending or asset proportions with a text/table fallback.

## Implementation rules

- Put custom visualizations beneath `src/components/viz/` and use dynamic
  imports with `ssr: false` for D3-only code. Do not add D3 until a real page
  has the supporting data shape and product need.
- Generate paths from validated, typed data. Scope SVG gradient IDs per chart
  instance to prevent collisions. Give every chart a title/description or an
  adjacent data-table alternative.
- Animate paths with `pathLength` only after the visualization is visible; use
  final static paths in reduced-motion mode.
- Sankey hover/focus should highlight connected flows, but mouse hover cannot
  be the sole method of identifying a flow.
- Forecasts must state that they are estimates, show their period, and never
  imply certainty. Avoid deceptive visual smoothing or an unlabelled cone.

## Acceptance gates

- No visualization blocks LCP or causes clipping at supported card sizes.
- D3 is absent from the server bundle and a visual skeleton maintains layout.
- Keyboard, screen-reader summary, mobile tooltip/focus behaviour, and empty
  data are verified for each visualization.
