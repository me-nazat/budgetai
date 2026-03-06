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
    { href: '/reports', icon: 'bar_chart', label: 'Reports' },
    { href: '/history', icon: 'chat', label: 'Chat History' },
    { href: '/networth', icon: 'trending_up', label: 'Net Worth' },
    { href: '/goals', icon: 'flag', label: 'Goals' },
    { href: '/recurring', icon: 'repeat', label: 'Recurring' },
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
                className="fixed inset-0 bg-black/50 z-50 lg:hidden backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Menu Drawer */}
            <div className={`
                fixed bottom-0 left-0 w-full bg-white dark:bg-[#0d1117] z-50 lg:hidden
                rounded-t-3xl shadow-2xl transition-transform duration-300 transform
                ${isOpen ? 'translate-y-0' : 'translate-y-full'}
                flex flex-col max-h-[85vh]
            `} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Drag Handle */}
                <div className="w-full h-1.5 flex justify-center py-4 shrink-0" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
                </div>

                {/* Header */}
                <div className="px-6 pb-4 border-b border-gray-100 dark:border-[#30363d] shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                            <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-cover" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-gray-900 dark:text-white text-lg font-bold leading-none">Wealth AI</h2>
                            <p className="text-gray-500 dark:text-text-secondary text-xs">Menu</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 custom-scrollbar">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onClose}
                                className={`flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 ${isActive
                                    ? 'bg-primary/10 text-primary font-bold'
                                    : 'text-gray-600 dark:text-text-secondary active:bg-gray-100 dark:active:bg-[#21262d]'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                                    {item.icon}
                                </span>
                                <span className="text-sm font-medium">
                                    {item.label}
                                </span>
                            </Link>
                        );
                    })}
                </div>

                {/* Footer / Settings */}
                <div className="p-4 border-t border-gray-100 dark:border-[#30363d] shrink-0 bg-gray-50/50 dark:bg-[#0d1117]">
                    <Link
                        href="/settings"
                        onClick={onClose}
                        className="flex items-center gap-4 px-4 py-3 rounded-2xl text-gray-600 dark:text-text-secondary active:bg-gray-200 dark:active:bg-[#21262d] transition-colors mb-2"
                    >
                        <span className="material-symbols-outlined text-[22px]">settings</span>
                        <div className="flex-1">
                            <span className="text-sm font-medium">Settings & Preferences</span>
                        </div>
                    </Link>

                    {user && (
                        <div className="flex items-center gap-3 px-4 py-2 mt-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-purple-600 p-[2px]">
                                <div className="w-full h-full rounded-full bg-white dark:bg-[#0d1117] flex items-center justify-center">
                                    <span className="material-symbols-outlined text-sm text-gray-400">person</span>
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                                <p className="text-xs text-gray-500 dark:text-text-secondary truncate">{user.email}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
