'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/useCurrency';

interface RecurringItem { id: number; name: string; type: string; amount: number; category: string; frequency: string; next_date: string; active: number; }

const CATEGORIES = ['Salary', 'Rent', 'Utilities', 'Subscriptions', 'Insurance', 'Groceries', 'Transport', 'Internet', 'Phone', 'Loan', 'Other'];
const FREQUENCIES = [
    { value: 'weekly', label: 'Weekly', icon: '📅' },
    { value: 'monthly', label: 'Monthly', icon: '🗓️' },
    { value: 'yearly', label: 'Yearly', icon: '📆' },
];

export function RecurringContent() {
    const [items, setItems] = useState<RecurringItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [name, setName] = useState('');
    const [type, setType] = useState<'expense' | 'earning'>('expense');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('Other');
    const [frequency, setFrequency] = useState('monthly');
    const [nextDate, setNextDate] = useState(new Date().toISOString().split('T')[0]);
    const { fmt } = useCurrency();

    const load = () => { fetch('/api/recurring').then(r => r.json()).then(d => { setItems(d.items || []); setLoading(false); }); };
    useEffect(load, []);

    const addItem = async () => {
        if (!name || !amount || parseFloat(amount) <= 0) return;
        await fetch('/api/recurring', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, type, amount: parseFloat(amount), category, frequency, next_date: nextDate })
        });
        setName(''); setAmount(''); setCategory('Other'); setFrequency('monthly'); setShowAdd(false); load();
    };

    const remove = async (id: number) => {
        if (!confirm('Remove this recurring item?')) return;
        await fetch('/api/recurring', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        load();
    };

    const expenses = items.filter(i => i.type === 'expense');
    const earnings = items.filter(i => i.type === 'earning');
    const monthlyExpTotal = expenses.reduce((s, i) => s + (i.frequency === 'weekly' ? i.amount * 4.33 : i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0);
    const monthlyEarnTotal = earnings.reduce((s, i) => s + (i.frequency === 'weekly' ? i.amount * 4.33 : i.frequency === 'yearly' ? i.amount / 12 : i.amount), 0);

    const isDueSoon = (dateStr: string) => {
        // eslint-disable-next-line react-hooks/purity
        const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
        return d <= 3 && d >= 0;
    };
    // eslint-disable-next-line react-hooks/purity
    const isOverdue = (dateStr: string) => new Date(dateStr).getTime() < Date.now();

    return (
        <div className="w-full">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recurring Transactions</h2>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Track your regular expenses and income</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="px-5 py-2.5 bg-primary text-white rounded-lg font-bold transition-all hover:-translate-y-0.5 flex items-center gap-2 shadow-md btn-primary-glow">
                    <span className="material-symbols-outlined text-[20px]">{showAdd ? 'close' : 'add'}</span> {showAdd ? 'Cancel' : 'Add Recurring'}
                </button>
            </div>

            {/* Add Form */}
            {showAdd && (
                <div className="card-premium rounded-xl p-6 mb-6 animate-slide-up">
                    <h3 className="text-gray-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">repeat</span> New Recurring Transaction
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Netflix, Rent, Salary"
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Type</label>
                            <div className="flex gap-2">
                                <button onClick={() => setType('expense')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${type === 'expense' ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-800 text-red-600' : 'bg-gray-50 dark:bg-bg-dark border-gray-300 dark:border-[#30363d] text-gray-500'}`}>
                                    ▼ Expense
                                </button>
                                <button onClick={() => setType('earning')} className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all border ${type === 'earning' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-800 text-emerald-600' : 'bg-gray-50 dark:bg-bg-dark border-gray-300 dark:border-[#30363d] text-gray-500'}`}>
                                    ▲ Earning
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Amount</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="1500"
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Category</label>
                            <select value={category} onChange={e => setCategory(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary">
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Frequency</label>
                            <select value={frequency} onChange={e => setFrequency(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary">
                                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.icon} {f.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Next Due Date</label>
                            <input type="date" value={nextDate} onChange={e => setNextDate(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-all">Cancel</button>
                        <button onClick={addItem} disabled={!name || !amount} className="px-6 py-2.5 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5 shadow-md btn-primary-glow disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">save</span> Save
                        </button>
                    </div>
                </div>
            )}

            {/* Monthly Summary */}
            {items.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-8">
                    <div className="card-premium rounded-xl p-5 text-center flex flex-col justify-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <p className="text-gray-500 dark:text-text-muted text-sm font-medium mb-1">Monthly Recurring Expenses</p>
                        <p className="text-2xl font-bold text-red-500 tracking-tight">− {fmt(monthlyExpTotal)}</p>
                    </div>
                    <div className="card-premium rounded-xl p-5 text-center flex flex-col justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <p className="text-gray-500 dark:text-text-muted text-sm font-medium mb-1">Monthly Recurring Income</p>
                        <p className="text-2xl font-bold text-emerald-500 tracking-tight">+ {fmt(monthlyEarnTotal)}</p>
                    </div>
                    <div className="card-premium rounded-xl p-5 text-center flex flex-col justify-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <p className="text-gray-500 dark:text-text-muted text-sm font-medium mb-1">Monthly Net Flow</p>
                        <p className={`text-2xl font-bold tracking-tight ${monthlyEarnTotal - monthlyExpTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {monthlyEarnTotal - monthlyExpTotal >= 0 ? '+' : '−'} {fmt(Math.abs(monthlyEarnTotal - monthlyExpTotal))}
                        </p>
                    </div>
                </div>
            )}

            {/* Items List */}
            {loading ? <div className="text-gray-400 text-center py-12">Loading...</div> :
                items.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">repeat</span>
                        <p className="text-gray-400 text-lg">No recurring transactions</p>
                        <p className="text-gray-400 text-sm mt-1">Add your regular bills and income to track them</p>
                    </div>
                ) : (
                    <div className="card-premium rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.4s' }}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 dark:bg-[#0A0E1A]/50 text-xs text-gray-500 dark:text-text-muted uppercase tracking-wider border-b border-gray-200 dark:border-[#30363d]">
                                        <th className="px-6 py-4 font-semibold">Name</th>
                                        <th className="px-6 py-4 font-semibold">Type</th>
                                        <th className="px-6 py-4 font-semibold">Category</th>
                                        <th className="px-6 py-4 font-semibold">Frequency</th>
                                        <th className="px-6 py-4 font-semibold text-right">Amount</th>
                                        <th className="px-6 py-4 font-semibold">Next Due</th>
                                        <th className="px-6 py-4 font-semibold text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                                    {items.map(item => {
                                        const isExp = item.type === 'expense';
                                        const due = isDueSoon(item.next_date);
                                        const overdue = isOverdue(item.next_date);
                                        return (
                                            <tr key={item.id} className={`hover:bg-gray-50/80 dark:hover:bg-[#111418]/80 transition-colors group animate-fade-in ${overdue ? 'bg-red-50/30 dark:bg-red-900/10' : ''}`} style={{ animationDelay: `${Math.min(items.indexOf(item) * 0.05, 0.5)}s` }}>
                                                <td className="px-6 py-4 text-gray-900 dark:text-white text-sm font-bold">{item.name}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${isExp ? 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'}`}>
                                                        {isExp ? '▼' : '▲'} {item.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm font-medium">{item.category}</td>
                                                <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-sm capitalize font-medium flex items-center gap-1 mt-1">
                                                    {FREQUENCIES.find(f => f.value === item.frequency)?.icon} {item.frequency}
                                                </td>
                                                <td className={`px-6 py-4 text-right text-sm font-bold ${isExp ? 'text-red-500' : 'text-emerald-500'}`}>
                                                    {isExp ? '−' : '+'} {fmt(item.amount)}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className={`flex items-center gap-1.5 text-sm font-bold ${overdue ? 'text-red-500' : due ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400 font-medium'}`}>
                                                        {overdue ? <span className="material-symbols-outlined text-[16px] animate-pulse">error</span> : due ? <span className="material-symbols-outlined text-[16px]">notifications_active</span> : ''}
                                                        {item.next_date}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button onClick={() => remove(item.id)} className="text-gray-400 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex justify-center mx-auto">
                                                        <span className="material-symbols-outlined text-[20px]">delete</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
        </div>
    );
}
