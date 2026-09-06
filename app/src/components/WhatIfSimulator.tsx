'use client';

import { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-white/20 bg-white/90 dark:bg-[#161b22]/90 backdrop-blur-xl p-3 shadow-xl text-xs">
            <p className="font-bold text-gray-900 dark:text-white mb-1">{label}</p>
            <p className="text-primary font-bold">{payload[0].value?.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
    );
}

export default function WhatIfSimulator() {
    const [monthly, setMonthly] = useState(5000);
    const [rate, setRate] = useState(8);
    const [years, setYears] = useState(10);

    const chartData = useMemo(() => {
        const r = rate / 100 / 12;
        const points: { month: string; value: number }[] = [];

        for (let y = 0; y <= years; y++) {
            const n = y * 12;
            const fv = n === 0 ? 0 : monthly * ((Math.pow(1 + r, n) - 1) / r);
            points.push({
                month: `Year ${y}`,
                value: Math.round(fv),
            });
        }
        return points;
    }, [monthly, rate, years]);

    const finalValue = chartData[chartData.length - 1]?.value || 0;
    const totalInvested = monthly * years * 12;
    const totalGains = finalValue - totalInvested;

    return (
        <div className="card-premium rounded-2xl p-5 lg:p-6 animate-fade-in">
            <div className="flex items-center gap-2 mb-5">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                    calculate
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">What-If Savings Simulator</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                {/* Monthly Contribution */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monthly</label>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{monthly.toLocaleString()}</span>
                    </div>
                    <input
                        type="range"
                        min={500}
                        max={100000}
                        step={500}
                        value={monthly}
                        onChange={e => setMonthly(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                </div>
                {/* Interest Rate */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Annual Return</label>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{rate}%</span>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={25}
                        step={0.5}
                        value={rate}
                        onChange={e => setRate(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                </div>
                {/* Time Horizon */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Years</label>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">{years}</span>
                    </div>
                    <input
                        type="range"
                        min={1}
                        max={40}
                        step={1}
                        value={years}
                        onChange={e => setYears(Number(e.target.value))}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Future Value</p>
                    <p className="text-lg font-black text-primary">{finalValue.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-white/5 p-3 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Invested</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white">{totalInvested.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-3 text-center">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Interest Earned</p>
                    <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{totalGains.toLocaleString()}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                            <linearGradient id="simulatorGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#136dec" stopOpacity={0.3} />
                                <stop offset="100%" stopColor="#136dec" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                        <XAxis
                            dataKey="month"
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#136dec"
                            strokeWidth={2.5}
                            fill="url(#simulatorGradient)"
                            animationBegin={0}
                            animationDuration={1200}
                            animationEasing="ease-out"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
