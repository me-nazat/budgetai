'use client';

import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { FluidButton } from '@/components/ui/FluidButton';

export function CTASection({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <section className="relative py-32 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="glass-strong rounded-3xl border border-border-default p-12 md:p-16 relative overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-radial from-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10">
            <h2 className="font-serif text-4xl md:text-5xl font-bold text-text-primary text-balance mb-6">Ready to master your wealth?</h2>
            <p className="text-text-secondary max-w-lg mx-auto mb-8">Join the community of professionals mastering their finances with AI. Start your 14-day free trial, no credit card required.</p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <FluidButton size="lg" className="group" onClick={onOpenAuth}>Start Free Trial<ArrowRight size={18} className="transition-transform group-hover:translate-x-1" /></FluidButton>
              <FluidButton variant="secondary" size="lg">View Pricing</FluidButton>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
