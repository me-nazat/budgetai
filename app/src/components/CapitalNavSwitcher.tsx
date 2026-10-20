'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

interface CapitalTab {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string;
}

const TABS: CapitalTab[] = [
  {
    id: 'networth',
    label: 'Balance Sheet',
    href: '/networth',
    icon: 'account_balance',
  },
  {
    id: 'investments',
    label: 'Investment Portfolio',
    href: '/investments',
    icon: 'show_chart',
  },
  {
    id: 'debts',
    label: 'Debt Payoff',
    href: '/debts',
    icon: 'credit_score',
  },
];

export function CapitalNavSwitcher() {
  const pathname = usePathname();

  return (
    <div className="w-full flex justify-center mb-6">
      <nav
        aria-label="Capital Workspace Navigation"
        className="inline-flex items-center p-1.5 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/40"
      >
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                isActive
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeCapitalNavTab"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500/20 via-sky-500/20 to-blue-500/20 border border-emerald-500/40 shadow-sm"
                  transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                />
              )}

              <span
                className={`material-symbols-outlined text-[18px] relative z-10 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-gray-400'
                }`}
              >
                {tab.icon}
              </span>

              <span className="relative z-10 tracking-tight">{tab.label}</span>

              {tab.badge && (
                <span className="relative z-10 ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default CapitalNavSwitcher;
