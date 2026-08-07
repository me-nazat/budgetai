export const tokens = {
  colors: {
    dark: {
      bg: { base: '#0A0E1B', elevated: '#0f172a', surface: '#111827', inset: '#0A0E1B' },
      border: { subtle: 'rgba(240,246,252,0.04)', default: 'rgba(240,246,252,0.08)', strong: 'rgba(240,246,252,0.12)', glow: 'rgba(16,185,129,0.15)' },
      text: { primary: '#F0F4F8', secondary: '#94A3B8', tertiary: '#64748B', muted: '#475569', inverse: '#0F172A' },
      accent: { emerald: '#10B981', emeraldGlow: 'rgba(16,185,129,0.20)', indigo: '#6366F1', indigoGlow: 'rgba(99,102,241,0.20)', amber: '#F59E0B', rose: '#F43F5E', cyan: '#06B6D4' },
    },
    light: {
      bg: { base: '#F8FAFC', elevated: '#FFFFFF', surface: '#F1F5F9', inset: '#E2E8F0' },
      border: { subtle: 'rgba(15,23,42,0.06)', default: 'rgba(15,23,42,0.10)', strong: 'rgba(15,23,42,0.16)', glow: 'rgba(16,185,129,0.10)' },
      text: { primary: '#0F172A', secondary: '#475569', tertiary: '#64748B', muted: '#94A3B8', inverse: '#F8FAFC' },
      accent: { emerald: '#059669', emeraldGlow: 'rgba(5,150,105,0.15)', indigo: '#4F46E5', indigoGlow: 'rgba(79,70,229,0.15)', amber: '#D97706', rose: '#E11D48', cyan: '#0891B2' },
    },
  },
  font: { serif: '"Playfair Display", serif', sans: '"Inter", -apple-system, sans-serif', mono: '"JetBrains Mono", monospace' },
  fontSize: {
    '2xs': ['0.625rem', { lineHeight: '0.875rem' }], xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }], base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }], xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }], '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }], '5xl': ['3rem', { lineHeight: '1.1' }], '6xl': ['3.75rem', { lineHeight: '1.05' }],
  },
  space: { sidebar: '280px', sidebarCollapsed: '80px', header: '64px', pagePadding: '24px', cardPadding: '20px', sectionGap: '32px' },
  shadow: {
    sm: '0 1px 2px 0 rgba(0,0,0,0.15)', md: '0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -2px rgba(0,0,0,0.15)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.25), 0 4px 6px -4px rgba(0,0,0,0.15)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.3), 0 8px 10px -6px rgba(0,0,0,0.15)',
    glow: { emerald: '0 0 20px rgba(16,185,129,0.15), 0 0 40px rgba(16,185,129,0.05)', indigo: '0 0 20px rgba(99,102,241,0.15), 0 0 40px rgba(99,102,241,0.05)', amber: '0 0 20px rgba(245,158,11,0.15), 0 0 40px rgba(245,158,11,0.05)' },
  },
  radius: { sm: '6px', md: '10px', lg: '14px', xl: '18px', '2xl': '24px', full: '9999px' },
  animation: {
    spring: { gentle: { type: 'spring', stiffness: 120, damping: 20, mass: 1 }, snappy: { type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }, bouncy: { type: 'spring', stiffness: 400, damping: 25, mass: 0.9 }, smooth: { type: 'spring', stiffness: 200, damping: 28, mass: 1.2 }, layout: { type: 'spring', stiffness: 350, damping: 30, mass: 0.9 } },
    ease: { outExpo: [0.16, 1, 0.3, 1], outQuart: [0.25, 1, 0.5, 1], outCubic: [0.33, 1, 0.68, 1], inOutQuint: [0.83, 0, 0.17, 1] },
    duration: { instant: 0.1, fast: 0.2, normal: 0.35, slow: 0.5, dramatic: 0.8 },
    stagger: { fast: 0.03, normal: 0.05, slow: 0.08, cascade: 0.12 },
  },
  zIndex: { base: 0, dropdown: 50, sticky: 100, overlay: 200, modal: 300, toast: 400, tooltip: 500 },
} as const;

export type DesignTokens = typeof tokens;
