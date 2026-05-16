'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { resolveIcon, resolveColor } from '@/lib/categoryUtils';

interface Budget { id: number; category: string; monthly_limit: number; spent: number; }
interface CustomBudgetCategory { id?: number; name: string; icon: string; color: string; }

const STANDARD_CATEGORIES = ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Business', 'Other'];
const DB_ICONS: Record<string, string> = { Food: 'restaurant', Transport: 'directions_car', Housing: 'home', Utilities: 'bolt', Entertainment: 'theater_comedy', Shopping: 'checkroom', Health: 'health_and_safety', Education: 'school', Business: 'business_center', Other: 'category' };
const DB_COLORS: Record<string, string> = { Food: 'orange', Transport: 'purple', Housing: 'blue', Utilities: 'yellow', Entertainment: 'pink', Shopping: 'indigo', Health: 'emerald', Education: 'cyan', Business: 'sky', Other: 'gray' };
const CATEGORY_COLOR_STYLES: Record<string, { icon: string; iconBg: string; text: string }> = {
    orange: { icon: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-500/10', text: 'text-orange-500' },
    purple: { icon: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-500' },
    blue: { icon: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-500' },
    yellow: { icon: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-yellow-50 dark:bg-yellow-500/10', text: 'text-yellow-500' },
    pink: { icon: 'text-pink-600 dark:text-pink-400', iconBg: 'bg-pink-50 dark:bg-pink-500/10', text: 'text-pink-500' },
    indigo: { icon: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-500' },
    emerald: { icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-500' },
    cyan: { icon: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-cyan-50 dark:bg-cyan-500/10', text: 'text-cyan-500' },
    sky: { icon: 'text-sky-600 dark:text-sky-400', iconBg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-500' },
    rose: { icon: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-500' },
    amber: { icon: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-500' },
    teal: { icon: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-500' },
    violet: { icon: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-500/10', text: 'text-violet-500' },
    fuchsia: { icon: 'text-fuchsia-600 dark:text-fuchsia-400', iconBg: 'bg-fuchsia-50 dark:bg-fuchsia-500/10', text: 'text-fuchsia-500' },
    gray: { icon: 'text-gray-600 dark:text-gray-400', iconBg: 'bg-gray-50 dark:bg-gray-500/10', text: 'text-gray-500' },
    primary: { icon: 'text-primary', iconBg: 'bg-primary/10', text: 'text-primary' },
};
const SUMMARY_STYLES: Record<string, { icon: string; iconBg: string; text: string }> = {
    primary: CATEGORY_COLOR_STYLES.primary,
    orange: CATEGORY_COLOR_STYLES.orange,
    emerald: CATEGORY_COLOR_STYLES.emerald,
};
const getColorStyles = (color: string) => CATEGORY_COLOR_STYLES[color] || CATEGORY_COLOR_STYLES.gray;

export default function BudgetPage() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newCat, setNewCat] = useState('Food');
    const [isAddingCustom, setIsAddingCustom] = useState(false);
    const [newCustomCatName, setNewCustomCatName] = useState('');
    const [newLimit, setNewLimit] = useState('');
    const { fmt } = useCurrency();
    const [reloadToken, setReloadToken] = useState(0);
    const [customCategories, setCustomCategories] = useState<CustomBudgetCategory[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function loadBudgetData() {
            try {
                const [catRes, budRes] = await Promise.all([
                    fetch('/api/categories?type=expense'),
                    fetch('/api/budgets'),
                ]);
                const [catData, budData] = await Promise.all([
                    catRes.json(),
                    budRes.json(),
                ]);

                if (cancelled) return;
                setCustomCategories(catData.categories || []);
                setBudgets(budData.budgets || []);
                setLoading(false);
            } catch {
                if (!cancelled) setLoading(false);
            }
        }

        void loadBudgetData();

        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    const mergedCategories = useMemo(
        () => [...STANDARD_CATEGORIES, ...customCategories.map(c => c.name)],
        [customCategories]
    );
    const availableCategories = useMemo(
        () => mergedCategories.filter(c => !budgets.find(b => b.category === c)),
        [budgets, mergedCategories]
    );
    const selectedNewCat = availableCategories.includes(newCat) ? newCat : availableCategories[0] || '';
    
    // Fallback getter functions for dynamic merges
    const getIcon = (catName: string) => {
        if (DB_ICONS[catName]) return DB_ICONS[catName];
        const custom = customCategories.find(c => c.name === catName);
        return custom ? custom.icon : 'category';
    };

    const getColor = (catName: string) => {
        if (DB_COLORS[catName]) return DB_COLORS[catName];
        const custom = customCategories.find(c => c.name === catName);
        return custom ? custom.color : 'gray';
    };

    const addBudget = async () => {
        if (!newLimit) return;
        
        let targetCategory = selectedNewCat;
        if (isAddingCustom && newCustomCatName) {
            targetCategory = newCustomCatName;
            // Optionally persist the new custom category back to the server.
            try {
                const smartIcon = resolveIcon(targetCategory);
                const smartColor = resolveColor(targetCategory);
                await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: targetCategory, type: 'expense', icon: smartIcon, color: smartColor })
                });
            } catch {}
        }

        if (!targetCategory) return;
        
        await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: targetCategory, monthly_limit: parseFloat(newLimit) }) });
        setNewLimit(''); setShowAdd(false); setIsAddingCustom(false); setNewCustomCatName(''); setReloadToken(token => token + 1);
    };

    const totalBudget = budgets.reduce((s, b) => s + b.monthly_limit, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);

    return (
        <div className="p-4 lg:p-8 max-w-[1400px] mx-auto page-enter">
            <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Monthly Budget Planner</h1>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Set spending limits for {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5 btn-primary-glow">
                    <span className="material-symbols-outlined text-lg">{showAdd ? 'close' : 'add'}</span>{showAdd ? 'Cancel' : 'Add Budget'}
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
                {[{ label: 'Total Budget', value: fmt(totalBudget), icon: 'account_balance_wallet', color: 'primary' },
                { label: 'Total Spent', value: fmt(totalSpent), icon: 'trending_up', color: 'orange' },
                { label: 'Remaining', value: fmt(totalBudget - totalSpent), icon: 'savings', color: 'emerald' },
                ].map((c, i) => {
                    const style = SUMMARY_STYLES[c.color] || CATEGORY_COLOR_STYLES.gray;
                    return (
                    <div key={i} className="card-premium rounded-xl p-6 relative overflow-hidden group animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
                            <span className={`material-symbols-outlined text-6xl ${style.text}`}>{c.icon}</span>
                        </div>
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <span className={`material-symbols-outlined ${style.icon} ${style.iconBg} p-2.5 rounded-lg`}>{c.icon}</span>
                            <p className="text-gray-500 dark:text-text-muted text-sm font-medium">{c.label}</p>
                        </div>
                        <p className="text-gray-900 dark:text-white text-3xl font-bold tracking-tight relative z-10">{c.value}</p>
                    </div>
                );})}
            </div>

            {/* Add Budget Form */}
            {showAdd && (
                <div className="card-premium rounded-xl p-6 mb-6 animate-slide-up">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Budget Category</h3>
                    <div className="flex flex-wrap gap-4 items-center">
                        {isAddingCustom ? (
                            <div className="flex items-center gap-2 px-2 py-1 rounded-lg border border-gray-300 dark:border-[#30363d] bg-white dark:bg-surface-dark focus-within:border-primary focus-within:ring-1 focus-within:ring-primary min-w-[200px]">
                                <input 
                                    type="text" 
                                    placeholder="Enter Category Name" 
                                    value={newCustomCatName} 
                                    onChange={e => setNewCustomCatName(e.target.value)} 
                                    className="bg-transparent border-none outline-none text-gray-900 dark:text-white text-sm w-full"
                                    autoFocus
                                />
                                <button type="button" onClick={() => { setIsAddingCustom(false); setNewCustomCatName(''); }} className="text-gray-400 hover:text-rose-500">
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                        ) : (
                            <select value={selectedNewCat} onChange={(e) => {
                                if (e.target.value === '___ADD_CUSTOM___') {
                                    setIsAddingCustom(true);
                                    setNewCat('');
                                } else {
                                    setNewCat(e.target.value);
                                }
                            }}
                                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#30363d] bg-white/50 dark:bg-surface-dark/50 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[200px]">
                                <option value="" disabled>Select a Category...</option>
                                <optgroup label="Standard Categories">
                                    {STANDARD_CATEGORIES.filter(c => !budgets.find(b => b.category === c)).map(c => <option key={c} value={c}>{c}</option>)}
                                </optgroup>
                                {customCategories.length > 0 && (
                                    <optgroup label="Custom Categories">
                                        {customCategories.filter(c => !budgets.find(b => b.category === c.name)).map(c => <option key={`cc-${c.id}`} value={c.name}>{c.name}</option>)}
                                    </optgroup>
                                )}
                                <option value="___ADD_CUSTOM___" className="text-primary font-bold">+ Add Custom Category</option>
                            </select>
                        )}
                        <input type="number" placeholder="Monthly limit" value={newLimit} onChange={(e) => setNewLimit(e.target.value)}
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#30363d] bg-white/50 dark:bg-surface-dark/50 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary w-40" />
                        <button onClick={addBudget} disabled={!newLimit || (!selectedNewCat && !newCustomCatName.trim())} className="px-6 py-2 bg-primary text-white rounded-lg font-bold transition-all hover:-translate-y-0.5 btn-primary-glow cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0">Save Budget</button>
                        <button onClick={() => setShowAdd(false)} className="px-6 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors font-medium">Cancel</button>
                    </div>
                </div>
            )}

            {/* Budget Table */}
            <div className="card-premium rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.3s' }}>
                {loading ? (
                    <div className="p-12 text-center text-gray-400 font-medium flex flex-col items-center justify-center gap-3"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>Loading budgets...</div>
                ) : budgets.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3"><span className="material-symbols-outlined text-5xl opacity-50">account_balance_wallet</span>No budgets set. Click &quot;Add Budget&quot; to get started.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50/50 dark:bg-[#0d1117]/50 text-xs text-gray-500 dark:text-text-muted uppercase tracking-wider border-b border-gray-200 dark:border-[#30363d]">
                                    <th className="px-6 py-4 font-semibold">Category</th>
                                    <th className="px-6 py-4 font-semibold">Spent</th>
                                    <th className="px-6 py-4 font-semibold">Limit</th>
                                    <th className="px-6 py-4 font-semibold w-1/3 min-w-[200px]">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                                {budgets.map((b, i) => {
                                    const pct = b.monthly_limit > 0 ? (b.spent / b.monthly_limit) * 100 : 0;
                                    const progressColor = pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-orange-500' : 'bg-primary';
                                    const catColor = getColor(b.category);
                                    const catIcon = getIcon(b.category);
                                    const catStyle = getColorStyles(catColor);
                                    
                                    return (
                                        <tr key={b.id} className="hover:bg-gray-50/80 dark:hover:bg-[#111418]/80 transition-colors group animate-fade-in" style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl ${catStyle.iconBg} ${catStyle.icon} group-hover:scale-110 transition-transform duration-300`}>
                                                        <span className="material-symbols-outlined text-[20px]">{catIcon}</span>
                                                    </div>
                                                    <span className="text-gray-900 dark:text-white font-bold">{b.category}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-gray-600 dark:text-gray-300 font-medium">{fmt(b.spent)}</td>
                                            <td className="px-6 py-5 text-gray-900 dark:text-white font-bold">{fmt(b.monthly_limit)}</td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex justify-between text-xs font-semibold">
                                                        <span className={`${pct >= 100 ? 'text-red-500' : 'text-gray-500 dark:text-text-muted'}`}>
                                                            {pct >= 100 ? 'Over Limit' : `${pct.toFixed(0)}% Utilized`}
                                                        </span>
                                                        <span className="text-gray-400">
                                                            {pct < 100 && `${fmt(b.monthly_limit - b.spent)} left`}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden shadow-inner">
                                                        <div className={`h-full ${progressColor} rounded-full transition-all duration-1000 ease-out relative`} style={{ width: `${Math.min(pct, 100)}%` }}>
                                                            {pct >= 80 && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
