'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { NumberRoller } from '@/components/effects/NumberRoller';

const mobileStats = [
  { label: 'Net Worth', value: 1240500, prefix: '$', change: 2.4, positive: true },
  { label: 'Income', value: 8500, prefix: '$', change: 5.2, positive: true },
  { label: 'Expenses', value: 4200, prefix: '$', change: -1.8, positive: false },
  { label: 'Savings', value: 50.6, suffix: '%', change: 3.1, positive: true },
];

export function MobileDashboard() {
  return (
    <div className="space-y-4 md:hidden">
      {/* Horizontal stat scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x snap-mandatory scroll-momentum">
        {mobileStats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="snap-start shrink-0 w-[160px]"
          >
            <GlassCard padding="sm" className="h-full">
              <div className="space-y-2">
                <p className="text-xs text-text-tertiary">{stat.label}</p>
                <p className="text-lg font-bold font-mono text-text-primary">
                  <NumberRoller value={stat.value} prefix={stat.prefix} suffix={stat.suffix} />
                </p>
                <div className={`flex items-center gap-1 text-xs ${stat.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {stat.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {stat.positive ? '+' : ''}{stat.change}%
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 gap-3">
        {['Add Transaction', 'Scan Receipt', 'AI Coach', 'Set Budget'].map((action, index) => (
          <motion.button
            key={action}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + index * 0.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-4 rounded-xl glass border border-border-subtle text-left active-scale flex flex-col justify-between"
          >
            <ArrowUpRight size={16} className="text-text-muted mb-2" />
            <p className="text-sm font-medium text-text-primary">{action}</p>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
