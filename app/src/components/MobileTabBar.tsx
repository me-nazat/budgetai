'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import QuickAddModal from './QuickAddModal';
import MobileMenu from './MobileMenu';
import useSWR from 'swr';

const mobileNavItems = [
    { href: '/dashboard', icon: 'home', label: 'Home' },
    { href: '/overview', icon: 'analytics', label: 'Overview' },
    { href: '__quick_add__', icon: 'add', label: 'Add' },
    { href: '/chat', icon: 'smart_toy', label: 'AI Chat' },
    { href: '__menu__', icon: 'menu', label: 'Menu' },
];

export default function MobileTabBar() {
    const pathname = usePathname();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const { data: notificationsData } = useSWR('/api/notifications');
    const unreadCount = notificationsData?.unreadCount || 0;

    return (
        <>
            <div
                className="lg:hidden fixed inset-x-3 z-50 rounded-[1.75rem] border border-white/70 bg-white/78 shadow-2xl shadow-slate-900/16 backdrop-blur-2xl transition-all duration-300 ease-out dark:border-white/10 dark:bg-[#10151d]/82 dark:shadow-black/45"
                style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
                <div className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/70 to-transparent" />
                <nav className="relative flex h-[72px] items-center justify-around px-2">
                    {mobileNavItems.map((item) => {
                        const isQuickAdd = item.href === '__quick_add__';
                        const isActive = !isQuickAdd && (pathname === item.href || pathname?.startsWith(item.href + '/'));

                        if (isQuickAdd) {
                            return (
                                <div key="quick-add" className="pointer-events-auto relative -mt-10 flex flex-col items-center justify-center group">
                                    <button
                                        onClick={() => setShowQuickAdd(true)}
                                        className="relative z-10 flex items-center justify-center transition-transform duration-300 active:scale-90"
                                        aria-label="Quick Add Transaction"
                                    >
                                        <div className="absolute inset-0 rounded-3xl bg-emerald-500/30 blur-xl breathe" />
                                        <div className="grid h-[60px] w-[60px] place-items-center rounded-3xl border border-white/30 bg-gradient-to-tr from-emerald-600 via-emerald-500 to-cyan-400 shadow-[0_14px_34px_rgb(16,185,129,0.34)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_16px_42px_rgb(16,185,129,0.48)] breathe">
                                            <span className="material-symbols-outlined text-white text-3xl font-bold">add</span>
                                        </div>
                                    </button>
                                </div>
                            );
                        }

                        if (item.href === '__menu__') {
                            return (
                                <button
                                    key="menu"
                                    onClick={() => setShowMenu(true)}
                                    className="relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl text-gray-400 transition-all duration-300 active:bg-gray-100 active:text-gray-700 dark:text-gray-500 dark:active:bg-white/10 dark:active:text-gray-300"
                                    aria-label="Open Menu"
                                >
                                    <div className="relative">
                                        <span
                                            className="material-symbols-outlined text-[22px] transition-all duration-300"
                                            style={{ fontVariationSettings: "'FILL' 0" }}
                                        >
                                            {item.icon}
                                        </span>
                                        {unreadCount > 0 && (
                                            <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#10151d] animate-pulse" />
                                        )}
                                    </div>
                                    <span className="text-[10px] font-semibold tracking-wide transition-all duration-300">
                                        {item.label}
                                    </span>
                                </button>
                            );
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl transition-all duration-300 ${isActive
                                    ? 'text-emerald-600 dark:text-emerald-300'
                                    : 'text-gray-400 active:bg-gray-100 active:text-gray-700 dark:text-gray-500 dark:active:bg-white/10 dark:active:text-gray-300'
                                    }`}
                            >
                                {isActive && (
                                    <motion.div 
                                        layoutId="mobile-nav-pill"
                                        className="absolute inset-x-2 top-2 bottom-2 rounded-2xl bg-emerald-500/10 dark:bg-emerald-400/10 nav-glow-pill" 
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span
                                    className={`material-symbols-outlined relative z-10 text-[22px] transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
                                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                    {item.icon}
                                </span>
                                <span className={`relative z-10 text-[10px] font-semibold tracking-wide transition-all duration-300 ${isActive ? 'text-emerald-600 dark:text-emerald-300' : ''}`}>
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <QuickAddModal isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
            <MobileMenu isOpen={showMenu} onClose={() => setShowMenu(false)} />
        </>
    );
}
