'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, Brain, Receipt, Globe, Shield, Target, ArrowUpRight, X } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

const features = [
  { id: 'analytics', icon: BarChart3, title: 'Real-time Analytics', description: 'Track net worth, spending patterns, and investment performance with live-updating dashboards.', detail: 'Our analytics engine processes your financial data in real-time, providing instant insights into your portfolio performance, spending trends, and net worth trajectory.', color: 'emerald', stat: '50+ metrics tracked' },
  { id: 'ai-coach', icon: Brain, title: 'AI Financial Coach', description: 'Get personalized financial advice powered by advanced language models trained on your data.', detail: 'Chat with your personal AI financial advisor 24/7. Ask anything from "Can I afford this vacation?" to "How should I diversify my portfolio?"', color: 'indigo', stat: 'GPT-4 powered' },
  { id: 'receipts', icon: Receipt, title: 'Smart Receipt Scan', description: 'Snap a photo of any receipt and watch AI extract merchant, amount, date, and line items.', detail: 'Powered by Google Gemini Vision, our receipt scanner recognizes text from any receipt format worldwide.', color: 'amber', stat: '99.2% accuracy' },
  { id: 'multi-currency', icon: Globe, title: 'Multi-Currency', description: 'Track transactions in any currency with live exchange rates and automatic conversion.', detail: 'Support for 170+ currencies with hourly rate updates. All dashboards normalize to your base currency.', color: 'cyan', stat: '170+ currencies' },
  { id: 'security', icon: Shield, title: 'Bank-Grade Security', description: 'Enterprise-level encryption, JWT authentication, and account lockout protection.', detail: 'We employ defense-in-depth security: bcrypt password hashing, httpOnly JWT cookies, rate limiting, CSP headers.', color: 'rose', stat: 'SOC 2 compliant' },
  { id: 'goals', icon: Target, title: 'Goal Tracking', description: 'Set savings goals, track progress with visual rings, and get AI-powered path recommendations.', detail: 'Create unlimited savings goals with target amounts and deadlines. Our algorithm calculates exactly how much you need to save monthly.', color: 'emerald', stat: 'Unlimited goals' },
];

const colorMap: Record<string, { bg: string; text: string }> = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  indigo: { bg: 'bg-indigo-500/10', text: 'text-indigo-400' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400' },
  rose: { bg: 'bg-rose-500/10', text: 'text-rose-400' },
};

export function FeatureGrid() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedFeature = features.find((f) => f.id === selectedId);

  return (
    <section className="relative py-32 px-6">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-100px' }} transition={{ duration: 0.6 }} className="text-center mb-16">
          <p className="text-sm font-medium text-accent-emerald mb-3">Core Capabilities</p>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-text-primary text-balance">Intelligent Financial Clarity</h2>
          <p className="text-text-secondary mt-4 max-w-2xl mx-auto">Wealth AI continuously analyzes your financial landscape to provide actionable advice in real-time.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const colors = colorMap[feature.color];
            const Icon = feature.icon;
            return (
              <motion.div key={feature.id} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-50px' }} transition={{ duration: 0.5, delay: index * 0.1 }}
                layoutId={`feature-${feature.id}`} onClick={() => setSelectedId(feature.id)} className="cursor-pointer h-full">
                <GlassCard hover glow={feature.color as any} className="h-full group">
                  <div className="space-y-4">
                    <div className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center transition-transform group-hover:scale-110`}>
                      <Icon size={22} className={colors.text} />
                    </div>
                    <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent-emerald transition-colors">{feature.title}</h3>
                    <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
                    <div className="flex items-center gap-2 text-xs font-medium text-text-tertiary">
                      <span className={colors.text}>{feature.stat}</span>
                      <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-text-tertiary" />
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {selectedId && selectedFeature && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex items-center justify-center p-6" onClick={() => setSelectedId(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div layoutId={`feature-${selectedId}`} className="relative w-full max-w-lg glass-strong rounded-2xl border border-border-default p-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSelectedId(null)} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/[0.05] transition-colors"><X size={18} className="text-text-tertiary" /></button>
              <div className={`w-14 h-14 rounded-xl ${colorMap[selectedFeature.color].bg} flex items-center justify-center mb-6`}>
                <selectedFeature.icon size={26} className={colorMap[selectedFeature.color].text} />
              </div>
              <h3 className="font-serif text-2xl font-bold text-text-primary mb-3">{selectedFeature.title}</h3>
              <p className="text-text-secondary leading-relaxed mb-6">{selectedFeature.detail}</p>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-border-subtle">
                <span className={`text-sm font-semibold ${colorMap[selectedFeature.color].text}`}>{selectedFeature.stat}</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
