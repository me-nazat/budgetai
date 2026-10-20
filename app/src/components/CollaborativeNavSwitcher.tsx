'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

interface Props {
  className?: string;
}

export function CollaborativeNavSwitcher({ className = '' }: Props) {
  const pathname = usePathname();

  const tabs = [
    {
      href: '/tours',
      label: 'Group Tours & Trips',
      icon: 'flight_takeoff',
      isActive: pathname.startsWith('/tours'),
      color: 'text-sky-400',
      activeBg: 'bg-sky-500/15 border-sky-500/30 text-white',
    },
    {
      href: '/household',
      label: 'Households & Living',
      icon: 'home',
      isActive: pathname.startsWith('/household'),
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/15 border-emerald-500/30 text-white',
    },
    {
      href: '/bill-split',
      label: 'Quick Bill Splits',
      icon: 'receipt_long',
      isActive: pathname.startsWith('/bill-split'),
      color: 'text-amber-400',
      activeBg: 'bg-amber-500/15 border-amber-500/30 text-white',
    },
  ];

  return (
    <div className={`flex items-center gap-1.5 p-1 rounded-2xl bg-surface-primary/70 backdrop-blur-xl border border-border-subtle max-w-fit overflow-x-auto ${className}`}>
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            tab.isActive
              ? `${tab.activeBg} shadow-xs font-black`
              : 'text-content-muted hover:text-content-primary hover:bg-surface-secondary/60'
          }`}
        >
          <span className={`material-symbols-outlined text-[18px] ${tab.isActive ? 'text-inherit' : tab.color}`}>
            {tab.icon}
          </span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </div>
  );
}

export default CollaborativeNavSwitcher;
