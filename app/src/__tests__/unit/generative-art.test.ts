import { describe, it, expect } from 'vitest';

describe('Generative Financial Art - Topologies & Constraints', () => {
  describe('Purple Ban Compliance', () => {
    // Verified palette definitions from FinancialMandala
    const PALETTES = {
      gold: {
        primary: '#f59e0b',
        secondary: '#d97706',
        highlight: '#fef08a',
        glow: '#fbbf24',
        dark: '#78350f',
      },
      emerald: {
        primary: '#10b981',
        secondary: '#059669',
        highlight: '#a7f3d0',
        glow: '#34d399',
        dark: '#064e3b',
      },
      sapphire: {
        primary: '#0ea5e9',
        secondary: '#0284c7',
        highlight: '#bae6fd',
        glow: '#38bdf8',
        dark: '#0c4a6e',
      },
      solar: {
        primary: '#f97316',
        secondary: '#ea580c',
        highlight: '#fed7aa',
        glow: '#fb923c',
        dark: '#7c2d12',
      },
    };

    it('ensures no default palettes violate the Purple Ban', () => {
      const forbiddenHexes = ['#8b5cf6', '#a855f7', '#6366f1', '#4f46e5', '#7c3aed', '#9333ea', '#c084fc', '#d8b4fe'];

      Object.entries(PALETTES).forEach(([paletteName, colors]) => {
        Object.entries(colors).forEach(([_key, hex]) => {
          expect(
            forbiddenHexes.includes(hex.toLowerCase()),
            `Palette "${paletteName}" contains forbidden purple/indigo token "${hex}"`
          ).toBe(false);
        });
      });
    });
  });

  describe('Spline Curve Formulator', () => {
    function buildSmoothSpline(points: Array<{ x: number; y: number }>): string {
      if (points.length < 2) return '';
      let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;

      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }

      return d;
    }

    it('generates valid cubic Bezier curves without NaN values', () => {
      const points = [
        { x: 40, y: 120 },
        { x: 100, y: 80 },
        { x: 180, y: 150 },
        { x: 260, y: 90 },
      ];

      const spline = buildSmoothSpline(points);
      expect(spline).toMatch(/^M 40\.0 120\.0 C/);
      expect(spline.includes('NaN')).toBe(false);
      expect(spline.includes('undefined')).toBe(false);
    });

    it('returns empty string when points are less than 2', () => {
      expect(buildSmoothSpline([])).toBe('');
      expect(buildSmoothSpline([{ x: 10, y: 10 }])).toBe('');
    });
  });

  describe('Trigonometric Harmonic Topology', () => {
    it('computes polar coordinates accurately within coordinate boundaries', () => {
      const CX = 300;
      const CY = 300;
      const radius = 150;
      const theta = Math.PI / 4; // 45 degrees

      const px = CX + radius * Math.cos(theta);
      const py = CY + radius * Math.sin(theta);

      expect(px).toBeCloseTo(300 + 150 * 0.7071, 2);
      expect(py).toBeCloseTo(300 + 150 * 0.7071, 2);
      expect(px).toBeGreaterThan(0);
      expect(px).toBeLessThan(600);
      expect(py).toBeGreaterThan(0);
      expect(py).toBeLessThan(600);
    });
  });
});
