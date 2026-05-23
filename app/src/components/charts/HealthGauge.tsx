'use client';

import { useMemo } from 'react';

interface HealthGaugeProps {
    score: number; // 0–100
    label?: string;
    size?: number;
}

export default function HealthGauge({ score, label = 'Financial Health', size = 160 }: HealthGaugeProps) {
    const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

    const { color, bg, glow, status } = useMemo(() => {
        if (clampedScore >= 70) return {
            color: '#22c55e',
            bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            glow: 'shadow-[0_0_20px_rgba(34,197,94,0.15)]',
            status: 'Excellent',
        };
        if (clampedScore >= 40) return {
            color: '#f59e0b',
            bg: 'bg-amber-50 dark:bg-amber-500/10',
            glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]',
            status: 'Fair',
        };
        return {
            color: '#ef4444',
            bg: 'bg-rose-50 dark:bg-rose-500/10',
            glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]',
            status: 'Needs Attention',
        };
    }, [clampedScore]);

    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const arcLength = circumference * 0.75; // 270 degree arc
    const dashOffset = arcLength - (arcLength * clampedScore) / 100;

    return (
        <div className={`flex flex-col items-center gap-3 rounded-2xl p-5 ${bg} ${glow} transition-all`}>
            <div className="relative" style={{ width: size, height: size * 0.72 }}>
                <svg
                    viewBox="0 0 100 70"
                    className="w-full h-full overflow-visible"
                >
                    {/* Background arc */}
                    <circle
                        cx="50"
                        cy="55"
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        className="text-gray-200 dark:text-gray-700"
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${arcLength} ${circumference}`}
                        transform="rotate(135 50 55)"
                    />
                    {/* Filled arc */}
                    <circle
                        cx="50"
                        cy="55"
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={`${arcLength} ${circumference}`}
                        strokeDashoffset={dashOffset}
                        transform="rotate(135 50 55)"
                        className="transition-all duration-1000 ease-out"
                        style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
                    />
                    {/* Score text */}
                    <text x="50" y="52" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="18" fontWeight="900">
                        {clampedScore}
                    </text>
                    <text x="50" y="64" textAnchor="middle" className="fill-gray-400 dark:fill-gray-500" fontSize="6" fontWeight="700">
                        {status}
                    </text>
                </svg>
            </div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{label}</p>
        </div>
    );
}
