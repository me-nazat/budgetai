'use client';

/**
 * @fileoverview Mobile drawer navigation menu for 7-Pillar Architecture.
 *
 * Touch-friendly drawer sheet displaying the full 7-Pillar architecture,
 * sub-routes, unread alerts, and quick settings.
 *
 * @module components/MobileMenu
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import LanguageToggle from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { SEVEN_PILLARS, SYSTEM_NAV_ITEMS, NAV_TRANSLATION_MAP } from '@/lib/navigation/registry';

export default function MobileMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const pathname = usePathname();
    const { t } = useLanguage();
    const { data: notificationsData } = useSWR('/api/notifications');
    const unreadCount = notificationsData?.unreadCount || 0;
    const [user, setUser] = useState<{ name: string; email: string; isGuest?: boolean } | null>(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => {
                if (d.user) setUser(d.user);
            })
            .catch(() => {});
    }, []);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-950/60 z-50 lg:hidden backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Menu Drawer */}
            <div
                className={`fixed bottom-0 left-0 w-full z-50 lg:hidden overflow-hidden safe-bottom
                rounded-t-[2rem] border-t border-white/70 bg-white/95 shadow-2xl backdrop-blur-2xl
                transition-transform duration-300 transform dark:border-white/10 dark:bg-[#0A0E1A]/95
                ${isOpen ? 'translate-y-0' : 'translate-y-full'}
                flex flex-col max-h-[88vh]`}
            >
                {/* Drag Handle */}
                <div className="w-full flex justify-center py-2.5 shrink-0 cursor-pointer" onClick={onClose}>
                    <div className="h-1.5 w-12 rounded-full bg-gray-300 dark:bg-gray-600" />
                </div>

                {/* Header */}
                <div className="px-5 pb-3 shrink-0">
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/80 bg-gray-50/80 p-3.5 dark:border-white/10 dark:bg-white/[0.04]">
                        <div className="relative flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0 dark:bg-white/10">
                                <Image src="/wealth-ai-logo-v2.png" alt="Wealth AI" width={40} height={40} className="object-cover" />
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col">
                                <h2 className="truncate text-gray-900 dark:text-white text-sm font-bold">{user?.name || 'Wealth AI'}</h2>
                                <p className="truncate text-gray-500 dark:text-gray-400 text-xs">{user?.email || '7-Pillar Wealth Platform'}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <LanguageToggle />
                                <button
                                    type="button"
                                    onClick={onClose}
                                    aria-label="Close menu"
                                    className="grid h-8 w-8 place-items-center rounded-xl bg-gray-200/60 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 7 Pillars & Sub-Routes */}
                <div className="flex-1 overflow-y-auto px-5 pb-4 custom-scrollbar space-y-4">
                    <div>
                        <p className="px-1 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                            7 Core Pillars
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                            {SEVEN_PILLARS.filter(p => !user?.isGuest || p.id === 'household').map((item) => {
                                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));
                                return (
                                    <div key={item.href} className="rounded-xl border border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02] p-2 space-y-2">
                                        <Link
                                            href={item.href}
                                            onClick={onClose}
                                            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                                                isActive
                                                    ? 'bg-primary/10 text-primary font-bold'
                                                    : 'text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5'
                                            }`}
                                        >
                                            <span className={`material-symbols-outlined text-[20px] ${isActive ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {item.icon}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate">
                                                    {t(NAV_TRANSLATION_MAP[item.id] || item.id, item.label)}
                                                </p>
                                                {item.description && (
                                                    <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate font-normal">
                                                        {item.description}
                                                    </p>
                                                )}
                                            </div>
                                        </Link>

                                        {item.subItems && item.subItems.length > 0 && (
                                            <div className="grid grid-cols-2 gap-1.5 pl-9">
                                                {item.subItems.map(sub => {
                                                    const isSubActive = pathname === sub.href || pathname?.startsWith(sub.href + '/');
                                                    return (
                                                        <Link
                                                            key={sub.href}
                                                            href={sub.href}
                                                            onClick={onClose}
                                                            className={`flex items-center gap-2 p-1.5 rounded-lg text-xs transition-colors ${
                                                                isSubActive
                                                                    ? 'bg-primary/15 text-primary font-bold'
                                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                                                            }`}
                                                        >
                                                            <span className="material-symbols-outlined text-[15px]">{sub.icon}</span>
                                                            <span className="truncate">{t(NAV_TRANSLATION_MAP[sub.id] || sub.id, sub.label)}</span>
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {!user?.isGuest && (
                        <div className="pt-2 border-t border-gray-200/50 dark:border-white/5">
                            <p className="px-1 mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                                System & Alerts
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {SYSTEM_NAV_ITEMS.map((item) => {
                                    const isActive = pathname === item.href;
                                    return (
                                        <Link
                                            key={item.href}
                                            href={item.href}
                                            onClick={onClose}
                                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-200/60 dark:border-white/5 text-xs font-semibold transition-colors ${
                                                isActive
                                                    ? 'bg-primary/10 text-primary font-bold'
                                                    : 'bg-gray-50/50 dark:bg-white/[0.02] text-gray-700 dark:text-gray-300'
                                            }`}
                                        >
                                            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                                            <span className="truncate">{t(NAV_TRANSLATION_MAP[item.id] || item.id, item.label)}</span>
                                            {item.href === '/notifications' && unreadCount > 0 && (
                                                <span className="ml-auto bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                                                    {unreadCount}
                                                </span>
                                            )}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Settings */}
                <div className="p-3 border-t border-gray-200/60 dark:border-white/10 shrink-0 bg-gray-50/80 dark:bg-[#0A0E1A]">
                    <Link
                        href="/settings"
                        onClick={onClose}
                        className="flex items-center gap-3 px-3 py-2 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                    >
                        <span className="material-symbols-outlined text-[20px]">settings</span>
                        <div className="flex-1">
                            <span className="text-xs font-semibold">{t('settings', 'Settings & Security')}</span>
                        </div>
                        <span className="material-symbols-outlined text-[16px] text-gray-400">chevron_right</span>
                    </Link>
                </div>
            </div>
        </>
    );
}
