/**
 * Liquid & Fluent — motion tokens
 * ---------------------------------------------------------------------------
 * A single source of truth for spring physics across Wealth AI.
 *
 * The codebase currently hand-rolls `{ type: 'spring', stiffness, damping }`
 * in ~40 places across ~19 components, with values drifting between callers
 * that are doing the same job (e.g. 400/30, 400/25, 380/30, 420/28 all used
 * for "snappy UI state change"). That drift is what makes an interface feel
 * inconsistent even when every individual animation is smooth. These presets
 * fix the physics per *purpose*, not per file, and are named after when to
 * reach for them rather than what numbers they contain.
 *
 * Usage:
 *   import { springSnap } from '@/lib/motion';
 *   <motion.div layoutId="active-pill" transition={springSnap} />
 */
import type { Transition } from 'framer-motion';

/** Small UI state changes: nav pills, tabs, toggles, checkboxes, badges. */
export const springSnap: Transition = { type: 'spring', stiffness: 400, damping: 30 };

/** Cards, dropdowns, modals entering/exiting, layout reflow. */
export const springSmooth: Transition = { type: 'spring', stiffness: 300, damping: 30 };

/** Large surfaces: page transitions, hero elements, sheet/drawer panels. */
export const springGentle: Transition = { type: 'spring', stiffness: 220, damping: 26 };

/** Celebratory or attention-getting: achievement unlocks, goal-met states. */
export const springBouncy: Transition = { type: 'spring', stiffness: 380, damping: 18 };


/** Continuous pointer tracking: tilt cards, magnetic buttons, glare/glow follow. */
export const springTrack = { stiffness: 300, damping: 20 };

/** Press feedback for `whileTap`. Fast settle, minimal overshoot. */
export const springTap: Transition = { type: 'spring', stiffness: 400, damping: 17 };

/** Non-spring "liquid" ease for opacity/color/blur transitions where a spring would overshoot oddly. */
export const EASE_LIQUID = [0.22, 1, 0.36, 1] as const;
