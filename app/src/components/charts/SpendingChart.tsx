'use client';

import { useMemo } from 'react';
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from 'recharts';

interface SpendingChartProps {
    data: Array<{ date: string; expenses: number; earnings: number }>;
    variant?: 'area' | 'bar';
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string }>; label?: string }) {
    if (!active || !payload?.length) return null;

    return (
        <div className="rounded-xl border border-white/20 bg-white/90 dark:bg-[#161b22]/90 backdrop-blur-xl p-3 shadow-xl text-xs min-w-[140px]">
            <p className="font-bold text-gray-900 dark:text-white mb-1.5">{label}</p>
            {payload.map((entry) => (
                <div key={entry.dataKey} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                        <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: entry.dataKey === 'expenses' ? '#ef4444' : '#22c55e' }}
                        />
                        <span className="text-gray-500 dark:text-gray-400 capitalize">{entry.dataKey}</span>
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white">
                        {entry.value?.toLocaleString()}
                    </span>
                </div>
            ))}
        </div>
    );
}

export default function SpendingChart({ data, variant = 'area' }: SpendingChartProps) {
    const chartData = useMemo(() => {
        return data.map(d => ({
            ...d,
            name: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        }));
    }, [data]);

    if (chartData.length === 0) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                <div className="text-center">
                    <span className="material-symbols-outlined text-4xl mb-2 opacity-40 block">bar_chart</span>
                    <p className="text-xs font-bold">No spending data yet</p>
                </div>
            </div>
        );
    }

    const commonProps = {
        data: chartData,
        margin: { top: 8, right: 8, left: -16, bottom: 0 },
    };

    const xAxisProps = {
        dataKey: 'name' as const,
        tick: { fontSize: 10, fill: '#94a3b8' },
        axisLine: false,
        tickLine: false,
    };

    const yAxisProps = {
        tick: { fontSize: 10, fill: '#94a3b8' },
        axisLine: false,
        tickLine: false,
        tickFormatter: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value),
    };

    if (variant === 'bar') {
        return (
            <ResponsiveContainer width="100%" height="100%">
                <BarChart {...commonProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                    <XAxis {...xAxisProps} />
                    <YAxis {...yAxisProps} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                        dataKey="expenses"
                        fill="url(#expenseGradient)"
                        radius={[6, 6, 0, 0]}
                        animationBegin={0}
                        animationDuration={800}
                        animationEasing="ease-out"
                    />
                    <Bar
                        dataKey="earnings"
                        fill="url(#earningGradient)"
                        radius={[6, 6, 0, 0]}
                        animationBegin={200}
                        animationDuration={800}
                        animationEasing="ease-out"
                    />
                    <defs>
                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.5} />
                        </linearGradient>
                        <linearGradient id="earningGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.5} />
                        </linearGradient>
                    </defs>
                </BarChart>
            </ResponsiveContainer>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart {...commonProps}>
                <defs>
                    <linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="earningArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="earnings"
                    stroke="#22c55e"
                    strokeWidth={2}
                    fill="url(#earningArea)"
                    animationBegin={0}
                    animationDuration={1000}
                    animationEasing="ease-out"
                />
                <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="#ef4444"
                    strokeWidth={2}
                    fill="url(#expenseArea)"
                    animationBegin={200}
                    animationDuration={1000}
                    animationEasing="ease-out"
                />
            </AreaChart>
        </ResponsiveContainer>
    );
}
