'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useCurrency } from '@/contexts/CurrencyContext';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function SimulatorPage() {
    const { currency, fmt } = useCurrency();

    // Base Scenario Inputs
    const [currentNetWorth, setCurrentNetWorth] = useState<number>(50000);
    const [monthlyIncome, setMonthlyIncome] = useState<number>(5000);
    const [monthlyExpenses, setMonthlyExpenses] = useState<number>(3000);
    const [baseReturnRate, setBaseReturnRate] = useState<number>(7);

    // What-If Scenario Inputs
    const [incomeChange, setIncomeChange] = useState<number>(0);
    const [expenseChange, setExpenseChange] = useState<number>(0);
    const [returnChange, setReturnChange] = useState<number>(0);
    
    const years = 10;

    // Calculate Projections
    const calculateProjection = (income: number, expenses: number, returnRate: number) => {
        let balance = currentNetWorth;
        const monthlyContribution = income - expenses;
        const monthlyRate = (returnRate / 100) / 12;
        const data = [];
        const labels = [];

        for (let i = 0; i <= years * 12; i++) {
            if (i % 12 === 0) {
                data.push(balance);
                labels.push(`Year ${i / 12}`);
            }
            balance = balance * (1 + monthlyRate) + monthlyContribution;
        }

        return { data, labels, finalBalance: data[data.length - 1] };
    };

    const baseProjection = calculateProjection(monthlyIncome, monthlyExpenses, baseReturnRate);
    const simIncome = monthlyIncome * (1 + incomeChange / 100);
    const simExpenses = monthlyExpenses * (1 + expenseChange / 100);
    const simReturnRate = baseReturnRate + returnChange;
    const whatIfProjection = calculateProjection(simIncome, simExpenses, simReturnRate);

    const diff = whatIfProjection.finalBalance - baseProjection.finalBalance;
    const diffPercent = (diff / baseProjection.finalBalance) * 100;

    const chartData = {
        labels: baseProjection.labels,
        datasets: [
            {
                label: 'Base Scenario',
                data: baseProjection.data,
                borderColor: '#6b7280', // gray-500
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 2,
            },
            {
                label: 'What-If Scenario',
                data: whatIfProjection.data,
                borderColor: diff >= 0 ? '#10b981' : '#f43f5e', // emerald or rose
                backgroundColor: diff >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 3,
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
                        return `${context.dataset.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(context.parsed.y)}`;
                    }
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#6b7280' } },
            y: {
                grid: { color: 'rgba(107, 114, 128, 0.1)' },
                ticks: {
                    color: '#6b7280',
                    callback: (value: any) => new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency }).format(value)
                }
            }
        },
        interaction: { intersect: false, mode: 'index' as const }
    };

    return (
        <div className="p-4 lg:p-8 max-w-[1500px] mx-auto page-enter">
            {/* Header */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-500 text-xs font-bold uppercase tracking-wider mb-3">
                    <span className="material-symbols-outlined text-[16px]">science</span>
                    What-If Simulator
                </div>
                <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-gray-900 dark:text-white">Simulate Your Future</h1>
                <p className="mt-2 text-sm font-medium text-gray-500 dark:text-gray-400">See how changes in your income, spending, or market returns affect your wealth over 10 years.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                {/* Inputs Sidebar */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Base Scenario */}
                    <div className="card-premium p-6 rounded-3xl border border-gray-100 dark:border-white/5">
                        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">Base Scenario</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Current Net Worth</label>
                                <input type="number" value={currentNetWorth} onChange={e => setCurrentNetWorth(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-primary dark:text-white" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Income / mo</label>
                                    <input type="number" value={monthlyIncome} onChange={e => setMonthlyIncome(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-primary dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Expense / mo</label>
                                    <input type="number" value={monthlyExpenses} onChange={e => setMonthlyExpenses(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-primary dark:text-white" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Return Rate (%)</label>
                                <input type="number" step="0.1" value={baseReturnRate} onChange={e => setBaseReturnRate(Number(e.target.value))} className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-4 py-2.5 text-sm outline-none focus:border-primary dark:text-white" />
                            </div>
                        </div>
                    </div>

                    {/* What-If Changes */}
                    <div className="card-premium p-6 rounded-3xl border border-blue-500/20 bg-blue-500/5">
                        <h2 className="text-base font-bold text-blue-600 dark:text-blue-400 mb-4">What If...</h2>
                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Income Change</label>
                                    <span className="text-xs font-bold text-blue-500">{incomeChange > 0 ? '+' : ''}{incomeChange}%</span>
                                </div>
                                <input type="range" min="-50" max="100" value={incomeChange} onChange={e => setIncomeChange(Number(e.target.value))} className="w-full accent-blue-500" />
                                <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
                                    <span>{fmt(monthlyIncome * (1 - 0.5))}</span>
                                    <span>{fmt(simIncome)}/mo</span>
                                    <span>{fmt(monthlyIncome * 2)}</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Expense Change</label>
                                    <span className="text-xs font-bold text-blue-500">{expenseChange > 0 ? '+' : ''}{expenseChange}%</span>
                                </div>
                                <input type="range" min="-50" max="100" value={expenseChange} onChange={e => setExpenseChange(Number(e.target.value))} className="w-full accent-blue-500" />
                                <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
                                    <span>{fmt(monthlyExpenses * 0.5)}</span>
                                    <span>{fmt(simExpenses)}/mo</span>
                                    <span>{fmt(monthlyExpenses * 2)}</span>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between mb-2">
                                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase">Return Rate Change</label>
                                    <span className="text-xs font-bold text-blue-500">{returnChange > 0 ? '+' : ''}{returnChange}%</span>
                                </div>
                                <input type="range" min="-10" max="10" step="0.5" value={returnChange} onChange={e => setReturnChange(Number(e.target.value))} className="w-full accent-blue-500" />
                                <div className="text-[10px] text-gray-400 mt-1 text-center">
                                    New Rate: {(baseReturnRate + returnChange).toFixed(1)}%
                                </div>
                            </div>
                            
                            <button onClick={() => { setIncomeChange(0); setExpenseChange(0); setReturnChange(0); }} className="w-full py-2 text-xs font-bold text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors">
                                Reset Scenario
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Impact Summary */}
                    <div className={`card-premium rounded-3xl p-6 border-2 transition-colors ${diff >= 0 ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
                        <div className="flex items-start justify-between">
                            <div>
                                <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    10-Year Impact
                                </p>
                                <h3 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white mb-2">
                                    {diff >= 0 ? '+' : ''}{fmt(diff)}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${diff >= 0 ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/20 text-rose-600 dark:text-rose-400'}`}>
                                        {diff >= 0 ? '+' : ''}{diffPercent.toFixed(1)}% vs Base
                                    </span>
                                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        Final Balance: {fmt(whatIfProjection.finalBalance)}
                                    </span>
                                </div>
                            </div>
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 shadow-lg ${diff >= 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 shadow-emerald-500/10' : 'bg-rose-500/10 border-rose-500/20 text-rose-500 shadow-rose-500/10'}`}>
                                <span className="material-symbols-outlined text-4xl">{diff >= 0 ? 'trending_up' : 'trending_down'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Chart */}
                    <div className="card-premium rounded-3xl p-6 border border-gray-100 dark:border-white/5">
                        <h3 className="text-base font-bold text-gray-900 dark:text-white mb-6">Scenario Comparison</h3>
                        <div className="h-[400px] w-full">
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
