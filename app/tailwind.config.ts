import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        tertiary: 'var(--text-tertiary)',
        muted: 'var(--text-muted)',
      },
      colors: {
        background: 'var(--bg-base)',
        foreground: 'var(--text-primary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'text-tertiary': 'var(--text-tertiary)',
        'text-muted': 'var(--text-muted)',
        primary: { DEFAULT: '#6366F1', hover: '#4F46E5', 50: '#EEF2FF', 100: '#E0E7FF', 500: '#6366F1', 600: '#4F46E5' },
        'surface-dark': 'var(--bg-surface)',
        'surface-hover': 'var(--bg-surface)',
        'surface-border': 'var(--border-subtle)',
        'bg-base': 'var(--bg-base)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-surface': 'var(--bg-surface)',
        'bg-inset': 'var(--bg-inset)',
        card: 'var(--bg-elevated)',
        'card-hover': 'var(--bg-surface)',
        border: 'var(--border-default)',
        'border-subtle': 'var(--border-subtle)',
        'border-strong': 'var(--border-strong)',
        muted: 'var(--text-muted)',
        'lp-cyan': '#00E5FF',
        accent: { emerald: 'var(--accent-emerald)', indigo: 'var(--accent-indigo)', amber: 'var(--accent-amber)', rose: 'var(--accent-rose)', cyan: 'var(--accent-cyan)' },
      },
      fontFamily: { serif: ['var(--font-playfair)', 'Georgia', 'serif'], sans: ['var(--font-inter)', 'system-ui', 'sans-serif'], mono: ['var(--font-jetbrains)', 'monospace'] },
      borderRadius: { sm: 'var(--radius-sm)', md: 'var(--radius-md)', lg: 'var(--radius-lg)', xl: 'var(--radius-xl)', '2xl': '24px' },
      boxShadow: {
        'glow-emerald': 'var(--shadow-glow-emerald)', 'glow-indigo': 'var(--shadow-glow-indigo)', 'glow-amber': '0 0 20px rgba(245,158,11,0.15)',
        'card': '0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -2px rgba(0,0,0,0.15)',
        'card-hover': '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -4px rgba(0,0,0,0.15)',
      },
      transitionTimingFunction: { 'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)', 'out-quart': 'cubic-bezier(0.25, 1, 0.5, 1)' },
      animation: { shimmer: 'shimmer 1.5s ease-in-out infinite', 'fade-in': 'fadeIn 0.35s ease-out-expo forwards', 'slide-up': 'slideUp 0.4s ease-out-expo forwards' },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [animate],
};

export default config;
