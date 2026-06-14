import type { Metadata, Viewport } from "next";
import { Geist, Outfit } from "next/font/google";
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

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
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
      <body className={`${geist.variable} ${outfit.variable} font-[Geist,sans-serif] antialiased bg-bg-light dark:bg-bg-dark text-text-main`}>
        <ThemeScript />
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
