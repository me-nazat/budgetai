'use client';

import { useState } from 'react';
import { motion, PanInfo, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Pencil, Trash2, Archive } from 'lucide-react';

interface SwipeableCardProps {
  children: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
  className?: string;
}

export function SwipeableCard({
  children,
  onEdit,
  onDelete,
  onArchive,
  className = '',
}: SwipeableCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const x = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 500, damping: 30 });

  const background = useTransform(
    springX,
    [-150, 0],
    ['rgba(244,63,94,0.2)', 'rgba(244,63,94,0)']
  );

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < -80) {
      setIsOpen(true);
      x.set(-120);
    } else {
      setIsOpen(false);
      x.set(0);
    }
  };

  const handleAction = (action: () => void) => {
    action();
    setIsOpen(false);
    x.set(0);
  };

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      {/* Background actions */}
      <motion.div
        className="absolute inset-0 flex items-center justify-end px-4 gap-2"
        style={{ backgroundColor: background }}
      >
        {onArchive && (
          <button
            onClick={() => handleAction(onArchive)}
            className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center"
          >
            <Archive size={16} className="text-amber-400" />
          </button>
        )}
        {onEdit && (
          <button
            onClick={() => handleAction(onEdit)}
            className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center"
          >
            <Pencil size={16} className="text-indigo-400" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => handleAction(onDelete)}
            className="w-10 h-10 rounded-full bg-rose-500/20 flex items-center justify-center"
          >
            <Trash2 size={16} className="text-rose-400" />
          </button>
        )}
      </motion.div>

      {/* Card content */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -120, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x: springX }}
        className="relative z-10 bg-card"
      >
        {children}
      </motion.div>
    </div>
  );
}
