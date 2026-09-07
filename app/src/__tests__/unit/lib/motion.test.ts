import { describe, it, expect } from 'vitest';
import {
  springTransition,
  sheetSpring,
  snapTransition,
  gentleEase,
  fadeIn,
  slideUp,
  slideDown,
  scaleIn,
  bottomSheetVariants,
  staggerContainer,
  staggerItem,
  staggerContainerFast,
  backdropVariants,
  motionProps,
} from '@/lib/motion';

describe('Sprint 0: Centralized Motion Utilities (lib/motion.ts)', () => {
  it('should export standard spring transitions', () => {
    expect(springTransition.type).toBe('spring');
    expect(springTransition.stiffness).toBe(300);
    expect(springTransition.damping).toBe(24);

    expect(sheetSpring.type).toBe('spring');
    expect(sheetSpring.damping).toBe(25);
    expect(sheetSpring.stiffness).toBe(250);

    expect(snapTransition.type).toBe('spring');
    expect(snapTransition.stiffness).toBe(400);

    expect(gentleEase.duration).toBe(0.2);
  });

  it('should provide complete animation variants with initial and visible keys', () => {
    expect(fadeIn.hidden).toBeDefined();
    expect(fadeIn.visible).toBeDefined();

    expect(slideUp.hidden).toEqual({ opacity: 0, y: 20 });
    expect(slideUp.visible).toMatchObject({ opacity: 1, y: 0 });

    expect(slideDown.hidden).toEqual({ opacity: 0, y: -20 });
    expect(slideDown.visible).toMatchObject({ opacity: 1, y: 0 });

    expect(scaleIn.hidden).toEqual({ opacity: 0, scale: 0.9 });
    expect(scaleIn.visible).toMatchObject({ opacity: 1, scale: 1 });

    expect(bottomSheetVariants.hidden).toEqual({ y: '100%', opacity: 0 });
    expect(bottomSheetVariants.visible).toMatchObject({ y: 0, opacity: 1 });
    expect(bottomSheetVariants.exit).toEqual({ y: '100%', opacity: 0 });

    expect(staggerContainer.visible).toMatchObject({
      transition: { staggerChildren: 0.1 },
    });
    expect(staggerContainerFast.visible).toMatchObject({
      transition: { staggerChildren: 0.05 },
    });
    expect(staggerItem.hidden).toEqual({ opacity: 0, y: 20 });

    expect(backdropVariants.hidden).toEqual({ opacity: 0 });
    expect(backdropVariants.visible).toEqual({ opacity: 1 });
  });

  it('motionProps helper should collapse variants to opacity-only when reduce is true', () => {
    const fullProps = motionProps(false, slideUp);
    expect(fullProps.variants).toBe(slideUp);
    expect(fullProps.initial).toBe('hidden');
    expect(fullProps.animate).toBe('visible');

    const reducedProps = motionProps(true, slideUp);
    expect(reducedProps.initial).toBe('hidden');
    expect(reducedProps.animate).toBe('visible');
    // Reduced motion must strip transforms and only use opacity
    expect(reducedProps.variants.hidden).toEqual({ opacity: 0 });
    expect(reducedProps.variants.visible).toEqual({ opacity: 1 });
    expect((reducedProps.variants.hidden as any).y).toBeUndefined();
  });
});
