'use client';

import { motion } from 'framer-motion';

interface StaggeredListProps {
  children: React.ReactNode[];
  className?: string;
  staggerDelay?: number;
  itemClassName?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring' as const,
      stiffness: 350,
      damping: 25,
    },
  },
};

export function StaggeredList({
  children,
  className = '',
  staggerDelay = 0.05,
  itemClassName = '',
}: StaggeredListProps) {
  return (
    <motion.div
      variants={{
        ...containerVariants,
        visible: {
          ...containerVariants.visible,
          transition: { ...containerVariants.visible.transition, staggerChildren: staggerDelay },
        },
      }}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children.map((child, index) => (
        <motion.div key={index} variants={itemVariants} className={itemClassName}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
