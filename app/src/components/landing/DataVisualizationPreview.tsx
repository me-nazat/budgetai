'use client';

import { motion, useInView } from 'framer-motion';
import { useRef, useSyncExternalStore } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const data = [
  { month: 'Jan', value: 4000 }, { month: 'Feb', value: 5200 }, { month: 'Mar', value: 4800 },
  { month: 'Apr', value: 6100 }, { month: 'May', value: 7200 }, { month: 'Jun', value: 8500 },
  { month: 'Jul', value: 9200 }, { month: 'Aug', value: 8800 }, { month: 'Sep', value: 10500 },
  { month: 'Oct', value: 11200 }, { month: 'Nov', value: 12400 }, { month: 'Dec', value: 13800 },
];

function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="glass-strong rounded-lg border border-border-default px-3 py-2 shadow-lg">
        <p className="text-xs text-text-tertiary">{payload[0].payload.month}</p>
        <p className="text-sm font-semibold text-text-primary font-mono">${payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
}

export function DataVisualizationPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-100px' });
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}>
            <p className="text-sm font-medium text-accent-emerald mb-3">Data Visualization</p>
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-text-primary text-balance mb-6">See your money in a new light.</h2>
            <p className="text-text-secondary leading-relaxed mb-8">Wealth AI turns complex financial data into beautiful, interactive stories.</p>
            <ul className="space-y-3">
              {['Exportable tax-ready reports', 'Peer benchmarking', 'Smart savings projections'].map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-text-secondary">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.2 }} className="relative">
            <div className="glass rounded-2xl border border-white/10 bg-[#0F172A]/80 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Annual Growth</p>
                  <p className="text-2xl font-bold font-mono text-white">$13,800</p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold border border-emerald-500/20">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
                  +245%
                </div>
              </div>
              <div className="h-[280px]">
                {mounted ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                    <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => `$${v / 1000}k`} dx={-10} />
                      <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }} />
                      <Area type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2.5} fill="url(#areaGradient)" isAnimationActive={true} animationDuration={1200} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="w-full h-full bg-white/[0.02] rounded-xl animate-pulse" />
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
