'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/useCurrency';

interface Goal { id: number; name: string; target_amount: number; saved_amount: number; deadline: string | null; created_at: string; }

export default function GoalsPage() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [name, setName] = useState('');
    const [target, setTarget] = useState('');
    const [deadline, setDeadline] = useState('');
    const [contribId, setContribId] = useState<number | null>(null);
    const [contribAmt, setContribAmt] = useState('');
    const { fmt } = useCurrency();

    const load = () => { fetch('/api/goals').then(r => r.json()).then(d => { setGoals(d.goals || []); setLoading(false); }); };
    useEffect(load, []);

    const addGoal = async () => {
        if (!name || !target || parseFloat(target) <= 0) return;
        await fetch('/api/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, target_amount: parseFloat(target), deadline: deadline || null }) });
        setName(''); setTarget(''); setDeadline(''); setShowAdd(false); load();
    };

    const contribute = async (id: number) => {
        if (!contribAmt || parseFloat(contribAmt) <= 0) return;
        await fetch('/api/goals', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, contribution: parseFloat(contribAmt) }) });
        setContribId(null); setContribAmt(''); load();
    };

    const remove = async (id: number) => {
        if (!confirm('Delete this goal?')) return;
        await fetch('/api/goals', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
        load();
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1100px] mx-auto page-enter">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Savings Goals</h1>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Track progress toward your financial targets</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="px-5 py-2.5 bg-primary text-white rounded-lg font-bold transition-all hover:-translate-y-0.5 flex items-center gap-2 shadow-md btn-primary-glow">
                    <span className="material-symbols-outlined text-[20px]">{showAdd ? 'close' : 'add'}</span> {showAdd ? 'Cancel' : 'New Goal'}
                </button>
            </div>

            {/* Add Goal Form */}
            {showAdd && (
                <div className="card-premium rounded-xl p-6 mb-6 animate-slide-up">
                    <h3 className="text-gray-900 dark:text-white font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">flag</span> Create New Goal
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Goal Name</label>
                            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., New Laptop"
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Target Amount</label>
                            <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="50000"
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-500 dark:text-text-muted mb-1 block">Deadline (optional)</label>
                            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-bg-dark border border-gray-300 dark:border-[#30363d] rounded-lg text-gray-900 dark:text-white text-sm outline-none focus:border-primary" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-gray-500 hover:text-gray-900 dark:hover:text-white text-sm font-medium transition-colors">Cancel</button>
                        <button onClick={addGoal} disabled={!name || !target} className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5 btn-primary-glow flex items-center gap-2 disabled:opacity-50 disabled:hover:translate-y-0">
                            Save Goal
                        </button>
                    </div>
                </div>
            )}

            {/* Stats */}
            {goals.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 mb-6">
                    <div className="card-premium rounded-xl p-5 text-center animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <p className="text-gray-500 dark:text-text-muted text-sm font-medium mb-1">Active Goals</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">{goals.length}</p>
                    </div>
                    <div className="card-premium rounded-xl p-5 text-center flex flex-col justify-center animate-slide-up" style={{ animationDelay: '0.2s' }}>
                        <p className="text-gray-500 dark:text-text-muted text-sm font-medium mb-1">Total Saved</p>
                        <p className="text-3xl font-bold text-emerald-500 tracking-tight">{fmt(goals.reduce((s, g) => s + g.saved_amount, 0))}</p>
                    </div>
                    <div className="card-premium rounded-xl p-5 text-center animate-slide-up" style={{ animationDelay: '0.3s' }}>
                        <p className="text-gray-500 dark:text-text-muted text-sm font-medium mb-1">Total Target</p>
                        <p className="text-3xl font-bold text-primary tracking-tight">{fmt(goals.reduce((s, g) => s + g.target_amount, 0))}</p>
                    </div>
                </div>
            )}

            {/* Goals List */}
            {loading ? <div className="text-gray-400 text-center py-12">Loading...</div> :
                goals.length === 0 ? (
                    <div className="text-center py-16">
                        <span className="material-symbols-outlined text-6xl text-gray-300 dark:text-gray-600 mb-4 block">flag</span>
                        <p className="text-gray-400 text-lg">No savings goals yet</p>
                        <p className="text-gray-400 text-sm mt-1">Click &quot;New Goal&quot; to start tracking your savings</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                        {goals.map((g, i) => {
                            const pct = Math.min(100, Math.round((g.saved_amount / g.target_amount) * 100));
                            const isComplete = pct >= 100;
                            // eslint-disable-next-line react-hooks/purity
                            const daysLeft = g.deadline ? Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000) : null;
                            return (
                                <div key={g.id} className={`card-premium rounded-xl p-6 transition-all hover:-translate-y-1 animate-slide-up flex flex-col justify-between group ${isComplete ? 'ring-2 ring-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : ''}`} style={{ animationDelay: `${i * 0.1}s` }}>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isComplete ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-primary/10 text-primary'}`}>
                                                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                                                    {isComplete ? 'check_circle' : 'flag'}
                                                </span>
                                            </div>
                                            <div>
                                                <h3 className="text-gray-900 dark:text-white font-bold">{g.name}</h3>
                                                {g.deadline && (
                                                    <span className={`text-xs ${daysLeft !== null && daysLeft < 0 ? 'text-red-400' : daysLeft !== null && daysLeft < 30 ? 'text-orange-400' : 'text-gray-400'}`}>
                                                        {daysLeft !== null && daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft !== null ? `${daysLeft}d left` : ''} • {g.deadline}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => remove(g.id)} className="text-gray-400 hover:text-red-400 transition-colors">
                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                        </button>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-sm mb-2">
                                            <span className="text-emerald-500 font-bold text-lg">{fmt(g.saved_amount)}</span>
                                            <span className="text-gray-500 dark:text-text-muted font-medium">of {fmt(g.target_amount)}</span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden shadow-inner">
                                            <div className={`h-full rounded-full transition-all duration-1000 ease-out relative ${isComplete ? 'bg-emerald-500' : pct > 60 ? 'bg-primary' : 'bg-blue-400'}`}
                                                style={{ width: `${pct}%` }}>
                                                {pct > 0 && pct < 100 && <div className="absolute inset-0 bg-white/20 animate-pulse"></div>}
                                            </div>
                                        </div>
                                        <div className="flex justify-between mt-2">
                                            <span className={`text-xs font-bold ${isComplete ? 'text-emerald-500' : 'text-primary'}`}>{pct}% completed</span>
                                            <span className="text-xs text-gray-400 font-medium">{fmt(g.target_amount - g.saved_amount)} remaining</span>
                                        </div>
                                    </div>

                                    {/* Contribute */}
                                    {!isComplete && (
                                        contribId === g.id ? (
                                            <div className="flex gap-2 mt-4">
                                                <input type="number" value={contribAmt} onChange={e => setContribAmt(e.target.value)} placeholder="Amount"
                                                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-surface-dark/50 border border-gray-300 dark:border-[#30363d] rounded-lg text-sm text-gray-900 dark:text-white outline-none focus:border-primary transition-colors" autoFocus />
                                                <button onClick={() => contribute(g.id)} className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-bold transition-all shadow-md shadow-emerald-500/20 hover:-translate-y-0.5">Add</button>
                                                <button onClick={() => { setContribId(null); setContribAmt(''); }} className="px-3 py-2 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"><span className="material-symbols-outlined text-[20px]">close</span></button>
                                            </div>
                                        ) : (
                                            <button onClick={() => setContribId(g.id)}
                                                className="w-full mt-4 py-2.5 bg-gray-50/50 dark:bg-surface-dark/30 border border-dashed border-gray-300 dark:border-[#30363d] rounded-xl text-sm font-bold text-gray-500 dark:text-text-muted hover:border-primary hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-1.5 focus:outline-none">
                                                <span className="material-symbols-outlined text-[18px]">add_circle</span> Add Contribution
                                            </button>
                                        )
                                    )}

                                    {isComplete && (
                                        <div className="mt-2 text-center py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                            <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold flex items-center justify-center gap-1">
                                                <span className="material-symbols-outlined text-[16px]">celebration</span> Goal Achieved!
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
        </div>
    );
}
