'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Target, TrendingUp, Calculator } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function FIREPage() {
  const [netWorth, setNetWorth] = useState(500000);
  const [monthlySavings, setMonthlySavings] = useState(50000);
  const [annualReturn, setAnnualReturn] = useState(8);
  const [annualSpending, setAnnualSpending] = useState(600000);
  const [currentAge, setCurrentAge] = useState(30);

  const fireNumber = annualSpending * 25;
  const monthlyReturn = annualReturn / 100 / 12;
  let monthsToFire = 0;
  let projected = netWorth;
  const chartData = [];

  while (projected < fireNumber && monthsToFire < 600) {
    projected = projected * (1 + monthlyReturn) + monthlySavings;
    monthsToFire++;
    if (monthsToFire % 12 === 0) {
      chartData.push({
        age: currentAge + monthsToFire / 12,
        netWorth: Math.round(projected),
        fireNumber,
      });
    }
  }

  const fireAge = currentAge + monthsToFire / 12;

  const Slider = ({ label, value, min, max, step, onChange, prefix = '', suffix = '' }: any) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-text-secondary">{label}</label>
        <span className="text-sm font-mono font-semibold text-text-primary">
          {prefix}{value.toLocaleString()}{suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none bg-white/[0.05] accent-emerald-500 cursor-pointer"
      />
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">FIRE Calculator</h1>
        <p className="text-sm text-text-secondary mt-1">Financial Independence, Retire Early.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Inputs */}
        <div className="lg:col-span-1 space-y-4">
          <GlassCard>
            <div className="space-y-5">
              <Slider label="Current Net Worth" value={netWorth} min={0} max={5000000} step={10000} onChange={setNetWorth} prefix="$" />
              <Slider label="Monthly Savings" value={monthlySavings} min={0} max={500000} step={5000} onChange={setMonthlySavings} prefix="$" />
              <Slider label="Annual Return %" value={annualReturn} min={1} max={15} step={0.5} onChange={setAnnualReturn} suffix="%" />
              <Slider label="Annual Spending" value={annualSpending} min={100000} max={5000000} step={50000} onChange={setAnnualSpending} prefix="$" />
              <Slider label="Current Age" value={currentAge} min={18} max={70} step={1} onChange={setCurrentAge} suffix=" yrs" />
            </div>
          </GlassCard>

          {/* Results */}
          <GlassCard glow="emerald">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Target size={18} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-text-tertiary">FIRE Number</p>
                  <p className="text-xl font-bold font-mono text-text-primary">${fireNumber.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                  <Flame size={18} className="text-indigo-400" />
                </div>
                <div>
                  <p className="text-xs text-text-tertiary">FIRE Age</p>
                  <p className="text-xl font-bold font-mono text-text-primary">{Math.round(fireAge)} years old</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp size={18} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-text-tertiary">Years to FIRE</p>
                  <p className="text-xl font-bold font-mono text-text-primary">{Math.round(monthsToFire / 12)} years</p>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2">
          <GlassCard className="h-full">
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fireGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="age" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (active && payload) {
                        return (
                          <div className="glass-strong rounded-lg border border-border-default px-3 py-2">
                            <p className="text-xs text-text-tertiary">Age {payload[0].payload.age}</p>
                            <p className="text-sm font-mono font-semibold text-text-primary">${payload[0].value.toLocaleString()}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={fireNumber} stroke="#F59E0B" strokeDasharray="6 4" label={{ value: 'FIRE Number', fill: '#F59E0B', fontSize: 11, position: 'insideTopRight' }} />
                  <Area type="monotone" dataKey="netWorth" stroke="#10B981" strokeWidth={2.5} fill="url(#fireGradient)" animationDuration={800} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
