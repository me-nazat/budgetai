'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import QuickAddModal from './QuickAddModal';
import MobileMenu from './MobileMenu';

const mobileNavItems = [
    { href: '/dashboard', icon: 'home', label: 'Home' },
    { href: '/analytics', icon: 'bar_chart', label: 'Analytics' },
    { href: '__quick_add__', icon: 'add', label: 'Add' },
    { href: '/chat', icon: 'smart_toy', label: 'AI Chat' },
    { href: '__menu__', icon: 'menu', label: 'Menu' },
];

export default function MobileTabBar() {
    const pathname = usePathname();
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    return (
        <>
            <div className="lg:hidden fixed bottom-0 left-0 w-full z-50 bg-white/90 dark:bg-[#0A0A0A]/90 backdrop-blur-xl border-t border-gray-200/80 dark:border-[#30363d]/80" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <nav className="flex items-center justify-around h-16 px-2 relative">
                    {mobileNavItems.map((item) => {
                        const isQuickAdd = item.href === '__quick_add__';
                        const isActive = !isQuickAdd && (pathname === item.href || pathname?.startsWith(item.href + '/'));

                        if (isQuickAdd) {
                            return (
                                <button
                                    key="quick-add"
                                    onClick={() => setShowQuickAdd(true)}
                                    className="relative -mt-7 flex flex-col items-center justify-center group"
                                    aria-label="Quick Add Transaction"
                                >
                                    <div className="w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40 transition-all duration-300 active:scale-90 group-hover:shadow-emerald-500/60 group-hover:scale-105">
                                        <span className="material-symbols-outlined text-white text-3xl font-bold">add</span>
                                    </div>
                                </button>
                            );
                        }

                        if (item.href === '__menu__') {
                            return (
                                <button
                                    key="menu"
                                    onClick={() => setShowMenu(true)}
                                    className="flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-all duration-300 relative text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300"
                                    aria-label="Open Menu"
                                >
                                    <span
                                        className="material-symbols-outlined text-[22px] transition-all duration-300"
                                        style={{ fontVariationSettings: "'FILL' 0" }}
                                    >
                                        {item.icon}
                                    </span>
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
                                className={`flex flex-col items-center justify-center w-full h-full space-y-0.5 transition-all duration-300 relative ${isActive
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-gray-400 dark:text-gray-500 active:text-gray-600 dark:active:text-gray-300'
                                    }`}
                            >
                                <span
                                    className={`material-symbols-outlined text-[22px] transition-all duration-300 ${isActive ? 'scale-110' : ''}`}
                                    style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                                >
                                    {item.icon}
                                </span>
                                <span className={`text-[10px] font-semibold tracking-wide transition-all duration-300 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                                    {item.label}
                                </span>
                                {isActive && (
                                    <div className="absolute -top-0.5 w-6 h-1 bg-emerald-500 rounded-b-full" />
                                )}
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
