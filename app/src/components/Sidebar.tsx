'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR, { mutate } from 'swr';
import PrivacyToggle from '@/components/PrivacyToggle';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SEVEN_PILLARS, SYSTEM_NAV_ITEMS, NAV_TRANSLATION_MAP, type NavItem } from '@/lib/navigation/registry';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const { data: notificationsData } = useSWR('/api/notifications');
    const unreadCount = notificationsData?.unreadCount || 0;
    const [user, setUser] = useState<{ name: string; email: string; isGuest?: boolean } | null>(null);
    const [isDark, setIsDark] = useState(() => (typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true));
    const [profileHovered, setProfileHovered] = useState(false);

    useEffect(() => {
        const observer = new MutationObserver(() => {
            setIsDark(document.documentElement.classList.contains('dark'));
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => {
                if (d.user) setUser(d.user);
            })
            .catch(() => {});
    }, []);

    const toggleTheme = () => {
        const next = !isDark;
        setIsDark(next);
        localStorage.setItem('budget-ai-theme', next ? 'dark' : 'light');
        document.documentElement.classList.add('theme-transitioning');
        document.documentElement.classList.toggle('dark', next);
        setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('wealth-ai-swr-cache-v1');
        localStorage.removeItem('wealth-ai-swr-cache-v3');
        sessionStorage.removeItem('wealth-ai-core-meta-v1');
        localStorage.removeItem('wealth-ai-auth-state');
        router.push('/login');
    };

    const prefetchData = (href: string) => {
        if (href === '/tours') {
            void mutate('/api/bill-splits/tours', async () => {
                const res = await fetch('/api/bill-splits/tours');
                return res.json();
            }, { revalidate: false });
        }
    };

    const renderNavItem = (item: NavItem) => {
        const isExactActive = pathname === item.href;
        const isSubItemActive = item.subItems?.some(sub => pathname === sub.href || pathname?.startsWith(sub.href + '/'));
        const isActive = isExactActive || pathname?.startsWith(item.href + '/') || isSubItemActive;

        return (
            <div key={item.href} className="space-y-1">
                <Link
                    href={item.href}
                    onMouseEnter={() => prefetchData(item.href)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 relative group overflow-hidden ${
                        isActive
                            ? 'text-primary font-bold shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/60 dark:hover:bg-white/5'
                    }`}
                >
                    {isActive && (
                        <motion.div
                            layoutId="sidebar-active"
                            className="absolute inset-0 bg-primary/10 dark:bg-primary/15 rounded-xl border border-primary/20"
                            initial={false}
                            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                        />
                    )}
                    {isActive && (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_var(--color-primary)] z-10" />
                    )}

                    <div className="flex items-center gap-2.5 relative z-10 min-w-0">
                        <span
                            className={`material-symbols-outlined text-[20px] transition-transform duration-200 ${
                                isActive ? 'scale-105' : 'group-hover:scale-110'
                            }`}
                            style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                        >
                            {item.icon}
                        </span>
                        <span className="text-sm font-semibold truncate">
                            {t(NAV_TRANSLATION_MAP[item.id] || item.id, item.label)}
                        </span>
                    </div>

                    {item.href === '/notifications' && unreadCount > 0 && (
                        <div className="relative z-10 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-sm animate-pulse-slow">
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </div>
                    )}
                </Link>

                {/* Sub-items (if present and pillar is active) */}
                {item.subItems && item.subItems.length > 0 && (
                    <div className="pl-7 pr-2 space-y-0.5">
                        {item.subItems.map((sub) => {
                            const isSubActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                            return (
                                <Link
                                    key={sub.href}
                                    href={sub.href}
                                    onMouseEnter={() => prefetchData(sub.href)}
                                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        isSubActive
                                            ? 'text-primary dark:text-primary font-bold bg-primary/10'
                                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: isSubActive ? "'FILL' 1" : "'FILL' 0" }}>
                                        {sub.icon}
                                    </span>
                                    <span className="truncate">{t(NAV_TRANSLATION_MAP[sub.id] || sub.id, sub.label)}</span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className="hidden lg:flex fixed left-0 top-0 z-40 h-screen w-64 flex-col justify-between bg-white/80 dark:bg-surface-dark/80 backdrop-blur-2xl border-r border-gray-200/50 dark:border-white/5 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col h-full min-h-0">
                {/* Brand Header */}
                <div className="p-5 pb-3 shrink-0">
                    <Link href="/dashboard" className="flex items-center gap-3 group cursor-pointer">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0 relative">
                            <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-cover relative z-10" />
                            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />
                        </div>
                        <div className="flex flex-col min-w-0">
                            <h1 className="text-gray-900 dark:text-white text-base font-bold leading-none truncate tracking-tight">Wealth AI</h1>
                            <p className="text-gray-400 dark:text-gray-500 text-[11px] font-semibold mt-1 truncate uppercase tracking-wider">7-Pillar Finance</p>
                        </div>
                    </Link>
                </div>

                {/* 7 Primary Pillars Navigation */}
                <nav className="flex-1 overflow-y-auto px-3.5 pb-4 custom-scrollbar min-h-0 space-y-4">
                    <div>
                        <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500 select-none">
                            Primary Pillars
                        </p>
                        <div className="space-y-1">
                            {user?.isGuest
                                ? SEVEN_PILLARS.filter(p => p.id === 'household').map(renderNavItem)
                                : SEVEN_PILLARS.map(renderNavItem)
                            }
                        </div>
                    </div>

                    {!user?.isGuest && (
                        <div className="pt-2 border-t border-gray-200/40 dark:border-white/5">
                            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500 select-none">
                                System
                            </p>
                            <div className="space-y-1">
                                {SYSTEM_NAV_ITEMS.map(renderNavItem)}
                            </div>
                        </div>
                    )}
                </nav>

                {/* Bottom section (Settings & Profile) */}
                <div className="p-4 shrink-0 mt-auto border-t border-gray-200/40 dark:border-white/5 bg-gray-50/50 dark:bg-black/10">
                    <div className="flex items-center gap-1.5 mb-3">
                        <Link
                            href="/settings"
                            className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 transition-all text-xs font-semibold group"
                        >
                            <span className="material-symbols-outlined text-[18px] group-hover:rotate-45 transition-transform">settings</span>
                            <span className="truncate">{t('settings', 'Settings')}</span>
                        </Link>
                        <PrivacyToggle />
                        <LanguageToggle />
                        <button
                            onClick={toggleTheme}
                            className="w-8 h-8 shrink-0 rounded-xl flex items-center justify-center border border-gray-200 dark:border-white/10 bg-white dark:bg-surface-dark hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
                            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                            aria-label="Toggle Theme"
                        >
                            <span className="material-symbols-outlined text-sm text-gray-500 dark:text-gray-400" style={{ fontVariationSettings: "'FILL' 1" }}>
                                {isDark ? 'light_mode' : 'dark_mode'}
                            </span>
                        </button>
                    </div>

                    {user && (
                        <div
                            className="relative rounded-xl bg-white dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/10 p-2.5 flex items-center gap-2.5 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden group"
                            onMouseEnter={() => setProfileHovered(true)}
                            onMouseLeave={() => setProfileHovered(false)}
                            onClick={() => router.push('/settings')}
                        >
                            <div className="relative w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-cyan-500 p-[1.5px] shrink-0">
                                <div className="w-full h-full rounded-full bg-white dark:bg-[#0A0E1A] flex items-center justify-center">
                                    <span className="text-xs font-bold text-primary">
                                        {user.name.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                                <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                            </div>

                            <AnimatePresence>
                                {profileHovered && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleLogout();
                                        }}
                                        className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                        title="Sign out"
                                        aria-label="Sign out"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">logout</span>
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
