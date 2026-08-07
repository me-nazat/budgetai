# 10 · Spatial UX & Cinematic Depth — Wealth AI

## Goal

Use subtle spatial depth to reinforce hierarchy on the landing page and
selected dashboard cards without WebGL or re-rendering on every pointer move.

## Deliverables

- Landing hero: a maximum four-layer parallax stack—background mesh (0.2x),
  visual widget (0.5x), copy (1x), and optional foreground details (1.5x).
  Use CSS scroll timelines where supported and a static fallback elsewhere.
- `SpotlightCard`: use Framer Motion values and a spring to position a soft
  radial glow over dark, textured cards. Do not use React state per mouse move.
- `TiltCard`: apply a restrained 3D tilt (maximum 7 degrees) with glare.
  Preserve the existing public API where `src/components/ui/TiltCard.tsx`
  already exists, or migrate call sites as one focused change.

## Constraints

- Transform and opacity only for pointer interactions; never layout changes.
- Disable parallax, tilt, and pointer spotlights for reduced motion, coarse
  pointers, and keyboard-only interaction. The unanimated card must retain all
  information and focus treatment.
- Do not introduce pinned scroll scenes that obscure a user’s ability to reach
  content or degrade touch scrolling.

## Acceptance gates

- No visible input lag or frame drops under pointer movement; target TBT below
  150 ms on an affected page.
- Card content remains readable and clickable while transformed.
- Supported browser enhancement is progressive; unsupported browsers display
  the normal static composition.
