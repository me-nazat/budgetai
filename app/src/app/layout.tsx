import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import InstallPrompt from "@/components/pwa/InstallPrompt";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
};

export const metadata: Metadata = {
  title: "Wealth AI — Smart Finance",
  description: "AI-powered personal finance management. Track expenses, earnings, budgets, net worth, and savings with intelligent insights.",
  keywords: "wealth AI, budget, savings, AI, finance, expense tracker, personal finance, net worth",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Wealth AI",
  },
  applicationName: "Wealth AI",
  icons: {
    apple: "/icon-192x192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} font-[Inter,sans-serif] antialiased`}>
        <ThemeScript />
        {children}
        <InstallPrompt />
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
