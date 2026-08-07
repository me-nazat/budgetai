'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane, MapPin, Users, Wallet, Calendar, ChevronRight, Plus,
  CheckCircle2, Circle, Clock,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FluidButton } from '@/components/ui/FluidButton';

interface Tour {
  id: string;
  name: string;
  destination: string;
  dates: string;
  budget: number;
  spent: number;
  participants: string[];
  status: 'planning' | 'active' | 'completed';
  coverImage?: string;
}

const tours: Tour[] = [
  {
    id: '1',
    name: 'Sylhet Adventure',
    destination: 'Sylhet, Bangladesh',
    dates: 'Dec 15 - Dec 22, 2025',
    budget: 50000,
    spent: 32500,
    participants: ['NA', 'AM', 'RK', 'SZ'],
    status: 'active',
  },
  {
    id: '2',
    name: 'Japan Cherry Blossom',
    destination: 'Tokyo, Japan',
    dates: 'Apr 1 - Apr 15, 2026',
    budget: 250000,
    spent: 45000,
    participants: ['NA', 'SC'],
    status: 'planning',
  },
  {
    id: '3',
    name: 'Cox Bazar Beach Trip',
    destination: 'Cox Bazar, Bangladesh',
    dates: 'Aug 10 - Aug 14, 2025',
    budget: 30000,
    spent: 28500,
    participants: ['NA', 'AM', 'RK', 'SZ', 'SC'],
    status: 'completed',
  },
];

const statusConfig = {
  planning: { label: 'Planning', icon: Circle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  active: { label: 'Active', icon: Clock, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
};

export default function ToursPage() {
  const [selectedTour, setSelectedTour] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold text-text-primary">Tour Manager</h1>
          <p className="text-sm text-text-secondary mt-1">Plan, budget, and track group trips.</p>
        </div>
        <FluidButton>
          <Plus size={16} />
          New Tour
        </FluidButton>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {tours.map((tour, index) => {
          const status = statusConfig[tour.status];
          const StatusIcon = status.icon;
          const progress = (tour.spent / tour.budget) * 100;
          const isOverBudget = progress > 100;

          return (
            <motion.div
              key={tour.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -4 }}
              className="cursor-pointer"
              onClick={() => setSelectedTour(tour.id)}
            >
              <GlassCard hover glow={isOverBudget ? 'rose' : tour.status === 'active' ? 'emerald' : 'none'} className="h-full">
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-2xl ${status.bg} flex items-center justify-center`}>
                      <Plane size={22} className={status.color} />
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${status.border} ${status.bg}`}>
                      <StatusIcon size={12} className={status.color} />
                      <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                    </div>
                  </div>

                  {/* Tour Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">{tour.name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <MapPin size={12} className="text-text-tertiary" />
                      <span className="text-xs text-text-secondary">{tour.destination}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Calendar size={12} className="text-text-tertiary" />
                      <span className="text-xs text-text-secondary">{tour.dates}</span>
                    </div>
                  </div>

                  {/* Budget Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-tertiary">Budget</span>
                      <span className={`font-mono font-medium ${isOverBudget ? 'text-accent-rose' : 'text-text-primary'}`}>
                        ${tour.spent.toLocaleString()} / ${tour.budget.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 1, delay: 0.3 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${
                          isOverBudget ? 'bg-accent-rose' : progress > 75 ? 'bg-amber-400' : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Participants */}
                  <div className="flex items-center justify-between">
                    <div className="flex -space-x-2">
                      {tour.participants.map((p, i) => (
                        <div
                          key={i}
                          className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-indigo-500 border-2 border-background flex items-center justify-center text-white text-[10px] font-bold"
                        >
                          {p}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-text-tertiary group-hover:text-text-secondary transition-colors">
                      <span>Details</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* Tour Detail Panel (slide-in) */}
      <AnimatePresence>
        {selectedTour && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-lg glass-strong border-l border-border-default z-[200] overflow-y-auto"
          >
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl font-bold text-text-primary">
                  {tours.find((t) => t.id === selectedTour)?.name}
                </h2>
                <button
                  onClick={() => setSelectedTour(null)}
                  className="p-2 rounded-lg hover:bg-white/[0.05] transition-colors"
                >
                  <ChevronRight size={20} className="text-text-tertiary rotate-180" />
                </button>
              </div>
              {/* Tour detail content */}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
