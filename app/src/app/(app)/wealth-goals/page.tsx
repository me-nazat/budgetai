'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { useCurrency } from '@/hooks/useCurrency';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface NetWorthEntry { id: number; amount: number; note: string; created_at: string; }
interface Goal { id: number; name: string; target_amount: number; saved_amount: number; deadline: string | null; linked_account: string | null; created_at: string; }

function monthsUntil(deadline: string | null) {
    if (!deadline) return 12;
    const diff = new Date(deadline).getTime() - Date.now();
    return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 30)));
}

export default function WealthGoalsPage() {
    const [entries, setEntries] = useState<NetWorthEntry[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showWorthForm, setShowWorthForm] = useState(false);
    const [showGoalForm, setShowGoalForm] = useState(false);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [name, setName] = useState('');
    const [target, setTarget] = useState('');
    const [deadline, setDeadline] = useState('');
    const [linkedAccount, setLinkedAccount] = useState('');
    const [contribId, setContribId] = useState<number | null>(null);
    const [contribAmt, setContribAmt] = useState('');
    const { fmt } = useCurrency();

    const load = async () => {
        setLoading(true);
        try {
            const [worthRes, goalsRes] = await Promise.all([fetch('/api/networth'), fetch('/api/goals')]);
            const [worthData, goalsData] = await Promise.all([worthRes.json(), goalsRes.json()]);
            setEntries(worthData.entries || []);
            setGoals(goalsData.goals || []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { void load(); }, []);

    const addEntry = async () => {
        if (!amount) return;
        await fetch('/api/networth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: parseFloat(amount), note }),
        });
        setAmount('');
        setNote('');
        setShowWorthForm(false);
        await load();
    };

    const addGoal = async () => {
        if (!name || !target || parseFloat(target) <= 0) return;
        await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, target_amount: parseFloat(target), deadline: deadline || null, linked_account: linkedAccount || '' }),
        });
        setName('');
        setTarget('');
        setDeadline('');
        setLinkedAccount('');
        setShowGoalForm(false);
        await load();
    };

    const contribute = async (id: number) => {
        if (!contribAmt || parseFloat(contribAmt) <= 0) return;
        await fetch('/api/goals', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, contribution: parseFloat(contribAmt) }),
        });
        setContribId(null);
        setContribAmt('');
        await load();
    };

    const removeGoal = async (id: number) => {
        if (!confirm('Delete this goal permanently?')) return;
        await fetch('/api/goals', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        await load();
    };

    const currentWorth = entries[0]?.amount || 0;
    const previousWorth = entries[1]?.amount;
    const worthChange = previousWorth ? ((currentWorth - previousWorth) / previousWorth) * 100 : 0;
    const totalSaved = goals.reduce((sum, goal) => sum + goal.saved_amount, 0);
    const totalTarget = goals.reduce((sum, goal) => sum + goal.target_amount, 0);
    const remainingTarget = Math.max(0, totalTarget - totalSaved);
    const activeGoals = goals.filter(goal => goal.saved_amount < goal.target_amount);
    const combinedProgress = totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 100)) : 0;
    const monthlyContribution = activeGoals.reduce((sum, goal) => {
        const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
        return sum + remaining / monthsUntil(goal.deadline);
    }, 0);

    const reversed = useMemo(() => [...entries].reverse(), [entries]);
    const chartData = {
        labels: reversed.map(e => new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
            label: 'Net Worth',
            data: reversed.map(e => e.amount),
            borderColor: '#136dec',
            backgroundColor: 'rgba(19, 109, 236, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 4,
            pointBackgroundColor: '#136dec',
        }],
    };

    const summaryCards = [
        { label: 'Current Net Worth', value: fmt(currentWorth), icon: 'account_balance', tone: 'text-primary bg-primary/10 border-primary/20' },
        { label: 'Goal Progress', value: `${combinedProgress}%`, icon: 'donut_large', tone: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
        { label: 'Still Needed', value: fmt(remainingTarget), icon: 'track_changes', tone: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
        { label: 'Monthly Target', value: fmt(monthlyContribution), icon: 'next_plan', tone: 'text-teal-600 bg-teal-500/10 border-teal-500/20' },
    ];

    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter">
            {/* ENHANCED HEADER */}
            <div className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider mb-3 shadow-[0_0_15px_rgba(19,109,236,0.15)]">
                        <span className="material-symbols-outlined text-[16px]">stars</span>
                        Premium Wealth Manager
                    </div>
                    <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">Wealth & Goals</h1>
                    <p className="mt-2 max-w-2xl text-sm font-medium text-gray-500 dark:text-text-muted">
                        Track your ultimate financial freedom. Set targets, monitor net worth, and achieve milestones effortlessly.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <button onClick={() => { setShowWorthForm(v => !v); setShowGoalForm(false); }} 
                        className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg transition-all active:scale-95 ${showWorthForm ? 'bg-gray-800 text-white dark:bg-white dark:text-black shadow-gray-400/20' : 'bg-primary text-white shadow-primary/30 hover:bg-blue-600'}`}>
                        <span className="material-symbols-outlined text-[20px]">{showWorthForm ? 'close' : 'add_chart'}</span>
                        {showWorthForm ? 'Cancel Update' : 'Update Net Worth'}
                    </button>
                    <button onClick={() => { setShowGoalForm(v => !v); setShowWorthForm(false); }} 
                        className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold shadow-lg transition-all active:scale-95 border ${showGoalForm ? 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-white/10 dark:border-white/20 dark:text-white' : 'bg-white border-gray-200 text-gray-800 hover:border-emerald-500 hover:text-emerald-600 dark:bg-bg-dark dark:border-white/10 dark:text-gray-200 dark:hover:border-emerald-500 shadow-gray-200/50 dark:shadow-none'}`}>
                        <span className="material-symbols-outlined text-[20px]">{showGoalForm ? 'close' : 'add_task'}</span>
                        {showGoalForm ? 'Cancel Goal' : 'Create New Goal'}
                    </button>
                </div>
            </div>

            {/* QUICK STATS CARDS */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
                {summaryCards.map((card, index) => (
                    <div key={card.label} className="card-premium rounded-3xl p-6 animate-slide-up border border-transparent hover:border-gray-200 dark:hover:border-white/10 transition-colors" style={{ animationDelay: `${index * 0.05}s` }}>
                        <div className={`mb-6 grid h-14 w-14 place-items-center rounded-2xl border ${card.tone}`}>
                            <span className="material-symbols-outlined text-[28px]">{card.icon}</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-400 dark:text-gray-500">{card.label}</p>
                        <p className="mt-2 text-3xl font-black tracking-tight text-gray-900 dark:text-white">{card.value}</p>
                    </div>
                ))}
            </div>

            {/* FORMS SECTION WITH ANIMATIONS */}
            {(showWorthForm || showGoalForm) && (
                <div className="mb-6 grid grid-cols-1 gap-4 animate-fade-in">
                    {showWorthForm && (
                        <form onSubmit={e => { e.preventDefault(); void addEntry(); }} className="card-premium rounded-3xl p-6 lg:p-8 border-2 border-primary/20 shadow-[0_0_40px_rgba(19,109,236,0.08)]">
                            <h2 className="mb-6 text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">monitoring</span>
                                Log Net Worth Update
                            </h2>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr_auto]">
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Total Asset Value" className="rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-4 text-sm font-bold text-gray-900 outline-none focus:border-primary dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note (e.g., 'Stock market rally', 'Bought car')" className="rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-900 outline-none focus:border-primary dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                <button disabled={!amount} className="rounded-2xl bg-primary px-8 py-4 text-sm font-bold text-white shadow-lg shadow-primary/30 disabled:opacity-50 hover:bg-blue-600 active:scale-95 transition-all">Record Entry</button>
                            </div>
                        </form>
                    )}
                    {showGoalForm && (
                        <form onSubmit={e => { e.preventDefault(); void addGoal(); }} className="card-premium rounded-3xl p-6 lg:p-8 border-2 border-emerald-500/20 shadow-[0_0_40px_rgba(16,185,129,0.08)]">
                            <h2 className="mb-6 text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">flag</span>
                                Define Savings Target
                            </h2>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Goal Title</label>
                                    <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New House Downpayment" className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-4 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Linked Account (Optional)</label>
                                    <input value={linkedAccount} onChange={e => setLinkedAccount(e.target.value)} placeholder="e.g. Chase Savings" className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-900 outline-none focus:border-emerald-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Target Amount</label>
                                    <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="0.00" className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-4 text-sm font-bold text-gray-900 outline-none focus:border-emerald-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Target Date (Optional)</label>
                                    <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-5 py-4 text-sm font-medium text-gray-900 outline-none focus:border-emerald-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end">
                                <button disabled={!name || !target} className="rounded-2xl bg-emerald-500 px-8 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 disabled:opacity-50 hover:bg-emerald-600 active:scale-95 transition-all">Launch Goal</button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                {/* SAVINGS GOALS MAIN VIEW */}
                <div className="xl:col-span-2 flex flex-col">
                    <div className="mb-5 flex items-center justify-between">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white">Active Goals</h2>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-white/10 text-xs font-bold text-gray-600 dark:text-gray-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            {goals.length} Tracked
                        </span>
                    </div>
                    
                    {loading ? (
                        <div className="flex-1 card-premium rounded-3xl p-12 flex items-center justify-center">
                            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        </div>
                    ) : goals.length === 0 ? (
                        <div className="flex-1 card-premium rounded-3xl p-12 text-center flex flex-col items-center justify-center border border-dashed border-gray-300 dark:border-white/10">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-4xl text-gray-400">flag</span>
                            </div>
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No active goals found</h3>
                            <p className="text-sm text-gray-500 max-w-sm mb-6">Create your first savings goal to get AI-powered recommendations on monthly contributions.</p>
                            <button onClick={() => setShowGoalForm(true)} className="rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-3 font-bold text-sm shadow-lg active:scale-95 transition-transform">Create Goal</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                            {goals.map(goal => {
                                const pct = Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100));
                                const complete = pct >= 100;
                                const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
                                const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000) : null;
                                
                                return (
                                    <div key={goal.id} className={`card-premium relative overflow-hidden rounded-3xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${complete ? 'border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] bg-gradient-to-b from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-bg-dark' : 'border border-gray-100 dark:border-white/5 hover:border-primary/30'}`}>
                                        {/* Background Progress watermark */}
                                        <div className="absolute right-0 bottom-0 pointer-events-none opacity-[0.03] dark:opacity-[0.02]">
                                            <span className="material-symbols-outlined text-[150px] -mr-10 -mb-10">{complete ? 'verified' : 'savings'}</span>
                                        </div>

                                        <div className="relative mb-6 flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-4">
                                                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${complete ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-primary/10 text-primary border border-primary/20'}`}>
                                                    <span className="material-symbols-outlined text-[24px]">{complete ? 'emoji_events' : 'flag'}</span>
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-black text-gray-900 dark:text-white truncate text-lg leading-tight">{goal.name}</h3>
                                                    {goal.linked_account && (
                                                        <p className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded inline-block mt-1 mr-2">{goal.linked_account}</p>
                                                    )}
                                                    {goal.deadline && (
                                                        <p className={`text-xs font-bold inline-block mt-1 ${daysLeft !== null && daysLeft < 0 ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                                            {daysLeft !== null && daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`} • {goal.deadline}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <button onClick={() => void removeGoal(goal.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gray-50 text-gray-400 hover:bg-rose-50 hover:text-rose-500 dark:bg-white/5 dark:hover:bg-rose-500/20 transition-colors">
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>

                                        <div className="relative mb-5 flex items-end justify-between">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">Current Balance</span>
                                                <p className={`text-3xl font-black ${complete ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>{fmt(goal.saved_amount)}</p>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="text-xs font-bold uppercase text-gray-400 tracking-wider mb-1">Target</span>
                                                <p className="text-lg font-bold text-gray-500">{fmt(goal.target_amount)}</p>
                                            </div>
                                        </div>

                                        <div className="relative mb-4 flex items-center justify-between bg-gray-50 dark:bg-white/5 p-4 rounded-2xl">
                                            <div>
                                                <div className="text-xs font-bold text-gray-500 mb-1">Target Funding</div>
                                                <div className="font-black text-gray-900 dark:text-white flex items-baseline gap-1">
                                                    {fmt(remaining)} <span className="text-xs font-medium text-gray-400">left</span>
                                                </div>
                                            </div>
                                            <div 
                                                className="relative w-[52px] h-[52px] rounded-full flex items-center justify-center shrink-0" 
                                                style={{ background: `conic-gradient(${complete ? '#10b981' : '#136dec'} ${pct}%, ${complete ? 'rgba(16,185,129,0.1)' : 'rgba(19,109,236,0.1)'} ${pct}%)` }}
                                            >
                                                <div className="absolute inset-[3px] bg-white dark:bg-[#1a1f2e] rounded-full flex items-center justify-center">
                                                    <span className={`text-[11px] font-black ${complete ? 'text-emerald-500' : 'text-primary'}`}>{pct}%</span>
                                                </div>
                                            </div>
                                        </div>

                                        {!complete && (
                                            contribId === goal.id ? (
                                                <div className="mt-5 flex gap-2 animate-fade-in relative z-10 bg-gray-50 dark:bg-white/5 p-2 rounded-2xl border border-gray-200 dark:border-white/10">
                                                    <input type="number" value={contribAmt} onChange={e => setContribAmt(e.target.value)} placeholder="Add funds" className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-bg-dark dark:text-white transition-all shadow-inner" />
                                                    <button onClick={() => void contribute(goal.id)} className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-black text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all">Add</button>
                                                    <button onClick={() => { setContribId(null); setContribAmt(''); }} className="grid w-11 place-items-center rounded-xl bg-white text-gray-400 hover:text-gray-900 dark:bg-bg-dark dark:hover:text-white shadow-inner"><span className="material-symbols-outlined text-[20px]">close</span></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setContribId(goal.id)} className="relative z-10 mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-3.5 text-sm font-bold text-gray-600 hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:border-primary dark:hover:bg-primary/10 transition-all active:scale-[0.98]">
                                                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                                    Log Contribution
                                                </button>
                                            )
                                        )}
                                        {complete && (
                                            <div className="relative z-10 mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-sm font-bold text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                <span className="material-symbols-outlined text-[20px]">celebration</span>
                                                Goal Accomplished!
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* SIDEBAR ANALYTICS */}
                <div className="space-y-6">
                    <div className="card-premium rounded-3xl p-6 border border-gray-100 dark:border-white/5">
                        <div className="mb-6 flex flex-col">
                            <h2 className="text-xl font-black text-gray-900 dark:text-white">Net Worth Trend</h2>
                            <p className="text-sm font-medium text-gray-500 mt-1">
                                {previousWorth !== undefined ? (
                                    <span className="flex items-center gap-1">
                                        <span className={`material-symbols-outlined text-[16px] ${worthChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{worthChange >= 0 ? 'trending_up' : 'trending_down'}</span>
                                        <span className={worthChange >= 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>{Math.abs(worthChange).toFixed(1)}%</span>
                                        {" "}movement since last log
                                    </span>
                                ) : 'Add another entry to see movement.'}
                            </p>
                        </div>
                        <div className="h-[240px] w-full">
                            {entries.length > 1 ? (
                                <Line data={chartData} options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: {
                                        x: { grid: { display: false }, ticks: { color: '#64748b', maxRotation: 45, minRotation: 45, font: { size: 10 } } },
                                        y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, border: { dash: [4, 4] }, ticks: { color: '#64748b', font: { size: 11 }, callback: value => fmt(Number(value)) } },
                                    },
                                    interaction: { intersect: false, mode: 'index' }
                                }} />
                            ) : (
                                <div className="grid h-full place-items-center text-center text-gray-400 rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                                    <div>
                                        <span className="material-symbols-outlined mb-2 block text-4xl opacity-40">show_chart</span>
                                        <p className="text-xs font-bold px-6">Not enough data to graph.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="card-premium rounded-3xl p-6 border border-gray-100 dark:border-white/5 bg-gradient-to-br from-white to-gray-50 dark:from-bg-dark dark:to-white/5">
                        <h2 className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">auto_awesome</span>
                            Smart Strategy
                        </h2>
                        <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">Based on your active goals and their deadlines, here is your required monthly pace.</p>
                        
                        <div className="mt-6 rounded-2xl border-2 border-primary/20 bg-white dark:bg-bg-dark p-5 shadow-[0_4px_20px_rgba(19,109,236,0.08)] text-center relative overflow-hidden">
                            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl"></div>
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary mb-2 relative z-10">Monthly Set-Aside</p>
                            <p className="text-4xl font-black text-gray-900 dark:text-white relative z-10">{fmt(monthlyContribution)}</p>
                        </div>
                        
                        <div className="mt-6 space-y-3">
                            {activeGoals.slice(0, 3).map(goal => {
                                const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
                                const req = remaining / monthsUntil(goal.deadline);
                                return (
                                    <div key={goal.id} className="flex items-center justify-between gap-3 rounded-xl p-2 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{goal.name}</p>
                                            <p className="text-xs text-gray-500">{monthsUntil(goal.deadline)} months to go</p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="block text-sm font-bold text-primary">{fmt(req)}<span className="text-xs text-gray-400 font-medium">/mo</span></span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
