'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useCurrency } from '@/hooks/useCurrency';
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export default function FIRECalculatorPage() {
    const { currency, fmt } = useCurrency();
    const [mounted, setMounted] = useState(false);

    // Inputs
    const [currentAge, setCurrentAge] = useState<number>(30);
    const [targetAge, setTargetAge] = useState<number>(45);
    const [currentNetWorth, setCurrentNetWorth] = useState<number>(50000);
    const [monthlyContribution, setMonthlyContribution] = useState<number>(1500);
    const [annualReturnRate, setAnnualReturnRate] = useState<number>(7);
    const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<number>(4);
    const [monthlyExpenses, setMonthlyExpenses] = useState<number>(4000);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Calculations
    const yearsToRetire = Math.max(1, targetAge - currentAge);
    const annualExpenses = monthlyExpenses * 12;
    const fireNumber = annualExpenses / (safeWithdrawalRate / 100);

    const projectionData = useMemo(() => {
        const data = [];
        const labels = [];
        let balance = currentNetWorth;
        const monthlyRate = (annualReturnRate / 100) / 12;

        for (let i = 0; i <= yearsToRetire * 12; i++) {
            if (i % 12 === 0) {
                data.push(balance);
                labels.push(`Age ${currentAge + i / 12}`);
            }
            balance = balance * (1 + monthlyRate) + monthlyContribution;
        }

        return { data, labels, finalBalance: data[data.length - 1] || balance };
    }, [currentAge, targetAge, currentNetWorth, monthlyContribution, annualReturnRate, yearsToRetire]);

    const isOnTrack = projectionData.finalBalance >= fireNumber;
    const progressPercent = Math.min(100, (currentNetWorth / fireNumber) * 100);
    const finalProgressPercent = Math.min(100, (projectionData.finalBalance / fireNumber) * 100);

    const chartData = {
        labels: projectionData.labels,
        datasets: [
            {
                label: 'Projected Net Worth',
                data: projectionData.data,
                borderColor: '#10b981', // emerald-500
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 3,
                pointBackgroundColor: '#10b981',
            },
            {
                label: 'FIRE Target',
                data: Array(projectionData.labels.length).fill(fireNumber),
                borderColor: '#f43f5e', // rose-500
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: { color: '#9ca3af', font: { family: 'inherit', size: 12 } }
            },
            tooltip: {
                callbacks: {
                    label: function(context: any) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false, color: 'rgba(255,255,255,0.05)' },
                ticks: { color: '#6b7280' }
            },
            y: {
                grid: { color: 'rgba(107, 114, 128, 0.1)' },
                ticks: {
                    color: '#6b7280',
                    callback: (value: any) => new Intl.NumberFormat('en-US', { notation: 'compact', compactDisplay: 'short', style: 'currency', currency }).format(value)
                }
            }
        },
        interaction: { intersect: false, mode: 'index' as const }
    };

    if (!mounted) return null;

    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter">
            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-500 text-xs font-bold uppercase tracking-wider mb-3 shadow-[0_0_15px_rgba(249,115,22,0.15)]">
                    <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
                    F.I.R.E. Simulator
                </div>
                <h1 className="text-3xl lg:text-5xl font-black tracking-tight text-gray-900 dark:text-white">Financial Independence</h1>
                <p className="mt-2 max-w-2xl text-sm font-medium text-gray-500 dark:text-text-muted">
                    Calculate your FIRE (Financial Independence, Retire Early) number and see if you are on track.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Inputs Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass-panel p-6 rounded-3xl border border-gray-100 dark:border-white/5">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">tune</span>
                            Simulation Parameters
                        </h2>

                        <div className="space-y-5">
                            {/* Ages */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Current Age</label>
                                    <input type="number" min={18} max={100} value={currentAge} onChange={e => setCurrentAge(Number(e.target.value))} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Target Age</label>
                                    <input type="number" min={currentAge + 1} max={100} value={targetAge} onChange={e => setTargetAge(Number(e.target.value))} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                            </div>

                            {/* Current & Monthly */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Current Net Worth</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : '€'}</span>
                                    <input type="number" min={0} value={currentNetWorth} onChange={e => setCurrentNetWorth(Number(e.target.value))} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 pl-8 pr-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Monthly Contribution</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : '€'}</span>
                                    <input type="number" min={0} value={monthlyContribution} onChange={e => setMonthlyContribution(Number(e.target.value))} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 pl-8 pr-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                            </div>

                            <hr className="border-gray-100 dark:border-white/5" />

                            {/* Rates */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Est. Return (%)</label>
                                    <div className="relative">
                                        <input type="number" min={0} max={20} step={0.1} value={annualReturnRate} onChange={e => setAnnualReturnRate(Number(e.target.value))} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Safe Withdraw (%)</label>
                                    <div className="relative">
                                        <input type="number" min={1} max={10} step={0.1} value={safeWithdrawalRate} onChange={e => setSafeWithdrawalRate(Number(e.target.value))} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Post-Retirement Expenses */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Target Monthly Income</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : '€'}</span>
                                    <input type="number" min={0} value={monthlyExpenses} onChange={e => setMonthlyExpenses(Number(e.target.value))} className="w-full rounded-2xl border-2 border-gray-100 bg-gray-50 pl-8 pr-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-orange-500 dark:border-white/5 dark:bg-white/5 dark:text-white transition-colors" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="glass-panel rounded-3xl p-6 border-2 border-orange-500/20 bg-gradient-to-br from-white to-orange-50 dark:from-bg-dark dark:to-orange-500/5 shadow-[0_0_30px_rgba(249,115,22,0.05)]">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400 mb-1">Your FIRE Number</p>
                                    <h3 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-white">{fmt(fireNumber)}</h3>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">
                                        At a {safeWithdrawalRate}% safe withdrawal rate to yield {fmt(monthlyExpenses)}/mo.
                                    </p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                                    <span className="material-symbols-outlined text-orange-500 text-2xl">flag_circle</span>
                                </div>
                            </div>
                        </div>

                        <div className={`glass-panel rounded-3xl p-6 border-2 ${isOnTrack ? 'border-emerald-500/20 bg-gradient-to-br from-white to-emerald-50 dark:from-bg-dark dark:to-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'border-rose-500/20 bg-gradient-to-br from-white to-rose-50 dark:from-bg-dark dark:to-rose-500/5 shadow-[0_0_30px_rgba(244,63,94,0.05)]'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${isOnTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>Projected Net Worth</p>
                                    <h3 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-white">{fmt(projectionData.finalBalance)}</h3>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-2">
                                        Estimated balance at age {targetAge}
                                    </p>
                                </div>
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${isOnTrack ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                                    <span className="material-symbols-outlined text-2xl">{isOnTrack ? 'check_circle' : 'warning'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="glass-panel rounded-3xl p-6 border border-gray-100 dark:border-white/5">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">FIRE Progress</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                    Currently {progressPercent.toFixed(1)}% to your goal.
                                </p>
                            </div>
                            <div className="text-right">
                                <span className={`text-xl font-black ${isOnTrack ? 'text-emerald-500' : 'text-primary'}`}>
                                    {isOnTrack ? 'On Track' : 'Falling Short'}
                                </span>
                            </div>
                        </div>
                        <div className="h-4 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 shadow-inner relative">
                            {/* Current Progress */}
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPercent}%` }}
                                transition={{ duration: 1, ease: 'easeOut' }}
                                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-blue-500 to-primary rounded-full z-20 shadow-[0_0_10px_rgba(19,109,236,0.5)]"
                            />
                            {/* Projected Progress */}
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${finalProgressPercent}%` }}
                                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
                                className={`absolute top-0 bottom-0 left-0 rounded-full z-10 ${isOnTrack ? 'bg-emerald-500/30' : 'bg-rose-500/30'}`}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-xs font-bold text-gray-400">
                            <span>{fmt(currentNetWorth)} (Now)</span>
                            <span className={isOnTrack ? 'text-emerald-500' : 'text-rose-500'}>{fmt(projectionData.finalBalance)} (Est)</span>
                            <span>{fmt(fireNumber)} (Goal)</span>
                        </div>
                    </div>

                    {/* Projection Chart */}
                    <div className="glass-panel rounded-3xl p-6 border border-gray-100 dark:border-white/5">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6">Growth Projection</h3>
                        <div className="h-[350px] w-full">
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
