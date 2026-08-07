'use client';

import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X } from 'lucide-react';

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function MobileModal({ isOpen, onClose, title, children }: MobileModalProps) {
  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.y > 150) {
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
          className="fixed inset-0 z-[400] flex items-end md:items-center justify-center"
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
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full md:w-[500px] md:rounded-2xl rounded-t-2xl glass-strong border-t md:border border-border-default max-h-[90vh] overflow-y-auto"
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <div className="p-5 md:p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
                <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/[0.05]">
                  <X size={18} className="text-text-tertiary" />
                </button>
              </div>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
