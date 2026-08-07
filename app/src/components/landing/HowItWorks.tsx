'use client';

import { motion } from 'framer-motion';
import { MessageSquare, Sparkles, BarChart3, Bell } from 'lucide-react';

const steps = [
  { icon: MessageSquare, title: 'Tell Wealth AI', description: 'Add "coffee 6 dollars" or ask a finance question in natural language.' },
  { icon: Sparkles, title: 'AI Categorizes', description: 'The entry is cleaned, dated, matched to a smart category, and styled with an icon.' },
  { icon: BarChart3, title: 'Dashboard Updates', description: 'Balances, charts, recent transactions, and trends refresh around the new data.' },
  { icon: Bell, title: 'Insights Surface', description: 'Budget alerts and savings guidance appear when your numbers need attention.' },
];

export function HowItWorks() {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="text-center mb-20">
          <p className="text-sm font-medium text-accent-emerald mb-3">How It Works</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-text-primary text-balance">From one sentence to a living financial picture.</h2>
        </motion.div>

        <div className="relative">
          <div className="absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border-default to-transparent hidden md:block" />
          <div className="grid md:grid-cols-4 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div key={step.title} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.15 }} className="relative text-center">
                  <div className="relative z-10 w-24 h-24 mx-auto mb-6 rounded-2xl glass border border-border-default flex items-center justify-center group hover:border-accent-emerald/30 transition-colors">
                    <Icon size={28} className="text-text-secondary group-hover:text-accent-emerald transition-colors" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent-emerald text-white text-xs font-bold flex items-center justify-center">{index + 1}</div>
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
