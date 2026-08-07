'use client';

import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { useState } from 'react';
import Link from 'next/link';
import { X, Flame, Plane, MessageSquare, Sparkles, Settings, ChevronRight } from 'lucide-react';

const drawerItems = [
  { label: 'FIRE Calculator', href: '/fire', icon: Flame, color: 'text-amber-400' },
  { label: 'Tour Manager', href: '/tours', icon: Plane, color: 'text-emerald-400' },
  { label: 'AI Coach', href: '/coach', icon: MessageSquare, color: 'text-indigo-400' },
  { label: 'Achievements', href: '/achievements', icon: Sparkles, color: 'text-yellow-400' },
  { label: 'Settings', href: '/settings', icon: Settings, color: 'text-text-secondary' },
];

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 100) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] md:hidden"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 glass-strong rounded-t-3xl border-t border-border-default max-h-[80vh] overflow-y-auto"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-4 space-y-1">
              <div className="flex items-center justify-between mb-4 px-2">
                <h3 className="text-lg font-semibold text-text-primary">Menu</h3>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05]">
                  <X size={18} className="text-text-tertiary" />
                </button>
              </div>

              {drawerItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-4 px-3 py-3.5 rounded-xl hover:bg-white/[0.04] transition-colors active:scale-[0.98]"
                    >
                      <Icon size={20} className={item.color} />
                      <span className="flex-1 text-sm font-medium text-text-primary">{item.label}</span>
                      <ChevronRight size={16} className="text-text-muted" />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
