import type { Metadata, Viewport } from "next";
import { Geist, Outfit, Playfair_Display, Fraunces, Noto_Sans_Bengali } from "next/font/google";
import "./globals.css";

import "material-symbols/outlined.css";
import { SmoothScroll } from "@/components/ui/SmoothScroll";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  style: ["normal", "italic"],
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  style: ["normal", "italic"],
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-bengali",
  display: "swap",
});


export const viewport: Viewport = {
  themeColor: "#136dec",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "Wealth AI — Smart Finance",
  description: "AI-powered personal finance management. Track expenses, earnings, budgets, net worth, and savings with intelligent insights.",
  keywords: "wealth AI, budget, savings, AI, finance, expense tracker, personal finance, net worth",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Wealth AI — Smart Finance</title>
        <meta name="description" content="AI-powered personal finance management. Track expenses, earnings, budgets, net worth, and savings with intelligent insights." />
        <meta property="og:title" content="Wealth AI — Smart Finance" />
        <meta property="og:description" content="AI-powered personal finance management. Track expenses, earnings, budgets, net worth, and savings with intelligent insights." />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Wealth AI" />
        <link rel="apple-touch-icon" href="/wealth-ai-logo-v2.png" />
        <ThemeScript />
      </head>
      <body className={`${geist.variable} ${outfit.variable} ${playfair.variable} ${fraunces.variable} ${notoBengali.variable} font-[Geist,sans-serif] antialiased bg-bg-light dark:bg-bg-dark text-text-main`}>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}

function ThemeScript() {
  const script = `
    (function() {
      try {
        var theme = localStorage.getItem('budget-ai-theme');
        var path = window.location.pathname;
        var isPublic = path === '/' || path.startsWith('/login') || path.startsWith('/register');
        
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (theme === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          // Default logic
          if (isPublic) {
            document.documentElement.classList.remove('dark');
          } else {
            document.documentElement.classList.add('dark');
          }
        }
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
