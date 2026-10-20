'use client';

import { useState, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ReceiptScannerModal } from '@/components/transactions/ReceiptScannerModal';
import QuickAddModal from '@/components/transactions/QuickAddTransactionModal';
import { SEVEN_PILLARS, SYSTEM_NAV_ITEMS } from '@/lib/navigation/registry';
import { usePrivacy } from '@/contexts/PrivacyContext';

const emptySubscribe = () => () => {};

interface CommandItem {
    id: string;
    name: string;
    category: 'Actions' | 'Pillars' | 'Tools & Vault' | 'System';
    icon: string;
    keywords?: string[];
    path?: string;
    action?: 'SCAN_RECEIPT' | 'QUICK_ADD' | 'TOGGLE_PRIVACY';
}

export default function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
    const router = useRouter();
    const { togglePrivacy, isPrivacyMode } = usePrivacy();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const listRef = useRef<HTMLDivElement>(null);

    // Build the command index
    const commands: CommandItem[] = useMemo(() => {
        const actionCmds: CommandItem[] = [
            {
                id: 'action-quick-add',
                name: 'Quick Add Transaction',
                category: 'Actions',
                icon: 'add_circle',
                keywords: ['new', 'expense', 'income', 'create', 'record', 'spend'],
                action: 'QUICK_ADD',
            },
            {
                id: 'action-scan-receipt',
                name: 'Smart Receipt Scanner (OCR)',
                category: 'Actions',
                icon: 'document_scanner',
                keywords: ['receipt', 'scan', 'camera', 'upload', 'ocr', 'invoice'],
                action: 'SCAN_RECEIPT',
            },
            {
                id: 'action-privacy-mode',
                name: isPrivacyMode ? 'Disable Privacy Mode (Reveal balances)' : 'Enable Privacy Mode (Mask balances)',
                category: 'Actions',
                icon: isPrivacyMode ? 'visibility' : 'visibility_off',
                keywords: ['privacy', 'hide', 'mask', 'secret', 'obfuscate'],
                action: 'TOGGLE_PRIVACY',
            },
        ];

        const pillarCmds: CommandItem[] = SEVEN_PILLARS.map(p => ({
            id: `pillar-${p.id}`,
            name: `${p.label}`,
            category: 'Pillars',
            icon: p.icon,
            path: p.href,
            keywords: [p.id, p.description || '', 'pillar', 'go to', p.label.toLowerCase()],
        }));

        const subCmds: CommandItem[] = [
            {
                id: 'insights-cashflow',
                name: 'Cashflow & Spend Intelligence',
                category: 'Tools & Vault',
                icon: 'analytics',
                path: '/insights?view=cashflow',
                keywords: ['cashflow', 'spend', 'analytics', 'waterfall', 'merchants', 'breakdown'],
            },
            {
                id: 'insights-forecast',
                name: '90-Day Cashflow Forecast',
                category: 'Tools & Vault',
                icon: 'show_chart',
                path: '/insights?view=forecast',
                keywords: ['forecast', 'projection', 'runway', 'burn', 'future', 'liquidity'],
            },
            {
                id: 'insights-reports',
                name: 'Financial Statements & Reports',
                category: 'Tools & Vault',
                icon: 'description',
                path: '/insights?view=reports',
                keywords: ['reports', 'export', 'statement', 'p&l', 'profit', 'loss', 'csv', 'pdf'],
            },
        ];
        SEVEN_PILLARS.forEach(p => {
            p.subItems?.forEach(sub => {
                subCmds.push({
                    id: `sub-${sub.id}`,
                    name: `${sub.label} (${p.label})`,
                    category: 'Tools & Vault',
                    icon: sub.icon,
                    path: sub.href,
                    keywords: [sub.id, sub.label.toLowerCase(), p.id],
                });
            });
        });

        const systemCmds: CommandItem[] = SYSTEM_NAV_ITEMS.map(s => ({
            id: `sys-${s.id}`,
            name: s.label,
            category: 'System',
            icon: s.icon,
            path: s.href,
            keywords: [s.id, s.label.toLowerCase(), s.description || ''],
        }));

        return [...actionCmds, ...pillarCmds, ...subCmds, ...systemCmds];
    }, [isPrivacyMode]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(prev => !prev);
                setSearch('');
                setSelectedIndex(0);
            }
            if (e.key === 'Escape') {
                setOpen(false);
            }
        };

        const handleCustomOpen = () => {
            setOpen(true);
            setSearch('');
            setSelectedIndex(0);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('open-command-palette', handleCustomOpen);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-command-palette', handleCustomOpen);
        };
    }, []);

    const filtered = useMemo(() => {
        if (!search.trim()) return commands;
        const q = search.toLowerCase().trim();
        return commands.filter(c => {
            const matchName = c.name.toLowerCase().includes(q);
            const matchCategory = c.category.toLowerCase().includes(q);
            const matchKeywords = c.keywords?.some(k => k.toLowerCase().includes(q));
            return matchName || matchCategory || matchKeywords;
        });
    }, [commands, search]);

    // Handle Keyboard Navigation within the list
    const handleListKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) {
                executeCommand(filtered[selectedIndex]);
            }
        }
    };

    const executeCommand = (cmd: CommandItem) => {
        setOpen(false);
        setSearch('');
        if (cmd.action === 'SCAN_RECEIPT') {
            setIsScannerOpen(true);
        } else if (cmd.action === 'QUICK_ADD') {
            setIsQuickAddOpen(true);
        } else if (cmd.action === 'TOGGLE_PRIVACY') {
            togglePrivacy();
        } else if (cmd.path) {
            router.push(cmd.path);
        }
    };

    if (!mounted) return null;

    return createPortal(
        <>
            <AnimatePresence>
                {open && (
                    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-[12vh] sm:pt-[16vh] px-4 pb-20">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md"
                            onClick={() => setOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: -10 }}
                            transition={{ duration: 0.16, ease: [0.25, 0.1, 0.25, 1] }}
                            className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-white/10"
                            onKeyDown={handleListKeyDown}
                        >
                            {/* Search Header */}
                            <div className="flex items-center px-4 py-3.5 border-b border-gray-100 dark:border-white/10">
                                <span className="material-symbols-outlined text-gray-400 mr-3 text-[22px]">search</span>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Search 7 pillars, ledger, tax, or quick actions..."
                                    value={search}
                                    onChange={e => {
                                        setSearch(e.target.value);
                                        setSelectedIndex(0);
                                    }}
                                    className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder:text-gray-400 text-sm font-medium"
                                />
                                <div className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider ml-3">
                                    <span className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded">esc</span>
                                    to close
                                </div>
                            </div>

                            {/* Command Results */}
                            <div ref={listRef} className="max-h-[360px] overflow-y-auto p-2 custom-scrollbar">
                                {filtered.length === 0 ? (
                                    <div className="py-12 text-center text-gray-400">
                                        <span className="material-symbols-outlined text-3xl mb-2 opacity-50">search_off</span>
                                        <p className="text-sm font-medium">No results found for &ldquo;{search}&rdquo;</p>
                                    </div>
                                ) : (
                                    filtered.map((cmd, idx) => {
                                        const isSelected = idx === selectedIndex;
                                        return (
                                            <button
                                                key={cmd.id}
                                                type="button"
                                                onClick={() => executeCommand(cmd)}
                                                onMouseEnter={() => setSelectedIndex(idx)}
                                                className={`w-full flex items-center gap-3 px-3.5 py-2.5 text-left rounded-xl transition-all cursor-pointer ${
                                                    isSelected
                                                        ? 'bg-primary/10 dark:bg-primary/15 text-primary'
                                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-white/5'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                    isSelected ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400'
                                                }`}>
                                                    <span className="material-symbols-outlined text-[18px]">{cmd.icon}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm truncate ${isSelected ? 'font-bold' : 'font-medium'}`}>
                                                        {cmd.name}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-0.5 rounded bg-gray-100 dark:bg-white/5 shrink-0">
                                                    {cmd.category}
                                                </span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>

                            {/* Footer keyboard guide */}
                            <div className="px-4 py-2 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex items-center justify-between text-[11px] text-gray-400">
                                <span>Navigate with ↑↓, select with Enter</span>
                                <span>Wealth AI Command Center</span>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ReceiptScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} />
            <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
        </>,
        document.body
    );
}
