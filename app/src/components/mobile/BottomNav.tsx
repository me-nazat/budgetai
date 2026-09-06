'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Wallet, Target, TrendingUp, Menu,
} from 'lucide-react';
import { MobileDrawer } from './MobileDrawer';

const mobileNavItems = [
  { label: 'Home', href: '/overview', icon: LayoutDashboard },
  { label: 'Transactions', href: '/transactions', icon: Wallet },
  { label: 'Budgets', href: '/budget', icon: Target },
  { label: 'Net Worth', href: '/wealth-goals', icon: TrendingUp },
  { label: 'More', href: '#menu', icon: Menu },
];

export function BottomNav() {
  const pathname = usePathname();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.5 }}
        className="fixed bottom-4 left-4 right-4 z-[100] md:hidden"
      >
        <div className="glass-strong rounded-2xl border border-border-default shadow-2xl px-2 py-2">
          <div className="flex items-center justify-around">
            {mobileNavItems.map((item, index) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href !== '#menu' ? item.href : '#'}
                  className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl"
                  onClick={(e) => {
                    if (item.href === '#menu') {
                      e.preventDefault();
                      setIsDrawerOpen(true);
                      return;
                    }
                    setActiveIndex(index);
                  }}
                >
                  {isActive && item.href !== '#menu' && (
                    <motion.div
                      layoutId="mobile-active-pill"
                      className="absolute inset-0 rounded-xl bg-accent-emerald/10"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    size={20}
                    className={`relative z-10 transition-colors ${
                      isActive && item.href !== '#menu' ? 'text-accent-emerald' : 'text-text-tertiary'
                    }`}
                  />
                  <span
                    className={`relative z-10 text-[10px] font-medium ${
                      isActive && item.href !== '#menu' ? 'text-text-primary' : 'text-text-tertiary'
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </motion.nav>
      <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </>
  );
}
