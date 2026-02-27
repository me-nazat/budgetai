'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

/* ──────────────────────────────────────────────
   Intersection Observer hook for scroll animations
   ────────────────────────────────────────────── */
function useScrollAnimations() {
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('lp-visible');
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
        );

        const elements = document.querySelectorAll('.lp-animate');
        elements.forEach((el) => observerRef.current?.observe(el));

        return () => observerRef.current?.disconnect();
    }, []);
}

/* ──────────────────────────────────────────────
   Theme Toggle Helper
   ────────────────────────────────────────────── */
function useThemeToggle() {
    const toggle = useCallback(() => {
        const html = document.documentElement;
        html.classList.add('lp-theme-transitioning');
        html.classList.toggle('dark');
        const isDark = html.classList.contains('dark');
        localStorage.setItem('budget-ai-theme', isDark ? 'dark' : 'light');
        setTimeout(() => html.classList.remove('lp-theme-transitioning'), 500);
    }, []);

    return toggle;
}

/* ═══════════════════════════════════════════════
   LANDING PAGE COMPONENT
   ═══════════════════════════════════════════════ */
export default function LandingPage({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
    const router = useRouter();
    useScrollAnimations();
    const toggleTheme = useThemeToggle();

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-slate-300 overflow-x-hidden selection:bg-primary dark:selection:bg-lp-cyan selection:text-white dark:selection:text-[#0A0A0A]">
            {/* Ambient background glow */}
            <div className="lp-ambient-glow" />

            {/* ─── HEADER ─── */}
            <Header onToggleTheme={toggleTheme} onNavigate={(path) => router.push(path)} isLoggedIn={isLoggedIn} />

            {/* ─── MAIN ─── */}
            <main className="flex-1 relative z-10">
                <HeroSection onNavigate={(path) => router.push(path)} />
                <PartnerLogos />
                <FeaturesSection />
                <DataVizSection />
                <TestimonialSection />
                <CTASection onNavigate={(path) => router.push(path)} />
            </main>

            {/* ─── FOOTER ─── */}
            <FooterSection />
        </div>
    );
}

/* ═══════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════ */
function Header({ onToggleTheme, onNavigate, isLoggedIn }: { onToggleTheme: () => void; onNavigate: (p: string) => void; isLoggedIn: boolean }) {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-gray-200/60 dark:border-white/5 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo */}
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm p-1 group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={36} height={36} className="object-contain rounded-lg" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-playfair), serif' }}>Wealth AI</span>
                </div>

                {/* Nav */}
                <nav className="hidden md:flex items-center gap-10">
                    <a className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-lp-cyan transition-colors" href="#features">Features</a>
                    <a className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-lp-cyan transition-colors" href="#how-it-works">How it works</a>
                    <a className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-lp-cyan transition-colors" href="#pricing">Pricing</a>
                    <a className="text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-lp-cyan transition-colors" href="#about">About</a>
                </nav>

                {/* Right */}
                <div className="flex items-center gap-4">
                    <button onClick={onToggleTheme} className="lp-theme-toggle" aria-label="Toggle theme">
                        {/* Sun (light → dark) */}
                        <span className="material-symbols-outlined text-xl text-gray-600 dark:text-yellow-300 hidden dark:block">light_mode</span>
                        {/* Moon (dark → light) */}
                        <span className="material-symbols-outlined text-xl text-gray-600 dark:text-yellow-300 block dark:hidden">dark_mode</span>
                    </button>
                    {isLoggedIn ? (
                        <button
                            onClick={() => onNavigate('/dashboard')}
                            className="lp-glow-btn inline-flex h-10 items-center justify-center rounded-lg bg-primary dark:bg-white px-5 text-sm font-bold text-white dark:text-black hover:bg-primary-hover dark:hover:bg-lp-cyan transition-all duration-300"
                        >
                            Go to Dashboard
                        </button>
                    ) : (
                        <>
                            <button onClick={() => onNavigate('/login')} className="hidden sm:block text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                Login
                            </button>
                            <button
                                onClick={() => onNavigate('/register')}
                                className="lp-glow-btn inline-flex h-10 items-center justify-center rounded-lg bg-primary dark:bg-white px-5 text-sm font-bold text-white dark:text-black hover:bg-primary-hover dark:hover:bg-lp-cyan transition-all duration-300"
                            >
                                Get Started
                            </button>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
}

/* ═══════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════ */
function HeroSection({ onNavigate }: { onNavigate: (p: string) => void }) {
    return (
        <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid gap-16 lg:grid-cols-2 lg:gap-12 items-center">
                    {/* ── Left Column ── */}
                    <div className="flex flex-col justify-center space-y-8">
                        {/* Badge */}
                        <div className="lp-animate inline-flex items-center rounded-full border border-primary/20 dark:border-lp-cyan/20 bg-primary/5 dark:bg-lp-cyan/5 px-4 py-1.5 text-sm font-medium text-primary dark:text-lp-cyan w-fit backdrop-blur-sm">
                            <span className="relative flex h-2 w-2 mr-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary dark:bg-lp-cyan opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary dark:bg-lp-cyan" />
                            </span>
                            Wealth Management Reimagined
                        </div>

                        {/* Headline */}
                        <h1 className="lp-animate text-5xl font-medium tracking-tight text-gray-900 dark:text-white sm:text-6xl md:text-7xl lg:text-6xl xl:text-7xl leading-[1.1]" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                            Master your<br />wealth with<br />
                            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-indigo-400 dark:from-lp-cyan dark:via-cyan-200 dark:to-white lp-glow-text">
                                precision.
                            </span>
                        </h1>

                        {/* Subtitle */}
                        <p className="lp-animate max-w-[560px] text-lg text-gray-500 dark:text-slate-400 md:text-xl leading-relaxed font-light">
                            Wealth AI unifies your financial life. Real-time net worth tracking, intelligent insights, and automated planning—all in one elegant interface.
                        </p>

                        {/* CTAs */}
                        <div className="lp-animate flex flex-col sm:flex-row gap-4">
                            <button
                                onClick={() => onNavigate('/register')}
                                className="lp-glow-btn h-14 rounded-xl bg-gradient-to-r from-primary to-blue-500 dark:from-lp-cyan dark:to-cyan-400 px-8 text-base font-bold text-white dark:text-black hover:brightness-110 transition-all duration-300"
                            >
                                Start Your Journey
                            </button>
                            <button className="h-14 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-8 text-base font-medium text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2">
                                <span className="material-symbols-outlined text-primary dark:text-lp-cyan">play_circle</span>
                                See How It Works
                            </button>
                        </div>

                        {/* Social proof */}
                        <div className="lp-animate pt-2 flex items-center gap-6 border-t border-gray-200 dark:border-white/5">
                            <div className="flex -space-x-3 pt-4">
                                {[
                                    'bg-gradient-to-br from-blue-400 to-indigo-500',
                                    'bg-gradient-to-br from-emerald-400 to-teal-500',
                                    'bg-gradient-to-br from-amber-400 to-orange-500'
                                ].map((bg, i) => (
                                    <div key={i} className={`h-10 w-10 rounded-full border-2 border-white dark:border-[#0A0A0A] ${bg} flex items-center justify-center text-white text-xs font-bold`}>
                                        {['JR', 'AM', 'KL'][i]}
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col pt-4">
                                <div className="flex text-yellow-500 text-xs gap-0.5">
                                    {[...Array(5)].map((_, i) => (
                                        <span key={i} className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-500 dark:text-slate-400">Trusted by <span className="text-gray-900 dark:text-white font-semibold">10,000+</span> investors</p>
                            </div>
                        </div>
                    </div>

                    {/* ── Right Column: Dashboard Mockup ── */}
                    <div className="lp-animate lp-animate-scale relative lg:ml-auto w-full">
                        <DashboardMockup />
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════
   DASHBOARD MOCKUP (CSS/SVG illustration)
   ═══════════════════════════════════════════════ */
function DashboardMockup() {
    return (
        <div className="relative w-full max-w-[580px] mx-auto">
            {/* Main card */}
            <div className="rounded-3xl bg-gray-50 dark:bg-surface-dark border border-gray-200 dark:border-surface-border shadow-2xl overflow-hidden">
                {/* Top bar */}
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 dark:border-white/5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                    <div className="ml-4 h-2.5 w-32 bg-gray-200 dark:bg-white/10 rounded-full" />
                </div>

                {/* Content area */}
                <div className="p-6 space-y-6">
                    {/* Greeting bar */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center p-1 overflow-hidden">
                                <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={36} height={36} className="object-contain rounded-lg" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">Wealth AI</p>
                                <p className="text-xs text-gray-400 dark:text-slate-500">Dashboard</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-gray-400 dark:text-slate-500">Net Worth</p>
                            <p className="text-lg font-bold text-gray-900 dark:text-white">$1,240,500</p>
                        </div>
                    </div>

                    {/* Chart area */}
                    <div className="relative h-40 border border-gray-200 dark:border-white/5 rounded-2xl bg-white dark:bg-[#0A0A0A] p-4 overflow-hidden">
                        <p className="text-xs text-gray-400 dark:text-slate-500 mb-2 font-medium uppercase tracking-wider">Portfolio Performance</p>
                        <svg className="w-full h-24" viewBox="0 0 400 100" preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="chart-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" className="[stop-color:var(--color-primary)] dark:[stop-color:#00E5FF]" stopOpacity="0.3" />
                                    <stop offset="100%" className="[stop-color:var(--color-primary)] dark:[stop-color:#00E5FF]" stopOpacity="0" />
                                </linearGradient>
                                <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" className="[stop-color:var(--color-primary)] dark:[stop-color:#00E5FF]" stopOpacity="0.4" />
                                    <stop offset="100%" className="[stop-color:var(--color-primary)] dark:[stop-color:#00E5FF]" stopOpacity="1" />
                                </linearGradient>
                            </defs>
                            <path d="M0,70 Q40,50 80,55 T160,40 T240,30 T320,20 T400,10 L400,100 L0,100 Z" fill="url(#chart-gradient)" />
                            <path d="M0,70 Q40,50 80,55 T160,40 T240,30 T320,20 T400,10" fill="none" stroke="url(#line-gradient)" strokeWidth="2.5" strokeLinecap="round" />
                            <circle cx="400" cy="10" r="4" className="fill-primary dark:fill-lp-cyan" />
                            <circle cx="400" cy="10" r="8" className="fill-primary/20 dark:fill-lp-cyan/20">
                                <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                            </circle>
                        </svg>
                    </div>

                    {/* Chat preview */}
                    <div className="space-y-3">
                        <div className="flex gap-3 items-start">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-lp-cyan/10 flex items-center justify-center text-primary dark:text-lp-cyan flex-shrink-0">
                                <span className="material-symbols-outlined text-sm">smart_toy</span>
                            </div>
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-600 dark:text-slate-300 max-w-[280px]">
                                Good morning, Alex. Your net worth increased by <span className="text-primary dark:text-lp-cyan font-semibold">+2.4%</span> this week.
                            </div>
                        </div>
                        <div className="flex gap-3 items-start justify-end">
                            <div className="bg-primary dark:bg-lp-cyan/20 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white dark:text-lp-cyan max-w-[260px]">
                                That&apos;s great! Can I afford the trip to Italy in September?
                            </div>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 dark:bg-lp-cyan/10 flex items-center justify-center text-primary dark:text-lp-cyan flex-shrink-0">
                                <span className="material-symbols-outlined text-sm">smart_toy</span>
                            </div>
                            <div className="bg-gray-100 dark:bg-white/5 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-600 dark:text-slate-300 max-w-[280px]">
                                Yes. Based on your current trajectory, you&apos;ll have <span className="font-semibold text-gray-900 dark:text-white">$4,200</span> by August 20th.
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating cards */}
            <div className="absolute -bottom-4 -left-4 lp-glass-card p-4 rounded-xl border-l-4 border-primary dark:border-lp-cyan lp-float-delayed z-20 hidden sm:block">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 dark:bg-lp-cyan/20 flex items-center justify-center text-primary dark:text-lp-cyan">
                        <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    </div>
                    <div>
                        <p className="text-[10px] text-gray-400 dark:text-slate-400 uppercase tracking-wider font-medium">AI Insight</p>
                        <p className="text-xs font-bold text-gray-900 dark:text-white">Spending goal reached</p>
                    </div>
                </div>
            </div>

            <div className="absolute -top-2 -right-4 lp-glass-card px-4 py-3 rounded-xl lp-float z-20 hidden sm:block">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-500">trending_up</span>
                    <span className="text-xs font-bold text-emerald-500">+12.5%</span>
                    <span className="text-xs text-gray-400 dark:text-slate-500">this month</span>
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════
   PARTNER LOGOS
   ═══════════════════════════════════════════════ */
function PartnerLogos() {
    const partners = ['Chase', 'Citi', 'Vanguard', 'FIDELITY', 'Schwab'];
    return (
        <section className="py-16 border-y border-gray-100 dark:border-white/5">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <p className="lp-animate text-center text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500 mb-10">
                    Securely integrated with 12,000+ financial institutions
                </p>
                <div className="lp-animate flex flex-wrap items-center justify-center gap-8 sm:gap-16">
                    {partners.map((name, i) => (
                        <span
                            key={i}
                            className="text-lg sm:text-xl font-bold tracking-wide text-gray-300 dark:text-slate-700 hover:text-gray-500 dark:hover:text-slate-400 transition-colors duration-300 cursor-default select-none"
                            style={{ fontFamily: i === 2 ? 'var(--font-playfair), serif' : undefined, fontStyle: i === 2 ? 'italic' : undefined }}
                        >
                            {name}
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════
   FEATURES SECTION
   ═══════════════════════════════════════════════ */
function FeaturesSection() {
    const features = [
        {
            icon: 'monitoring',
            title: 'Real-time Net Worth',
            description: 'Monitor your assets and liabilities as they change throughout the day. Connect bank accounts, investments, and property values instantly.'
        },
        {
            icon: 'shield',
            title: 'Smart Budgeting',
            description: 'Proactive notifications alert you before you exceed category limits. Our AI learns your habits to suggest realistic spending goals.'
        },
        {
            icon: 'insights',
            title: 'Investment Insights',
            description: 'Receive personalized portfolio recommendations based on market trends, your risk profile, and long-term financial objectives.'
        }
    ];

    return (
        <section id="features" className="py-32 relative">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="lp-animate mb-20 md:text-center max-w-3xl mx-auto">
                    <h2 className="text-sm font-bold text-primary dark:text-lp-cyan uppercase tracking-[0.2em] mb-4">Core Capabilities</h2>
                    <p className="text-3xl font-medium text-gray-900 dark:text-white sm:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                        Intelligent Financial Clarity
                    </p>
                    <p className="mt-6 text-lg text-gray-500 dark:text-slate-400 font-light max-w-2xl mx-auto">
                        Wealth AI continuously analyzes your financial landscape to provide actionable advice in real-time. Experience the calm of knowing exactly where you stand.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lp-stagger">
                    {features.map((f, i) => (
                        <div key={i} className="lp-animate group lp-glass-card p-10 rounded-3xl">
                            <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-white mb-8 group-hover:bg-primary dark:group-hover:bg-lp-cyan group-hover:text-white dark:group-hover:text-black group-hover:border-primary dark:group-hover:border-lp-cyan transition-all duration-500 shadow-lg shadow-black/5 dark:shadow-black/50">
                                <span className="material-symbols-outlined text-3xl">{f.icon}</span>
                            </div>
                            <h3 className="text-2xl font-medium text-gray-900 dark:text-white mb-4" style={{ fontFamily: 'var(--font-playfair), serif' }}>{f.title}</h3>
                            <p className="text-gray-500 dark:text-slate-400 leading-relaxed font-light">{f.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════
   DATA VISUALIZATION SECTION
   ═══════════════════════════════════════════════ */
function DataVizSection() {
    return (
        <section id="how-it-works" className="py-32 relative">
            <div className="lp-section-divider mb-32" />
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    {/* Left: Cards */}
                    <div className="space-y-6">
                        <div className="lp-animate lp-animate-left lp-glass-card p-6 rounded-2xl flex items-center gap-5">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/10 dark:from-lp-cyan/20 dark:to-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-3xl text-primary dark:text-lp-cyan">area_chart</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg" style={{ fontFamily: 'var(--font-playfair), serif' }}>Asset Growth</h4>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Track assets and liabilities over time with precision and historical data.</p>
                            </div>
                        </div>
                        <div className="lp-animate lp-animate-left lp-glass-card p-6 rounded-2xl flex items-center gap-5">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-3xl text-violet-500">wallet</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg" style={{ fontFamily: 'var(--font-playfair), serif' }}>Spend Analysis</h4>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Understand your spending patterns with detailed, auto-categorized transactions.</p>
                            </div>
                        </div>
                    </div>

                    {/* Right: Description */}
                    <div>
                        <p className="lp-animate text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500 mb-4">Data Visualization</p>
                        <h3 className="lp-animate text-3xl sm:text-4xl font-medium text-gray-900 dark:text-white leading-tight mb-6" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                            See your money<br />in a new light
                        </h3>
                        <p className="lp-animate text-gray-500 dark:text-slate-400 mb-8 font-light leading-relaxed">
                            Wealth AI turns complex financial data into beautiful, interactive stories. See exactly where your money goes with charts and reports generated instantly by our AI.
                        </p>
                        <div className="space-y-4">
                            {['Exportable tax-ready reports', 'Peer benchmarking', 'Smart savings projections'].map((item, i) => (
                                <div key={i} className="lp-animate flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-sm text-emerald-600 dark:text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                                    </div>
                                    <span className="text-gray-600 dark:text-slate-300 font-medium">{item}</span>
                                </div>
                            ))}
                        </div>
                        <button className="lp-animate mt-10 inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-6 text-sm font-bold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
                            Explore Visualizations
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════
   TESTIMONIAL SECTION
   ═══════════════════════════════════════════════ */
function TestimonialSection() {
    return (
        <section className="py-32 relative">
            <div className="lp-section-divider mb-32" />
            <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
                <div className="lp-animate">
                    <span className="material-symbols-outlined text-5xl text-gray-200 dark:text-slate-700 mb-8 block" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</span>
                    <blockquote className="text-2xl sm:text-3xl font-medium text-gray-900 dark:text-white leading-relaxed mb-10" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                        &ldquo;Wealth AI completely changed how I look at my monthly budget. It feels less like a finance app and more like having a personal CFO in my pocket.&rdquo;
                    </blockquote>
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-blue-500 dark:from-lp-cyan dark:to-cyan-400 flex items-center justify-center text-white dark:text-black font-bold text-lg">
                            NM
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white">Nazat Al Mahmud</p>
                            <p className="text-sm text-gray-500 dark:text-slate-400">Product Designer and Manager, Bangladesh</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════
   CTA SECTION
   ═══════════════════════════════════════════════ */
function CTASection({ onNavigate }: { onNavigate: (p: string) => void }) {
    return (
        <section className="py-24 relative">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="lp-animate lp-animate-scale relative rounded-3xl bg-gradient-to-br from-primary via-blue-600 to-indigo-700 dark:from-[#0f1729] dark:via-[#0a1628] dark:to-[#0A0A0A] p-12 sm:p-20 text-center overflow-hidden border border-transparent dark:border-white/5">
                    {/* Decorative blurs */}
                    <div className="absolute top-0 left-1/4 h-48 w-48 rounded-full bg-white/10 dark:bg-lp-cyan/10 blur-[80px]" />
                    <div className="absolute bottom-0 right-1/4 h-48 w-48 rounded-full bg-blue-400/10 dark:bg-blue-600/10 blur-[80px]" />

                    <div className="relative z-10">
                        <h2 className="text-4xl sm:text-5xl font-medium text-white mb-6 leading-tight" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                            Ready to master your wealth?
                        </h2>
                        <p className="text-white/70 dark:text-slate-400 text-lg max-w-2xl mx-auto mb-10 font-light">
                            Join the community of professionals mastering their finances with AI. Start your 14-day free trial, no credit card required.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button
                                onClick={() => onNavigate('/register')}
                                className="lp-glow-btn h-14 rounded-xl bg-white px-10 text-base font-bold text-gray-900 hover:bg-gray-100 transition-all duration-300"
                            >
                                Create Free Account
                            </button>
                            <button className="h-14 rounded-xl border border-white/20 dark:border-white/10 bg-white/10 dark:bg-white/5 px-10 text-base font-medium text-white hover:bg-white/20 dark:hover:bg-white/10 transition-colors backdrop-blur-sm">
                                Contact Sales
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ═══════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════ */
function FooterSection() {
    const columns = [
        { title: 'Product', links: ['Features', 'Pricing', 'Security', 'Integrations'] },
        { title: 'Company', links: ['About', 'Careers', 'Blog', 'Contact'] },
        { title: 'Resources', links: ['Help Center', 'API Docs', 'Community'] },
    ];

    return (
        <footer className="border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#0A0A0A] py-20 relative overflow-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-16">
                    {/* Brand */}
                    <div className="col-span-2">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm p-1 overflow-hidden">
                                <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={36} height={36} className="object-contain rounded-lg" />
                            </div>
                            <span className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-playfair), serif' }}>Wealth AI</span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs leading-relaxed mb-6">
                            Empowering your financial journey with intelligent insights and real-time tracking. Built for the modern investor.
                        </p>
                        <div className="flex gap-4">
                            <a className="text-gray-400 dark:text-slate-500 hover:text-primary dark:hover:text-white transition-colors" href="#">
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" /></svg>
                            </a>
                            <a className="text-gray-400 dark:text-slate-500 hover:text-primary dark:hover:text-white transition-colors" href="#">
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd" /></svg>
                            </a>
                        </div>
                    </div>

                    {/* Link columns */}
                    {columns.map((col, i) => (
                        <div key={i}>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider mb-5">{col.title}</h4>
                            <ul className="space-y-3">
                                {col.links.map((link, j) => (
                                    <li key={j}>
                                        <a className="text-sm text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-lp-cyan transition-colors" href="#">{link}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom */}
                <div className="pt-8 border-t border-gray-200 dark:border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-400 dark:text-slate-600">© 2026 Wealth AI Inc. All rights reserved.</p>
                    <div className="flex gap-6 text-xs text-gray-400 dark:text-slate-600">
                        <a className="hover:text-primary dark:hover:text-slate-400 transition-colors" href="#">Privacy Policy</a>
                        <a className="hover:text-primary dark:hover:text-slate-400 transition-colors" href="#">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
