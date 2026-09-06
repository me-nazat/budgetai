import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { SmoothScroll } from '@/components/layout/SmoothScroll';
import { NoiseOverlay } from '@/components/effects/NoiseOverlay';
import { MeshGradient } from '@/components/effects/MeshGradient';
import { PWAProvider } from '@/components/providers/PWAProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap', preload: true, weight: ['300', '400', '500', '600', '700', '800'] });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap', preload: true, weight: ['400', '500', '600', '700'] });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: true, weight: ['400', '500', '600'] });

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#090D16' };

export const metadata: Metadata = {
  title: 'Wealth AI — Intelligent Personal Finance',
  description: 'Master your wealth with precision. AI-powered personal finance tracking, budgeting, and planning.',
  keywords: ['personal finance', 'budget', 'AI', 'wealth management', 'net worth'],
  openGraph: { title: 'Wealth AI — Intelligent Personal Finance', description: 'Master your wealth with precision.', type: 'website', locale: 'en_US' },
};

const themeBootstrapScript = `(() => {
  try {
    const savedTheme = localStorage.getItem('wealthai-theme');
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    const theme = savedTheme === 'light' || savedTheme === 'dark'
      ? savedTheme
      : savedTheme === 'system'
        ? systemTheme
        : 'dark';
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
  } catch {
    // Keep the server-rendered dark theme if storage is unavailable.
  }
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${playfair.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="font-sans antialiased">
        <PWAProvider>
          <ThemeProvider>
            <SmoothScroll>
              <MeshGradient />
              {children}
            </SmoothScroll>
          </ThemeProvider>
          <NoiseOverlay />
        </PWAProvider>
      </body>
    </html>
  );
}
