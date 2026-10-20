'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import QuickAddModal from '@/components/transactions/QuickAddTransactionModal';
import MobileMenu from './MobileMenu';
import useSWR from 'swr';
import { useLanguage } from '@/contexts/LanguageContext';

interface TabItem {
    href: string;
    icon: string;
    labelKey: string;
    label: string;
    isCenterAction?: boolean;
    isMenuTrigger?: boolean;
}

const PRIMARY_MOBILE_TABS: TabItem[] = [
    { href: '/dashboard', icon: 'dashboard', labelKey: 'commandCenter', label: 'Command' },
    { href: '/transactions', icon: 'receipt_long', labelKey: 'transactions', label: 'Ledger' },
    { href: '__quick_add__', icon: 'add', labelKey: 'add', label: 'Add', isCenterAction: true },
    { href: '/household', icon: 'groups', labelKey: 'collaborativeWealth', label: 'Wealth' },
    { href: '__menu__', icon: 'menu', labelKey: 'menu', label: 'More', isMenuTrigger: true },
];

export default function MobileTabBar() {
    const pathname = usePathname();
    const { t } = useLanguage();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const { data: notificationsData } = useSWR('/api/notifications');
    const unreadCount = notificationsData?.unreadCount || 0;
    const { data: userData } = useSWR('/api/auth/me');
    const user = userData?.user;

    const navItems = user?.isGuest
        ? [
            { href: '/tours', icon: 'flight_takeoff', labelKey: 'tourManager', label: 'Tours' },
            { href: '__menu__', icon: 'menu', labelKey: 'menu', label: 'More', isMenuTrigger: true },
          ]
        : PRIMARY_MOBILE_TABS;

    return (
        <>
            <div
                className="lg:hidden fixed inset-x-3 z-50 rounded-[1.75rem] border border-[var(--border-subtle)] bg-[var(--bg-surface)]/85 shadow-2xl shadow-slate-900/15 backdrop-blur-md transition-all duration-300 ease-out dark:border-[var(--border-subtle)] dark:bg-[var(--bg-surface)]/90 dark:shadow-[0_8px_32px_rgba(0,0,0,0.8)]"
                style={{ bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
                <div className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
                <nav className="relative flex h-[70px] items-center justify-around px-1">
                    {navItems.map((item) => {
                        if (item.isCenterAction) {
                            return (
                                <div key="quick-add" className="pointer-events-auto relative -mt-8 flex flex-col items-center justify-center group">
                                    <button
                                        type="button"
                                        onClick={() => setShowQuickAdd(true)}
                                        className="relative z-10 flex items-center justify-center transition-transform duration-200 active:scale-95"
                                        aria-label="Quick Add Transaction"
                                    >
                                        <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-lg" />
                                        <div className="grid h-[54px] w-[54px] place-items-center rounded-2xl border border-white/30 bg-gradient-to-tr from-[#0f2f5f] via-primary to-[#1d4ed8] shadow-lg shadow-primary/30 transition-transform duration-200 group-hover:-translate-y-0.5">
                                            <span className="material-symbols-outlined text-white text-3xl font-bold">add</span>
                                        </div>
                                    </button>
                                </div>
                            );
                        }

                        if (item.isMenuTrigger) {
                            return (
                                <button
                                    key="menu"
                                    type="button"
                                    onClick={() => setShowMenu(true)}
                                    className="relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-gray-400 transition-colors active:text-gray-700 dark:text-gray-500 dark:active:text-gray-300"
                                    aria-label="Open More Menu"
                                >
                                    <div className="relative">
                                        <span className="material-symbols-outlined text-[22px]">
                                            {item.icon}
                                        </span>
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-0.5 -right-0.5 block h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0A0A0C] animate-pulse" />
                                        )}
                                    </div>
                                    <span className="text-[10px] font-semibold tracking-tight truncate max-w-[56px]">
                                        {t('more', item.label)}
                                    </span>
                                </button>
                            );
                        }

                        const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`relative flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                                    isActive
                                        ? 'text-primary dark:text-primary'
                                        : 'text-gray-400 active:text-gray-700 dark:text-gray-500 dark:active:text-gray-300'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="mobile-nav-pill"
                                        className="absolute inset-x-1.5 top-1.5 bottom-1.5 rounded-2xl bg-primary/10 dark:bg-primary/15 border border-primary/20"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                                    />
                                )}
                                <span
                                    className={`material-symbols-outlined relative z-10 text-[22px] transition-transform duration-200 ${
                                        isActive ? 'scale-110' : ''
                                    }`}
                                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                    {item.icon}
                                </span>
                                <span className={`relative z-10 text-[10px] font-semibold tracking-tight truncate max-w-[56px] ${isActive ? 'font-bold' : ''}`}>
                                    {t(item.labelKey, item.label)}
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
