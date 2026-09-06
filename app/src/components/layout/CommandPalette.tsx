'use client';

import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Search, LayoutDashboard, CalendarDays, Wallet, Target, TrendingUp, Flame, Plane, MessageSquare, Sparkles, Settings, Plus, ArrowRight } from 'lucide-react';
import { useCommandPalette } from '@/hooks/useCommandPalette';

interface CommandItem { id: string; label: string; shortcut?: string; icon: React.ElementType; action: () => void; section: string; }

export function CommandPalette() {
  const { isOpen, close, open } = useCommandPalette();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const closePalette = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    close();
  }, [close]);

  const openPalette = useCallback(() => {
    setQuery('');
    setSelectedIndex(0);
    open();
  }, [open]);

  const commands: CommandItem[] = useMemo(() => [
    { id: 'overview', label: 'Go to Overview', icon: LayoutDashboard, section: 'Navigation', action: () => { router.push('/overview'); closePalette(); } },
    { id: 'my-month', label: 'Go to My Month', icon: CalendarDays, section: 'Navigation', action: () => { router.push('/my-month'); closePalette(); } },
    { id: 'transactions', label: 'Go to Transactions', icon: Wallet, section: 'Navigation', action: () => { router.push('/transactions'); closePalette(); } },
    { id: 'budgets', label: 'Go to Budgets', icon: Target, section: 'Navigation', action: () => { router.push('/budget'); closePalette(); } },
    { id: 'net-worth', label: 'Go to Net Worth', icon: TrendingUp, section: 'Navigation', action: () => { router.push('/wealth-goals'); closePalette(); } },
    { id: 'fire', label: 'Go to FIRE Calculator', icon: Flame, section: 'Navigation', action: () => { router.push('/fire'); closePalette(); } },
    { id: 'tours', label: 'Go to Tour Manager', icon: Plane, section: 'Navigation', action: () => { router.push('/tours'); closePalette(); } },
    { id: 'coach', label: 'Go to AI Coach', icon: MessageSquare, section: 'Navigation', action: () => { router.push('/coach'); closePalette(); } },
    { id: 'achievements', label: 'Go to Achievements', icon: Sparkles, section: 'Navigation', action: () => { router.push('/achievements'); closePalette(); } },
    { id: 'settings', label: 'Go to Settings', icon: Settings, section: 'Navigation', action: () => { router.push('/settings'); closePalette(); } },
    { id: 'add-transaction', label: 'Add Transaction', icon: Plus, shortcut: 'T', section: 'Actions', action: closePalette },
  ], [router, closePalette]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  }, [query, commands]);

  const grouped = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filtered.forEach((item) => { if (!groups[item.section]) groups[item.section] = []; groups[item.section].push(item); });
    return groups;
  }, [filtered]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
  };

  useEffect(() => {
    if (!isOpen) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(focusTimer);
  }, [isOpen]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      if (isOpen) closePalette();
      else openPalette();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isOpen, closePalette, openPalette]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' && filtered.length > 0) { e.preventDefault(); setSelectedIndex((prev) => (prev + 1) % filtered.length); }
      else if (e.key === 'ArrowUp' && filtered.length > 0) { e.preventDefault(); setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length); }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[selectedIndex]?.action(); }
      else if (e.key === 'Escape') { closePalette(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, closePalette]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[300] flex items-start justify-center pt-[15vh]" onClick={closePalette}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="relative w-full max-w-xl glass-strong rounded-2xl border border-border-default shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 px-4 py-4 border-b border-border-subtle">
              <Search size={18} className="text-text-tertiary" />
              <input ref={inputRef} type="text" value={query} onChange={(event) => handleQueryChange(event.target.value)}
                placeholder="Search commands, pages, or actions..."
                className="flex-1 bg-transparent text-text-primary placeholder:text-text-muted outline-none text-sm" />
              <kbd className="px-2 py-1 rounded bg-white/[0.05] text-[10px] font-mono text-text-muted">ESC</kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {Object.entries(grouped).map(([section, items]) => (
                <div key={section}>
                  <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">{section}</div>
                  {items.map((item) => {
                    const globalIdx = filtered.indexOf(item);
                    const isSelected = globalIdx === selectedIndex;
                    const Icon = item.icon;
                    return (
                      <button key={item.id} onClick={item.action} onMouseEnter={() => setSelectedIndex(globalIdx)}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                        <Icon size={16} className={isSelected ? 'text-accent-emerald' : 'text-text-tertiary'} />
                        <span className={`text-sm flex-1 ${isSelected ? 'text-text-primary' : 'text-text-secondary'}`}>{item.label}</span>
                        {item.shortcut && <kbd className="px-1.5 py-0.5 rounded bg-white/[0.05] text-[10px] font-mono text-text-muted">{item.shortcut}</kbd>}
                        {isSelected && <ArrowRight size={14} className="text-accent-emerald" />}
                      </button>
                    );
                  })}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-text-muted text-sm">No results found for "{query}"</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
