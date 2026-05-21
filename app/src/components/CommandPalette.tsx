'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

const COMMANDS = [
    { id: 'dash', name: 'Go to Dashboard', icon: 'dashboard', path: '/dashboard' },
    { id: 'trans', name: 'View Transactions', icon: 'receipt_long', path: '/transactions' },
    { id: 'bud', name: 'Budget Planner', icon: 'account_balance_wallet', path: '/budget' },
    { id: 'wealth', name: 'Wealth & Goals', icon: 'savings', path: '/wealth-goals' },
    { id: 'month', name: 'My Month Calendar', icon: 'calendar_month', path: '/my-month' },
    { id: 'over', name: 'Executive Overview', icon: 'insights', path: '/overview' },
    { id: 'report', name: 'Analytics & Reports', icon: 'bar_chart', path: '/reports' },
    { id: 'recur', name: 'Recurring Payments', icon: 'event_repeat', path: '/recurring' },
    { id: 'noti', name: 'View Notifications', icon: 'notifications', path: '/notifications' },
    { id: 'set', name: 'Preferences & Settings', icon: 'settings', path: '/settings' },
];

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const filtered = COMMANDS.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4 pb-20">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.15 }}
                        className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                    >
                        <div className="flex items-center px-4 py-3 border-b border-gray-100 dark:border-white/5">
                            <span className="material-symbols-outlined text-gray-400 mr-3">search</span>
                            <input
                                type="text"
                                autoFocus
                                placeholder="What do you need to do? (Type to search)"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 font-medium"
                            />
                            <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-3">
                                <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">esc</span>
                                to close
                            </div>
                        </div>

                        <div className="max-h-[300px] overflow-y-auto p-2">
                            {filtered.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <span className="material-symbols-outlined text-3xl mb-2 opacity-50">search_off</span>
                                    <p className="text-sm font-medium">No commands found</p>
                                </div>
                            ) : (
                                filtered.map(cmd => (
                                    <button
                                        key={cmd.id}
                                        onClick={() => {
                                            setOpen(false);
                                            setSearch('');
                                            router.push(cmd.path);
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors group cursor-pointer"
                                    >
                                        <span className="material-symbols-outlined text-gray-400 group-hover:text-primary transition-colors">{cmd.icon}</span>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{cmd.name}</span>
                                        <span className="material-symbols-outlined text-[16px] ml-auto text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all">arrow_forward</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
