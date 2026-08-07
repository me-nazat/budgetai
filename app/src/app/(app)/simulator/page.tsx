'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SlidersHorizontal, Save } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FluidButton } from '@/components/ui/FluidButton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function SimulatorPage() {
  const [incomeChange, setIncomeChange] = useState(0);
  const [diningSpend, setDiningSpend] = useState(100);
  const [transportSpend, setTransportSpend] = useState(100);
  const [shoppingSpend, setShoppingSpend] = useState(100);
  const [monthlySavings, setMonthlySavings] = useState(50000);
  const [windfall, setWindfall] = useState(0);

  const currentData = useMemo(() => {
    const data = [];
    let nw = 1000000;
    for (let i = 0; i <= 12; i++) {
      data.push({ month: `M${i}`, current: Math.round(nw), simulated: null });
      nw = nw * 1.006 + 30000;
    }
    return data;
  }, []);

  const simulatedData = useMemo(() => {
    const data = [];
    let nw = 1000000 + windfall;
    const monthlyIncome = 85000 * (1 + incomeChange / 100);
    const expenses = (diningSpend + transportSpend + shoppingSpend) * 100;
    const savings = monthlyIncome - expenses + monthlySavings;
    for (let i = 0; i <= 12; i++) {
      data.push({ month: `M${i}`, current: currentData[i]?.current || 0, simulated: Math.round(nw) });
      nw = nw * 1.006 + savings;
    }
    return data;
  }, [incomeChange, diningSpend, transportSpend, shoppingSpend, monthlySavings, windfall, currentData]);

  const projectedDiff = simulatedData[12].simulated - currentData[12].current;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">What-If Simulator</h1>
          <p className="text-sm text-text-secondary mt-1">Model your financial future before you live it.</p>
        </div>
        <FluidButton variant="secondary"><Save size={16} />Save as Goal</FluidButton>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Sliders */}
        <div className="lg:col-span-1 space-y-4">
          <GlassCard>
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal size={16} className="text-accent-emerald" />
              <h3 className="text-sm font-semibold text-text-primary">Adjust Variables</h3>
            </div>
            <div className="space-y-5">
              {[
                { label: 'Income Change', value: incomeChange, min: -50, max: 100, suffix: '%', onChange: setIncomeChange },
                { label: 'Dining Spend', value: diningSpend, min: 0, max: 300, suffix: '%', onChange: setDiningSpend },
                { label: 'Transport Spend', value: transportSpend, min: 0, max: 300, suffix: '%', onChange: setTransportSpend },
                { label: 'Shopping Spend', value: shoppingSpend, min: 0, max: 300, suffix: '%', onChange: setShoppingSpend },
                { label: 'Extra Monthly Savings', value: monthlySavings, min: 0, max: 200000, step: 5000, prefix: '$', suffix: '', onChange: setMonthlySavings },
                { label: 'One-time Windfall', value: windfall, min: 0, max: 1000000, step: 10000, prefix: '$', suffix: '', onChange: setWindfall },
              ].map((slider) => (
                <div key={slider.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-text-secondary">{slider.label}</label>
                    <span className="text-xs font-mono font-semibold text-text-primary">
                      {slider.prefix || ''}{slider.value.toLocaleString()}{slider.suffix}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={slider.min}
                    max={slider.max}
                    step={slider.step || 1}
                    value={slider.value}
                    onChange={(e) => slider.onChange(Number(e.target.value))}
                    className="w-full h-2 rounded-full appearance-none bg-white/[0.05] accent-emerald-500 cursor-pointer"
                  />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard glow={projectedDiff > 0 ? 'emerald' : 'rose'}>
            <div className="text-center">
              <p className="text-xs text-text-tertiary">Projected Difference (12mo)</p>
              <p className={`text-2xl font-bold font-mono mt-1 ${projectedDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {projectedDiff >= 0 ? '+' : ''}${projectedDiff.toLocaleString()}
              </p>
            </div>
          </GlassCard>
        </div>

        {/* Chart */}
        <div className="lg:col-span-2">
          <GlassCard className="h-full">
            <div className="h-[450px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simulatedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="currentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#64748B" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="#64748B" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="simulatedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip content={({ active, payload }: any) => {
                    if (active && payload) {
                      return (
                        <div className="glass-strong rounded-lg border border-border-default px-3 py-2">
                          <p className="text-xs text-text-tertiary">{payload[0].payload.month}</p>
                          {payload.map((p: any) => (
                            <p key={p.dataKey} className="text-xs font-mono mt-0.5" style={{ color: p.color }}>
                              {p.dataKey === 'current' ? 'Current: ' : 'Simulated: '}${p.value.toLocaleString()}
                            </p>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#94A3B8' }} />
                  <Area type="monotone" dataKey="current" stroke="#64748B" strokeWidth={2} fill="url(#currentGrad)" name="Current Trajectory" />
                  <Area type="monotone" dataKey="simulated" stroke="#10B981" strokeWidth={2.5} fill="url(#simulatedGrad)" name="Simulated Trajectory" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
