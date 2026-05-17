'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
import { useCurrency } from '@/hooks/useCurrency';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

interface NetWorthEntry { id: number; amount: number; note: string; created_at: string; }
interface Goal { id: number; name: string; target_amount: number; saved_amount: number; deadline: string | null; created_at: string; }

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
            body: JSON.stringify({ name, target_amount: parseFloat(target), deadline: deadline || null }),
        });
        setName('');
        setTarget('');
        setDeadline('');
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
        if (!confirm('Delete this goal?')) return;
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
        { label: 'Current Net Worth', value: fmt(currentWorth), icon: 'trending_up', tone: 'text-primary bg-primary/10' },
        { label: 'Goal Progress', value: `${combinedProgress}%`, icon: 'flag_circle', tone: 'text-emerald-600 bg-emerald-500/10' },
        { label: 'Still Needed', value: fmt(remainingTarget), icon: 'route', tone: 'text-amber-600 bg-amber-500/10' },
        { label: 'Monthly Plan', value: fmt(monthlyContribution), icon: 'event_repeat', tone: 'text-violet-600 bg-violet-500/10' },
    ];

    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Wealth plan</p>
                    <h1 className="mt-2 text-2xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">Wealth & Goals</h1>
                    <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-text-muted">
                        Net worth tracking, savings targets, and practical funding guidance in one focused workspace.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setShowWorthForm(v => !v)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/20">
                        <span className="material-symbols-outlined text-[18px]">{showWorthForm ? 'close' : 'add'}</span>
                        {showWorthForm ? 'Cancel' : 'Update Worth'}
                    </button>
                    <button onClick={() => setShowGoalForm(v => !v)} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-gray-200">
                        <span className="material-symbols-outlined text-[18px]">{showGoalForm ? 'close' : 'flag'}</span>
                        {showGoalForm ? 'Cancel' : 'New Goal'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((card, index) => (
                    <div key={card.label} className="card-premium rounded-2xl p-5 animate-slide-up" style={{ animationDelay: `${index * 0.06}s` }}>
                        <div className={`mb-5 grid h-11 w-11 place-items-center rounded-2xl ${card.tone}`}>
                            <span className="material-symbols-outlined">{card.icon}</span>
                        </div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">{card.label}</p>
                        <p className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{card.value}</p>
                    </div>
                ))}
            </div>

            {(showWorthForm || showGoalForm) && (
                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {showWorthForm && (
                        <form onSubmit={e => { e.preventDefault(); void addEntry(); }} className="card-premium rounded-2xl p-5">
                            <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Update Net Worth</h2>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr_auto]">
                                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Total net worth" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-bg-dark dark:text-white" />
                                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-bg-dark dark:text-white" />
                                <button disabled={!amount} className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Save</button>
                            </div>
                        </form>
                    )}
                    {showGoalForm && (
                        <form onSubmit={e => { e.preventDefault(); void addGoal(); }} className="card-premium rounded-2xl p-5">
                            <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Create Savings Goal</h2>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="Goal name" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-bg-dark dark:text-white md:col-span-2" />
                                <input type="number" value={target} onChange={e => setTarget(e.target.value)} placeholder="Target" className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-bg-dark dark:text-white" />
                                <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-bg-dark dark:text-white" />
                            </div>
                            <button disabled={!name || !target} className="mt-4 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Save Goal</button>
                        </form>
                    )}
                </div>
            )}

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="card-premium rounded-2xl p-6 xl:col-span-2">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Wealth Trend</h2>
                            <p className="text-sm text-gray-500 dark:text-text-muted">
                                {previousWorth !== undefined ? `${worthChange >= 0 ? '+' : ''}${worthChange.toFixed(1)}% since last update` : 'Add another entry to see movement.'}
                            </p>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${worthChange >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                            {worthChange >= 0 ? 'Growing' : 'Needs attention'}
                        </span>
                    </div>
                    <div className="h-[320px]">
                        {entries.length > 1 ? (
                            <Line data={chartData} options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    x: { grid: { display: false }, ticks: { color: '#64748b' } },
                                    y: { grid: { color: 'rgba(148, 163, 184, 0.18)' }, ticks: { color: '#64748b', callback: value => fmt(Number(value)) } },
                                },
                            }} />
                        ) : (
                            <div className="grid h-full place-items-center text-center text-gray-400">
                                <div>
                                    <span className="material-symbols-outlined mb-3 block text-5xl opacity-50">timeline</span>
                                    <p className="text-sm font-medium">Add at least two net worth updates to build the trend.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card-premium rounded-2xl p-6">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Funding Strategy</h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-text-muted">A practical monthly pace based on active deadlines.</p>
                    <div className="mt-6 rounded-2xl border border-primary/15 bg-primary/10 p-5 dark:bg-primary/10">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Recommended monthly set-aside</p>
                        <p className="mt-3 text-3xl font-black text-gray-900 dark:text-white">{fmt(monthlyContribution)}</p>
                    </div>
                    <div className="mt-5 space-y-3">
                        {activeGoals.slice(0, 4).map(goal => {
                            const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
                            return (
                                <div key={goal.id} className="rounded-xl border border-gray-100 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{goal.name}</p>
                                        <span className="text-xs font-bold text-primary">{fmt(remaining / monthsUntil(goal.deadline))}/mo</span>
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500 dark:text-text-muted">{fmt(remaining)} remaining over {monthsUntil(goal.deadline)} month{monthsUntil(goal.deadline) === 1 ? '' : 's'}</p>
                                </div>
                            );
                        })}
                        {activeGoals.length === 0 && <p className="text-sm text-gray-400">No active funding gaps. Create a goal to get a plan.</p>}
                    </div>
                </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="xl:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Savings Goals</h2>
                        <span className="text-sm font-semibold text-gray-400">{goals.length} total</span>
                    </div>
                    {loading ? (
                        <div className="card-premium rounded-2xl p-12 text-center text-gray-400">Loading...</div>
                    ) : goals.length === 0 ? (
                        <div className="card-premium rounded-2xl p-12 text-center text-gray-400">No savings goals yet.</div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            {goals.map(goal => {
                                const pct = Math.min(100, Math.round((goal.saved_amount / goal.target_amount) * 100));
                                const complete = pct >= 100;
                                const remaining = Math.max(0, goal.target_amount - goal.saved_amount);
                                const daysLeft = goal.deadline ? Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / 86400000) : null;
                                return (
                                    <div key={goal.id} className={`card-premium rounded-2xl p-5 ${complete ? 'ring-2 ring-emerald-500/40' : ''}`}>
                                        <div className="mb-4 flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <span className={`material-symbols-outlined grid h-10 w-10 place-items-center rounded-xl ${complete ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'}`}>{complete ? 'check_circle' : 'flag'}</span>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 dark:text-white">{goal.name}</h3>
                                                    {goal.deadline && <p className="text-xs text-gray-400">{daysLeft !== null && daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`} - {goal.deadline}</p>}
                                                </div>
                                            </div>
                                            <button onClick={() => void removeGoal(goal.id)} className="text-gray-400 hover:text-rose-500">
                                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                            </button>
                                        </div>
                                        <div className="mb-3 flex items-end justify-between">
                                            <p className="text-xl font-black text-emerald-600">{fmt(goal.saved_amount)}</p>
                                            <p className="text-sm font-semibold text-gray-500">of {fmt(goal.target_amount)}</p>
                                        </div>
                                        <div className="h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                            <div className={`h-full rounded-full ${complete ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                                        </div>
                                        <div className="mt-2 flex items-center justify-between text-xs font-bold">
                                            <span className={complete ? 'text-emerald-600' : 'text-primary'}>{pct}% complete</span>
                                            <span className="text-gray-400">{fmt(remaining)} remaining</span>
                                        </div>
                                        {!complete && (
                                            contribId === goal.id ? (
                                                <div className="mt-4 flex gap-2">
                                                    <input type="number" value={contribAmt} onChange={e => setContribAmt(e.target.value)} placeholder="Amount" className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary dark:border-white/10 dark:bg-bg-dark dark:text-white" />
                                                    <button onClick={() => void contribute(goal.id)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-white">Add</button>
                                                    <button onClick={() => { setContribId(null); setContribAmt(''); }} className="rounded-xl px-2 text-gray-400 hover:text-gray-900 dark:hover:text-white"><span className="material-symbols-outlined text-[18px]">close</span></button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setContribId(goal.id)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-2.5 text-sm font-bold text-gray-500 hover:border-primary hover:text-primary dark:border-white/10">
                                                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                                                    Add Contribution
                                                </button>
                                            )
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">Net Worth History</h2>
                    <div className="card-premium max-h-[640px] overflow-hidden rounded-2xl">
                        {loading ? (
                            <div className="p-8 text-center text-gray-400">Loading...</div>
                        ) : entries.length === 0 ? (
                            <div className="p-8 text-center text-gray-400">No net worth entries yet.</div>
                        ) : (
                            <div className="divide-y divide-gray-100 overflow-y-auto dark:divide-white/10">
                                {entries.map(entry => (
                                    <div key={entry.id} className="p-4 hover:bg-gray-50 dark:hover:bg-white/5">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-lg font-black text-gray-900 dark:text-white">{fmt(entry.amount)}</p>
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-500 dark:bg-white/10">{new Date(entry.created_at).toLocaleDateString()}</span>
                                        </div>
                                        {entry.note && <p className="mt-1 text-sm text-gray-500 dark:text-text-muted">{entry.note}</p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
