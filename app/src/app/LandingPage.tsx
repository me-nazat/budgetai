'use client';

import { useCallback, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, useScroll, useTransform, Variants, useMotionValue, useSpring, useMotionTemplate } from 'framer-motion';

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
    const toggleTheme = useThemeToggle();
    const { scrollYProgress } = useScroll();
    const y = useTransform(scrollYProgress, [0, 1], [0, -100]);

    return (
        <div className="relative flex min-h-screen flex-col bg-white dark:bg-[#0A0A0A] text-gray-700 dark:text-slate-300 overflow-x-hidden selection:bg-primary dark:selection:bg-lp-cyan selection:text-white dark:selection:text-[#0A0A0A]">
            {/* Ambient background glow */}
            <motion.div style={{ y }} className="lp-ambient-glow" />

            <Header onToggleTheme={toggleTheme} onNavigate={(path) => router.push(path)} isLoggedIn={isLoggedIn} />

            <main className="flex-1 relative z-10">
                <HeroSection onNavigate={(path) => router.push(path)} />
                <ProcessFlowSection />
                <PartnerLogos />
                <FeaturesSection />
                <DataVizSection />
                <TestimonialSection />
                <CTASection onNavigate={(path) => router.push(path)} />
            </main>

            <FooterSection />
        </div>
    );
}

/* ═══════════════════════════════════════════════
   HEADER
   ═══════════════════════════════════════════════ */
function Header({ onToggleTheme, onNavigate, isLoggedIn }: { onToggleTheme: () => void; onNavigate: (p: string) => void; isLoggedIn: boolean }) {
    return (
        <motion.header 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="sticky top-0 z-50 w-full border-b border-gray-200/60 dark:border-white/5 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-xl"
        >
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                {/* Logo */}
                <motion.div whileHover={{ scale: 1.05 }} className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('/')}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm p-1 overflow-hidden">
                        <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={36} height={36} className="object-contain rounded-lg" />
                    </div>
                    <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white" style={{ fontFamily: 'var(--font-playfair), serif' }}>Wealth AI</span>
                </motion.div>

                {/* Nav */}
                <nav className="hidden md:flex items-center gap-10">
                    {['Features', 'How it works', 'Pricing', 'About'].map((item) => (
                        <motion.a 
                            key={item}
                            whileHover={{ y: -2, color: 'var(--color-primary)' }}
                            className="text-sm font-medium text-gray-500 dark:text-slate-400 transition-colors" 
                            href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                            {item}
                        </motion.a>
                    ))}
                </nav>

                {/* Right */}
                <div className="flex items-center gap-4">
                    <motion.button whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }} onClick={onToggleTheme} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10" aria-label="Toggle theme">
                        <span className="material-symbols-outlined text-xl text-gray-600 dark:text-yellow-300 hidden dark:block">light_mode</span>
                        <span className="material-symbols-outlined text-xl text-gray-600 dark:text-yellow-300 block dark:hidden">dark_mode</span>
                    </motion.button>
                    {isLoggedIn ? (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onNavigate('/dashboard')}
                            className="lp-glow-btn inline-flex h-10 items-center justify-center rounded-lg bg-primary dark:bg-white px-5 text-sm font-bold text-white dark:text-black hover:bg-primary-hover dark:hover:bg-lp-cyan transition-all duration-300"
                        >
                            Go to Dashboard
                        </motion.button>
                    ) : (
                        <>
                            <button onClick={() => onNavigate('/login')} className="hidden sm:block text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                Login
                            </button>
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onNavigate('/register')}
                                className="lp-glow-btn inline-flex h-10 items-center justify-center rounded-lg bg-primary dark:bg-white px-5 text-sm font-bold text-white dark:text-black hover:bg-primary-hover dark:hover:bg-lp-cyan transition-all duration-300"
                            >
                                Get Started
                            </motion.button>
                        </>
                    )}
                </div>
            </div>
        </motion.header>
    );
}

/* ═══════════════════════════════════════════════
   HERO SECTION
   ═══════════════════════════════════════════════ */
const staggerContainer: Variants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.1 }
    }
};

const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 30 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

function HeroSection({ onNavigate }: { onNavigate: (p: string) => void }) {
    return (
        <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
            <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="grid gap-16 lg:grid-cols-2 lg:gap-12 items-center">
                    {/* ── Left Column ── */}
                    <motion.div 
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="flex flex-col justify-center space-y-8"
                    >
                        {/* Badge */}
                        <motion.div variants={fadeInUp} className="inline-flex items-center rounded-full border border-primary/20 dark:border-lp-cyan/20 bg-primary/5 dark:bg-lp-cyan/5 px-4 py-1.5 text-sm font-medium text-primary dark:text-lp-cyan w-fit backdrop-blur-sm">
                            <span className="relative flex h-2 w-2 mr-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary dark:bg-lp-cyan opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary dark:bg-lp-cyan" />
                            </span>
                            Wealth Management Reimagined
                        </motion.div>

                        {/* Headline */}
                        <motion.h1 variants={fadeInUp} className="text-5xl font-medium tracking-tight text-gray-900 dark:text-white sm:text-6xl md:text-7xl lg:text-6xl xl:text-7xl leading-[1.1]" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                            Master your<br />wealth with<br />
                            <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-indigo-400 dark:from-lp-cyan dark:via-cyan-200 dark:to-white lp-glow-text">
                                precision.
                            </span>
                        </motion.h1>

                        {/* Subtitle */}
                        <motion.p variants={fadeInUp} className="max-w-[560px] text-lg text-gray-500 dark:text-slate-400 md:text-xl leading-relaxed font-light">
                            Wealth AI unifies your financial life. Real-time net worth tracking, intelligent insights, and automated planning—all in one elegant interface.
                        </motion.p>

                        {/* CTAs */}
                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onNavigate('/register')}
                                className="lp-glow-btn h-14 rounded-xl bg-gradient-to-r from-primary to-blue-500 dark:from-lp-cyan dark:to-cyan-400 px-8 text-base font-bold text-white dark:text-black hover:brightness-110 transition-all duration-300 shadow-[0_0_40px_rgba(19,109,236,0.3)] dark:shadow-[0_0_40px_rgba(0,229,255,0.3)]"
                            >
                                Start Your Journey
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="h-14 rounded-xl border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-8 text-base font-medium text-gray-700 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-primary dark:text-lp-cyan">play_circle</span>
                                See How It Works
                            </motion.button>
                        </motion.div>

                        {/* Social proof */}
                        <motion.div variants={fadeInUp} className="pt-2 flex items-center gap-6 border-t border-gray-200 dark:border-white/5">
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
                        </motion.div>
                    </motion.div>

                    {/* ── Right Column: Dashboard Mockup ── */}
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.8, rotateY: 15 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="relative lg:ml-auto w-full perspective-[1000px]"
                    >
                        <DashboardMockup />
                    </motion.div>
                </div>
            </div>
        </section>
    );
}

function DashboardMockup() {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseXSpring = useSpring(x, { stiffness: 300, damping: 20 });
    const mouseYSpring = useSpring(y, { stiffness: 300, damping: 20 });

    const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
    const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);
    const rotateXSecondary = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
    const rotateYSecondary = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);
    const rotateXTertiary = useTransform(mouseYSpring, [-0.5, 0.5], ["15deg", "-15deg"]);
    const rotateYTertiary = useTransform(mouseXSpring, [-0.5, 0.5], ["-15deg", "15deg"]);
    
    // Mouse Glow inside card
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function handleMouseMove(e: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const rect = e.currentTarget.getBoundingClientRect();
        
        // 3D rotation logic
        const width = rect.width;
        const height = rect.height;
        const mouseXLocal = e.clientX - rect.left;
        const mouseYLocal = e.clientY - rect.top;
        const xPct = mouseXLocal / width - 0.5;
        const yPct = mouseYLocal / height - 0.5;
        x.set(xPct);
        y.set(yPct);
        
        // Glow logic
        mouseX.set(e.clientX - rect.left);
        mouseY.set(e.clientY - rect.top);
    }

    function handleMouseLeave() {
        x.set(0);
        y.set(0);
        mouseX.set(-1000); // Hide glow when leaving
        mouseY.set(-1000);
    }

    return (
        <div className="relative w-full max-w-[580px] mx-auto group perspective-[1200px]"
             onMouseMove={handleMouseMove}
             onMouseLeave={handleMouseLeave}>
            {/* Main card */}
            <motion.div 
                style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
                className="relative rounded-3xl bg-gray-50/90 dark:bg-surface-dark/90 backdrop-blur-xl border border-gray-200/50 dark:border-surface-border/50 shadow-2xl overflow-hidden"
            >
                {/* Glow effect */}
                <motion.div
                    className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
                    style={{
                        background: useMotionTemplate`
                            radial-gradient(
                                600px circle at ${mouseX}px ${mouseY}px,
                                rgba(19, 109, 236, 0.1),
                                transparent 40%
                            )
                        `,
                    }}
                />
                {/* Top bar */}
                <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-200 dark:border-white/5">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                    <div className="ml-4 h-2.5 w-32 bg-gray-200 dark:bg-white/10 rounded-full" />
                </div>

                {/* Content area */}
                <div className="p-6 space-y-6">
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
                            <motion.path 
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ duration: 1.5, ease: "easeInOut" }}
                                d="M0,70 Q40,50 80,55 T160,40 T240,30 T320,20 T400,10" 
                                fill="none" stroke="url(#line-gradient)" strokeWidth="2.5" strokeLinecap="round" 
                            />
                            <circle cx="400" cy="10" r="4" className="fill-primary dark:fill-lp-cyan" />
                            <circle cx="400" cy="10" r="8" className="fill-primary/20 dark:fill-lp-cyan/20">
                                <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                            </circle>
                        </svg>
                    </div>

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
            </motion.div>

            <div className="grid grid-cols-2 gap-4 mt-6" style={{ transform: "translateZ(30px)" }}>
                {/* Floating Card 1 */}
                <motion.div 
                    style={{ rotateX: rotateXSecondary, rotateY: rotateYSecondary, transformStyle: "preserve-3d" }}
                    className="p-4 rounded-2xl bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 shadow-xl"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-primary/10 dark:bg-lp-cyan/20 flex items-center justify-center text-primary dark:text-lp-cyan">
                            <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                        </div>
                        <div>
                            <p className="text-[10px] text-gray-400 dark:text-slate-400 uppercase tracking-wider font-medium">AI Insight</p>
                            <p className="text-xs font-bold text-gray-900 dark:text-white">Spending goal reached</p>
                        </div>
                    </div>
                </motion.div>

                {/* Floating Card 2 */}
                <motion.div 
                    style={{ rotateX: rotateXSecondary, rotateY: rotateYSecondary, transformStyle: "preserve-3d" }}
                    className="p-4 rounded-2xl bg-white dark:bg-[#161b22] border border-gray-100 dark:border-white/5 shadow-xl"
                >
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-emerald-500">trending_up</span>
                        <span className="text-xs font-bold text-emerald-500">+12.5%</span>
                        <span className="text-xs text-gray-400 dark:text-slate-500">this month</span>
                    </div>
                </motion.div>
            </div>

            {/* Floating Card 3 (Tertiary depth) */}
            <motion.div 
                style={{ rotateX: rotateXTertiary, rotateY: rotateYTertiary, transformStyle: "preserve-3d", transform: "translateZ(50px)" }}
                className="absolute -right-8 -bottom-8 lg:-right-16 lg:bottom-12 w-64 rounded-2xl bg-white/90 dark:bg-[#161b22]/90 backdrop-blur-xl border border-gray-200 dark:border-white/10 p-5 shadow-2xl hidden md:block"
            >
                <p className="text-sm text-gray-500 dark:text-slate-400">Product Designer and Manager, Bangladesh</p>
            </motion.div>
        </div>
    );
}

function ProcessFlowSection() {
    const steps = [
        { icon: 'chat', title: 'Tell Wealth AI', copy: 'Add "coffee 6 dollars" or ask a finance question in natural language.' },
        { icon: 'auto_awesome', title: 'AI Categorizes', copy: 'The entry is cleaned, dated, matched to a smart category, and styled with an icon.' },
        { icon: 'query_stats', title: 'Dashboard Updates', copy: 'Balances, charts, recent transactions, and trends refresh around the new data.' },
        { icon: 'notifications_active', title: 'Insights Surface', copy: 'Budget alerts and savings guidance appear when your numbers need attention.' },
    ];

    return (
        <section className="relative py-10 sm:py-14">
            <motion.div 
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
            >
                <motion.div variants={fadeInUp} className="rounded-3xl border border-gray-200/70 bg-white/80 p-5 shadow-xl shadow-slate-900/5 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/20">
                    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
                        <div>
                            <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary dark:text-lp-cyan">How Wealth AI works</p>
                            <h2 className="max-w-xl text-3xl font-medium leading-tight text-gray-900 dark:text-white sm:text-4xl" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                                From one sentence to a living financial picture.
                            </h2>
                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {steps.map((step, index) => (
                                    <motion.div 
                                        key={step.title} 
                                        variants={fadeInUp}
                                        whileHover={{ scale: 1.02 }}
                                        className="lp-flow-card rounded-2xl border border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-white/[0.04]"
                                    >
                                        <div className="mb-3 flex items-center gap-3">
                                            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-lp-cyan/10 dark:text-lp-cyan">
                                                <span className="material-symbols-outlined text-[21px]">{step.icon}</span>
                                            </div>
                                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">{step.title}</h3>
                                        </div>
                                        <p className="text-sm leading-relaxed text-gray-500 dark:text-slate-400">{step.copy}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        <motion.div variants={fadeInUp} className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-950 p-5 text-white shadow-2xl shadow-slate-900/20 dark:border-white/10">
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lp-cyan/70 to-transparent" />
                            <div className="mb-5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-rose-400" />
                                    <div className="h-3 w-3 rounded-full bg-amber-400" />
                                    <div className="h-3 w-3 rounded-full bg-emerald-400" />
                                </div>
                                <div className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-cyan-200">Live finance engine</div>
                            </div>

                            <div className="space-y-3">
                                <div className="lp-input-pulse rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-sm text-slate-300">
                                        <span className="material-symbols-outlined text-[18px] text-cyan-300">keyboard</span>
                                        <span>Lunch with client 28 today</span>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-white/10">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            whileInView={{ width: "100%" }}
                                            transition={{ duration: 1.5, repeat: Infinity, repeatType: "loop" }}
                                            className="h-full rounded-full bg-cyan-300" 
                                        />
                                    </div>
                                </div>

                                {[
                                    ['restaurant', 'Expense', 'Food', '$28.00'],
                                    ['event_available', 'Date', 'Today', 'Ready'],
                                    ['donut_large', 'Report', 'Spending trend', '+1 entry'],
                                ].map(([icon, label, detail, value], index) => (
                                    <motion.div 
                                        key={label} 
                                        initial={{ opacity: 0, x: 20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        viewport={{ once: true }}
                                        className="lp-flow-row flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                                    >
                                        <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300/10 text-cyan-200">
                                            <span className="material-symbols-outlined text-[20px]">{icon}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
                                            <p className="truncate text-sm font-bold text-white">{detail}</p>
                                        </div>
                                        <p className="text-sm font-bold text-cyan-200">{value}</p>
                                    </motion.div>
                                ))}

                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    whileInView={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.5 }}
                                    viewport={{ once: true }}
                                    className="lp-insight-ticket rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="material-symbols-outlined text-emerald-300">auto_awesome</span>
                                        <div>
                                            <p className="text-sm font-bold text-emerald-100">Budget insight ready</p>
                                            <p className="mt-1 text-xs leading-relaxed text-emerald-100/70">Dining is 72% of this month&apos;s limit after the new entry.</p>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
}

function PartnerLogos() {
    const partners = ['Chase', 'Citi', 'Vanguard', 'FIDELITY', 'Schwab'];
    return (
        <section className="py-16 border-y border-gray-100 dark:border-white/5">
            <motion.div 
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={staggerContainer}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
            >
                <motion.p variants={fadeInUp} className="text-center text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500 mb-10">
                    Securely integrated with 12,000+ financial institutions
                </motion.p>
                <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-16">
                    {partners.map((name, i) => (
                        <motion.span
                            key={i}
                            variants={fadeInUp}
                            whileHover={{ scale: 1.1, color: "var(--color-primary)" }}
                            className="text-lg sm:text-xl font-bold tracking-wide text-gray-300 dark:text-slate-700 transition-colors duration-300 cursor-default select-none"
                            style={{ fontFamily: i === 2 ? 'var(--font-playfair), serif' : undefined, fontStyle: i === 2 ? 'italic' : undefined }}
                        >
                            {name}
                        </motion.span>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}

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
            <motion.div 
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
            >
                <motion.div variants={fadeInUp} className="mb-20 md:text-center max-w-3xl mx-auto">
                    <h2 className="text-sm font-bold text-primary dark:text-lp-cyan uppercase tracking-[0.2em] mb-4">Core Capabilities</h2>
                    <p className="text-3xl font-medium text-gray-900 dark:text-white sm:text-5xl leading-tight" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                        Intelligent Financial Clarity
                    </p>
                    <p className="mt-6 text-lg text-gray-500 dark:text-slate-400 font-light max-w-2xl mx-auto">
                        Wealth AI continuously analyzes your financial landscape to provide actionable advice in real-time. Experience the calm of knowing exactly where you stand.
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {features.map((f, i) => (
                        <motion.div 
                            key={i} 
                            variants={fadeInUp}
                            whileHover={{ y: -10 }}
                            className="group lp-glass-card p-10 rounded-3xl"
                        >
                            <div className="h-14 w-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-600 dark:text-white mb-8 group-hover:bg-primary dark:group-hover:bg-lp-cyan group-hover:text-white dark:group-hover:text-black group-hover:border-primary dark:group-hover:border-lp-cyan transition-all duration-500 shadow-lg shadow-black/5 dark:shadow-black/50">
                                <span className="material-symbols-outlined text-3xl">{f.icon}</span>
                            </div>
                            <h3 className="text-2xl font-medium text-gray-900 dark:text-white mb-4" style={{ fontFamily: 'var(--font-playfair), serif' }}>{f.title}</h3>
                            <p className="text-gray-500 dark:text-slate-400 leading-relaxed font-light">{f.description}</p>
                        </motion.div>
                    ))}
                </div>
            </motion.div>
        </section>
    );
}

function DataVizSection() {
    return (
        <section id="how-it-works" className="py-32 relative">
            <div className="lp-section-divider mb-32" />
            <motion.div 
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-100px" }}
                variants={staggerContainer}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
            >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-6">
                        <motion.div variants={fadeInUp} whileHover={{ x: 10 }} className="lp-glass-card p-6 rounded-2xl flex items-center gap-5 cursor-pointer transition-all">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-blue-500/10 dark:from-lp-cyan/20 dark:to-blue-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-3xl text-primary dark:text-lp-cyan">area_chart</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg" style={{ fontFamily: 'var(--font-playfair), serif' }}>Asset Growth</h4>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Track assets and liabilities over time with precision and historical data.</p>
                            </div>
                        </motion.div>
                        <motion.div variants={fadeInUp} whileHover={{ x: 10 }} className="lp-glass-card p-6 rounded-2xl flex items-center gap-5 cursor-pointer transition-all">
                            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10 flex items-center justify-center flex-shrink-0">
                                <span className="material-symbols-outlined text-3xl text-violet-500">wallet</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-900 dark:text-white text-lg" style={{ fontFamily: 'var(--font-playfair), serif' }}>Spend Analysis</h4>
                                <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Understand your spending patterns with detailed, auto-categorized transactions.</p>
                            </div>
                        </motion.div>
                    </div>

                    <div>
                        <motion.p variants={fadeInUp} className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500 mb-4">Data Visualization</motion.p>
                        <motion.h3 variants={fadeInUp} className="text-3xl sm:text-4xl font-medium text-gray-900 dark:text-white leading-tight mb-6" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                            See your money<br />in a new light
                        </motion.h3>
                        <motion.p variants={fadeInUp} className="text-gray-500 dark:text-slate-400 mb-8 font-light leading-relaxed">
                            Wealth AI turns complex financial data into beautiful, interactive stories. See exactly where your money goes with charts and reports generated instantly by our AI.
                        </motion.p>
                        <div className="space-y-4">
                            {['Exportable tax-ready reports', 'Peer benchmarking', 'Smart savings projections'].map((item, i) => (
                                <motion.div key={i} variants={fadeInUp} className="flex items-center gap-3">
                                    <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                                        <span className="material-symbols-outlined text-sm text-emerald-600 dark:text-emerald-400" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>
                                    </div>
                                    <span className="text-gray-600 dark:text-slate-300 font-medium">{item}</span>
                                </motion.div>
                            ))}
                        </div>
                        <motion.button 
                            variants={fadeInUp} 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="mt-10 inline-flex h-12 items-center justify-center rounded-xl border border-gray-300 dark:border-white/10 bg-white dark:bg-white/5 px-6 text-sm font-bold text-gray-700 dark:text-white hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                        >
                            Explore Visualizations
                        </motion.button>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}

function TestimonialSection() {
    return (
        <section className="py-32 relative">
            <div className="lp-section-divider mb-32" />
            <motion.div 
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={staggerContainer}
                className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center"
            >
                <motion.span variants={fadeInUp} className="material-symbols-outlined text-5xl text-gray-200 dark:text-slate-700 mb-8 block" style={{ fontVariationSettings: "'FILL' 1" }}>format_quote</motion.span>
                <motion.blockquote variants={fadeInUp} className="text-2xl sm:text-3xl font-medium text-gray-900 dark:text-white leading-relaxed mb-10" style={{ fontFamily: 'var(--font-playfair), serif' }}>
                    &ldquo;Wealth AI completely changed how I look at my monthly budget. It feels less like a finance app and more like having a personal CFO in my pocket.&rdquo;
                </motion.blockquote>
                <motion.div variants={fadeInUp} className="flex flex-col items-center gap-3">
                    <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary to-blue-500 dark:from-lp-cyan dark:to-cyan-400 flex items-center justify-center text-white dark:text-black font-bold text-lg">
                        NM
                    </div>
                    <div>
                        <p className="font-bold text-gray-900 dark:text-white">Nazat Al Mahmud</p>
                        <p className="text-sm text-gray-500 dark:text-slate-400">Product Designer and Manager, Bangladesh</p>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
}

function CTASection({ onNavigate }: { onNavigate: (p: string) => void }) {
    return (
        <section className="py-24 relative">
            <motion.div 
                initial="hidden"
                whileInView="show"
                viewport={{ once: true }}
                variants={staggerContainer}
                className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
            >
                <motion.div 
                    variants={fadeInUp}
                    whileHover={{ scale: 1.01 }}
                    className="relative rounded-3xl bg-gradient-to-br from-primary via-blue-600 to-indigo-700 dark:from-[#0f1729] dark:via-[#0a1628] dark:to-[#0A0A0A] p-12 sm:p-20 text-center overflow-hidden border border-transparent dark:border-white/5"
                >
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
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => onNavigate('/register')}
                                className="lp-glow-btn h-14 rounded-xl bg-white px-10 text-base font-bold text-gray-900 hover:bg-gray-100 transition-all duration-300"
                            >
                                Create Free Account
                            </motion.button>
                            <motion.button 
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="h-14 rounded-xl border border-white/20 dark:border-white/10 bg-white/10 dark:bg-white/5 px-10 text-base font-medium text-white hover:bg-white/20 dark:hover:bg-white/10 transition-colors backdrop-blur-sm"
                            >
                                Contact Sales
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </section>
    );
}

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
                    </div>
                    {columns.map((col, i) => (
                        <div key={i}>
                            <h4 className="font-bold text-gray-900 dark:text-white mb-4">{col.title}</h4>
                            <ul className="space-y-3">
                                {col.links.map((link, j) => (
                                    <li key={j}>
                                        <a href="#" className="text-sm text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-white transition-colors">{link}</a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="pt-8 border-t border-gray-200 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-sm text-gray-500 dark:text-slate-500">© 2026 Wealth AI. All rights reserved.</p>
                    <div className="flex gap-6">
                        <a href="#" className="text-sm text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white">Privacy</a>
                        <a href="#" className="text-sm text-gray-500 dark:text-slate-500 hover:text-gray-900 dark:hover:text-white">Terms</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
