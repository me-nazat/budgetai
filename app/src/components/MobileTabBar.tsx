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
            <div className="lg:hidden fixed bottom-6 inset-x-4 z-50 rounded-[2rem] bg-white/80 dark:bg-[#161b22]/80 backdrop-blur-2xl border border-gray-200/50 dark:border-white/10 shadow-2xl shadow-black/10 dark:shadow-black/40 transition-all duration-500 ease-out" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                <nav className="flex items-center justify-around h-[68px] px-2 relative">
                    {mobileNavItems.map((item) => {
                        const isQuickAdd = item.href === '__quick_add__';
                        const isActive = !isQuickAdd && (pathname === item.href || pathname?.startsWith(item.href + '/'));

                        if (isQuickAdd) {
                            return (
                                <div key="quick-add" className="relative -mt-10 flex flex-col items-center justify-center group pointer-events-auto">
                                    <div className="absolute inset-x-0 bottom-0 h-10 w-16 mx-auto bg-transparent border-t-[10px] border-l-[10px] border-r-[10px] border-white/80 dark:border-[#161b22]/80 backdrop-blur-2xl rounded-t-[40px] rounded-b-none translate-y-4 opacity-0 pointer-events-none" />

                                    <button
                                        onClick={() => setShowQuickAdd(true)}
                                        className="relative flex items-center justify-center z-10 transition-transform duration-300 ease-spring active:scale-90"
                                        aria-label="Quick Add Transaction"
                                    >
                                        <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-pulse" />
                                        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center shadow-[0_8px_30px_rgb(16,185,129,0.3)] transition-all duration-300 group-hover:shadow-[0_8px_40px_rgb(16,185,129,0.5)] group-hover:-translate-y-1 border border-white/20">
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
