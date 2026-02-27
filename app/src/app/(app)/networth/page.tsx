'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/hooks/useCurrency';
import { CURRENCIES } from '@/lib/currency';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface Entry { id: number; amount: number; note: string; created_at: string; }

export default function NetWorthPage() {
    const [entries, setEntries] = useState<Entry[]>([]);
    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const { currency, fmt } = useCurrency();
    const sym = CURRENCIES[currency].symbol;

    const load = () => { fetch('/api/networth').then(r => r.json()).then(d => { setEntries(d.entries || []); setLoading(false); }); };
    useEffect(load, []);

    const addEntry = async () => {
        if (!amount) return;
        await fetch('/api/networth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: parseFloat(amount), note }) });
        setAmount(''); setNote(''); setShowAdd(false); load();
    };


    const current = entries[0]?.amount || 0;
    const previous = entries[1]?.amount;
    const change = previous ? ((current - previous) / previous * 100) : 0;
    const reversed = [...entries].reverse();

    const chartData = {
        labels: reversed.map(e => new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
            label: 'Net Worth', data: reversed.map(e => e.amount),
            borderColor: '#136dec', backgroundColor: 'rgba(19, 109, 236, 0.1)',
            fill: true, tension: 0.3, borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#136dec',
        }],
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto page-enter">
            <div className="flex flex-wrap justify-between items-end gap-6 mb-8">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Net Worth Tracker</h1>
                    <p className="text-gray-500 dark:text-text-muted text-sm mt-1">Track your total assets over time</p>
                </div>
                <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5 shadow-md btn-primary-glow">
                    <span className="material-symbols-outlined text-[20px]">{showAdd ? 'close' : 'add'}</span> {showAdd ? 'Cancel' : 'Update Worth'}
                </button>
            </div>

            {/* Current Worth */}
            <div className="card-premium rounded-2xl p-10 mb-6 text-center relative overflow-hidden animate-slide-up">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

                <p className="text-gray-500 dark:text-text-muted text-sm font-medium mb-3 relative z-10 uppercase tracking-widest">Current Net Worth</p>
                <p className="text-gray-900 dark:text-white text-5xl lg:text-7xl font-black tracking-tight relative z-10 mb-2 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 bg-clip-text text-transparent pb-1">{fmt(current)}</p>
                {previous !== undefined && (
                    <div className={`inline-flex items-center gap-1 mt-2 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm relative z-10 transition-transform hover:scale-105 ${change >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'}`}>
                        <span className="material-symbols-outlined text-[20px]">{change >= 0 ? 'trending_up' : 'trending_down'}</span>
                        {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs last update
                    </div>
                )}
            </div>

            {/* Add Entry */}
            {showAdd && (
                <form onSubmit={e => { e.preventDefault(); addEntry(); }} className="card-premium rounded-xl p-6 mb-6 animate-slide-up">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Update Net Worth</h3>
                    <div className="flex flex-wrap gap-4 items-center">
                        <input type="number" placeholder="Total net worth" value={amount} onChange={(e) => setAmount(e.target.value)}
                            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#30363d] bg-white/50 dark:bg-surface-dark/50 text-gray-900 dark:text-white outline-none w-48 focus:border-primary focus:ring-1 focus:ring-primary shadow-inner" />
                        <input type="text" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)}
                            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-[#30363d] bg-white/50 dark:bg-surface-dark/50 text-gray-900 dark:text-white outline-none flex-1 focus:border-primary focus:ring-1 focus:ring-primary shadow-inner" />
                        <button type="submit" disabled={!amount} className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold transition-all hover:-translate-y-0.5 shadow-md btn-primary-glow disabled:opacity-50 disabled:hover:translate-y-0">Save Entry</button>
                    </div>
                </form>
            )}

            {/* Chart */}
            {entries.length > 1 && (
                <div className="card-premium rounded-xl p-6 mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-primary">monitoring</span> Wealth Built Overlay</h3>
                    <div className="h-[340px]">
                        <Line data={chartData} options={{
                            responsive: true, maintainAspectRatio: false,
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                                    titleColor: '#f1f5f9',
                                    bodyColor: '#f1f5f9',
                                    padding: 12,
                                    cornerRadius: 8,
                                    displayColors: false,
                                    callbacks: { label: (ctx) => sym + Number(ctx.parsed.y).toLocaleString() }
                                }
                            },
                            scales: {
                                x: { grid: { display: false }, ticks: { color: '#64748b' } },
                                y: { grid: { color: 'rgba(148, 163, 184, 0.1)' }, border: { dash: [4, 4] }, ticks: { color: '#64748b', callback: (v) => sym + Number(v).toLocaleString() } },
                            },
                            interaction: { intersect: false, mode: 'index' },
                        }} />
                    </div>
                </div>
            )}

            {/* History */}
            <div className="card-premium rounded-xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
                <div className="px-6 py-5 border-b border-gray-200 dark:border-[#30363d] bg-white/50 dark:bg-surface-dark/50">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2"><span className="material-symbols-outlined text-gray-400">history</span> Update History</h3>
                </div>
                {loading ? <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>Loading history...</div> :
                    entries.length === 0 ? <div className="p-12 text-center text-gray-400 flex flex-col items-center justify-center gap-3"><span className="material-symbols-outlined text-5xl opacity-50">timeline</span>No entries yet. Click &quot;Update Net Worth&quot; to start tracking.</div> :
                        <div className="divide-y divide-gray-200/50 dark:divide-gray-800/50">
                            {entries.map((e, i) => (
                                <div key={e.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50/80 dark:hover:bg-[#111418]/80 transition-colors group animate-fade-in" style={{ animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-primary/50 group-hover:bg-primary transition-colors"></div>
                                        <div>
                                            <p className="text-gray-900 dark:text-white font-bold text-lg">{fmt(e.amount)}</p>
                                            {e.note && <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">{e.note}</p>}
                                        </div>
                                    </div>
                                    <span className="text-gray-400 text-sm font-medium bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full self-start sm:self-auto">{new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                </div>
                            ))}
                        </div>
                }
            </div>
        </div>
    );
}
