'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

const menuItems = [
    { href: '/dashboard', icon: 'dashboard', label: 'Dashboard', filled: true },
    { href: '/chat', icon: 'smart_toy', label: 'AI Chat' },
    { href: '/transactions', icon: 'receipt_long', label: 'Transactions' },
    { href: '/budget', icon: 'account_balance_wallet', label: 'Budgets' },
    { href: '/my-month', icon: 'calendar_month', label: 'My Month' },
    { href: '/reports', icon: 'bar_chart', label: 'Reports' },
    { href: '/overview', icon: 'analytics', label: 'Overview' },
    { href: '/wealth-goals', icon: 'flag_circle', label: 'Wealth & Goals' },
    { href: '/fire', icon: 'local_fire_department', label: 'FIRE Simulator' },
    { href: '/recurring-subscriptions', icon: 'repeat', label: 'Recurring & Subs' },
    { href: '/notifications', icon: 'notifications', label: 'Alerts' },
];

export default function MobileMenu({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
    const pathname = usePathname();
    const [user, setUser] = useState<{ name: string; email: string } | null>(null);

    useEffect(() => {
        fetch('/api/auth/me').then(r => r.json()).then(d => {
            if (d.user) setUser(d.user);
        }).catch(() => { });
    }, []);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/55 z-50 lg:hidden backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Menu Drawer */}
            <div className={`
                fixed bottom-0 left-0 w-full z-50 lg:hidden overflow-hidden
                rounded-t-[2rem] border-t border-white/70 bg-white/92 shadow-2xl shadow-slate-950/25 backdrop-blur-2xl
                transition-transform duration-300 transform dark:border-white/10 dark:bg-[#0d1117]/94 dark:shadow-black/55
                ${isOpen ? 'translate-y-0' : 'translate-y-full'}
                flex flex-col max-h-[85vh]
            `} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Drag Handle */}
                <div className="w-full flex justify-center py-3 shrink-0" onClick={onClose}>
                    <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Header */}
                <div className="px-5 pb-4 shrink-0">
                    <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-4 before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-primary/30 dark:border-white/10 dark:from-white/8 dark:to-white/3">
                        <div className="relative flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0 dark:bg-white/10">
                                <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={48} height={48} className="object-cover" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <h2 className="truncate text-gray-900 dark:text-white text-lg font-bold leading-none">{user?.name || 'Wealth AI'}</h2>
                                <p className="truncate text-gray-500 dark:text-text-secondary text-xs mt-1">{user?.email || 'Smart Finance'}</p>
                            </div>
                            <button
                                onClick={onClose}
                                aria-label="Close menu"
                                className="grid h-9 w-9 place-items-center rounded-full bg-gray-100 text-gray-500 active:scale-95 dark:bg-white/10 dark:text-gray-300"
                            >
                                <span className="material-symbols-outlined text-[19px]">close</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto px-5 pb-4 custom-scrollbar">
                    <div className="grid grid-cols-2 gap-2.5">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={`relative overflow-hidden rounded-2xl border p-3.5 transition-all duration-300 ${isActive
                                    ? 'border-primary/20 bg-primary/10 text-primary font-bold shadow-sm'
                                    : 'border-gray-200 bg-gray-50/80 text-gray-600 active:bg-gray-100 dark:border-white/10 dark:bg-white/[0.04] dark:text-text-secondary dark:active:bg-[#21262d]'
                                    }`}
                            >
                                {isActive && <div className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" />}
                                <div className="relative flex items-center gap-3">
                                    <span className={`material-symbols-outlined grid h-9 w-9 place-items-center rounded-xl text-[21px] ${isActive ? 'bg-primary text-white' : 'bg-white text-gray-500 dark:bg-white/10 dark:text-gray-300'}`} style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                                        {item.icon}
                                    </span>
                                    <span className="min-w-0 truncate text-sm font-semibold">
                                        {item.label}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                    </div>
                </div>

                {/* Footer / Settings */}
                <div className="p-4 border-t border-gray-100 dark:border-[#30363d] shrink-0 bg-gray-50/70 dark:bg-[#0d1117]/80">
                    <Link
                        href="/settings"
                        onClick={onClose}
                        className="flex items-center gap-4 px-4 py-3 rounded-2xl text-gray-600 dark:text-text-secondary active:bg-gray-200 dark:active:bg-[#21262d] transition-colors"
                    >
                        <span className="material-symbols-outlined text-[22px]">settings</span>
                        <div className="flex-1">
                            <span className="text-sm font-medium">Settings & Preferences</span>
                        </div>
                        <span className="material-symbols-outlined text-[18px] text-gray-400">chevron_right</span>
                    </Link>
                </div>
            </div>
        </>
    );
}
