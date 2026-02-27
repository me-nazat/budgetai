'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/useCurrency';

interface Budget { id: number; category: string; monthly_limit: number; spent: number; }

const categories = ['Food', 'Transport', 'Housing', 'Utilities', 'Entertainment', 'Shopping', 'Health', 'Education', 'Business', 'Other'];
const catIcons: Record<string, string> = { Food: 'restaurant', Transport: 'directions_car', Housing: 'home', Utilities: 'bolt', Entertainment: 'theater_comedy', Shopping: 'checkroom', Health: 'health_and_safety', Education: 'school', Business: 'business_center', Other: 'category' };
const catColors: Record<string, string> = { Food: 'orange', Transport: 'purple', Housing: 'blue', Utilities: 'yellow', Entertainment: 'pink', Shopping: 'indigo', Health: 'emerald', Education: 'cyan', Business: 'sky', Other: 'gray' };

export default function BudgetPage() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [newCat, setNewCat] = useState('Food');
    const [newLimit, setNewLimit] = useState('');
    const { fmt } = useCurrency();

    const load = () => {
        fetch('/api/budgets').then(r => r.json()).then(d => { setBudgets(d.budgets || []); setLoading(false); }).catch(() => setLoading(false));
    };

    useEffect(load, []);

    const addBudget = async () => {
        if (!newLimit) return;
        await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: newCat, monthly_limit: parseFloat(newLimit) }) });
        setNewLimit(''); setShowAdd(false); load();
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
                { label: 'Total Spent', value: fmt(totalSpent), icon: 'trending_up', color: 'orange-500' },
                { label: 'Remaining', value: fmt(totalBudget - totalSpent), icon: 'savings', color: 'emerald-500' },
                ].map((c, i) => (
                    <div key={i} className="card-premium rounded-xl p-6 relative overflow-hidden group animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="absolute right-0 top-0 p-4 opacity-5 group-hover:opacity-10 transition-all duration-500 group-hover:scale-110">
                            <span className={`material-symbols-outlined text-6xl text-${c.color}`}>{c.icon}</span>
                        </div>
                        <div className="flex items-center gap-3 mb-3 relative z-10">
                            <span className={`material-symbols-outlined text-${c.color} bg-${c.color}/10 p-2.5 rounded-lg`}>{c.icon}</span>
                            <p className="text-gray-500 dark:text-text-muted text-sm font-medium">{c.label}</p>
                        </div>
                        <p className="text-gray-900 dark:text-white text-3xl font-bold tracking-tight relative z-10">{c.value}</p>
                    </div>
                ))}
            </div>

            {/* Add Budget Form */}
            {showAdd && (
                <div className="card-premium rounded-xl p-6 mb-6 animate-slide-up">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Add Budget Category</h3>
                    <div className="flex flex-wrap gap-4 items-center">
                        <select value={newCat} onChange={(e) => setNewCat(e.target.value)}
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#30363d] bg-white/50 dark:bg-surface-dark/50 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary min-w-[200px]">
                            {categories.filter(c => !budgets.find(b => b.category === c)).map(c => <option key={c}>{c}</option>)}
                        </select>
                        <input type="number" placeholder="Monthly limit" value={newLimit} onChange={(e) => setNewLimit(e.target.value)}
                            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-[#30363d] bg-white/50 dark:bg-surface-dark/50 text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary w-40" />
                        <button onClick={addBudget} disabled={!newLimit} className="px-6 py-2 bg-primary text-white rounded-lg font-bold transition-all hover:-translate-y-0.5 btn-primary-glow cursor-pointer disabled:opacity-50 disabled:hover:translate-y-0">Save Budget</button>
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
                                    const color = pct >= 100 ? 'red' : pct >= 80 ? 'orange' : 'primary';
                                    return (
                                        <tr key={b.id} className="hover:bg-gray-50/80 dark:hover:bg-[#111418]/80 transition-colors group animate-fade-in" style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl bg-${catColors[b.category] || 'gray'}-50 dark:bg-${catColors[b.category] || 'gray'}-500/10 text-${catColors[b.category] || 'gray'}-600 dark:text-${catColors[b.category] || 'gray'}-400 group-hover:scale-110 transition-transform duration-300`}>
                                                        <span className="material-symbols-outlined text-[20px]">{catIcons[b.category] || 'category'}</span>
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
                                                        <div className={`h-full bg-${color === 'primary' ? 'primary' : color + '-500'} rounded-full transition-all duration-1000 ease-out relative`} style={{ width: `${Math.min(pct, 100)}%` }}>
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
