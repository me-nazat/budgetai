'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Repeat, CreditCard } from 'lucide-react';
import { RecurringContent } from '@/components/RecurringContent';
import { SubscriptionsContent } from '@/components/SubscriptionsContent';

const tabs = [
  { id: 'recurring', label: 'Recurring Transactions', icon: Repeat },
  { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
];

const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 30 : -30, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction < 0 ? 30 : -30, opacity: 0 }),
};

export default function RecurringSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState<'recurring' | 'subscriptions'>('recurring');
  const [direction, setDirection] = useState(0);

  const handleTabChange = (tabId: 'recurring' | 'subscriptions') => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const newIndex = tabs.findIndex((t) => t.id === tabId);
    setDirection(newIndex > currentIndex ? 1 : -1);
    setActiveTab(tabId);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold text-text-primary">Recurring & Subscriptions</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your regular income, bills, and subscription services all in one place.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-border-subtle overflow-x-auto w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as 'recurring' | 'subscriptions')}
              className={`relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="subscriptions-tab"
                  className="absolute inset-0 rounded-lg bg-white/[0.06] border border-border-subtle"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <Icon size={16} className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="relative min-h-[500px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute inset-0"
          >
            {activeTab === 'recurring' && <RecurringContent />}
            {activeTab === 'subscriptions' && <SubscriptionsContent />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
